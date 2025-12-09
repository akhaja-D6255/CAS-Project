import React, { useState, useEffect, useRef, useCallback } from "react";
import PathVisualizer from "./PathVisualizer";
import SensorCard from "./SensorCard";
import { format2DData } from "../utils/formatters";

/**
 * Uses camera-based visual odometry for pose estimation
 */
export default function SLAMModule() {
  // Camera & Video state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const processCanvasRef = useRef(null);
  const trajectoryCanvasRef = useRef(null);
  const streamRef = useRef(null);

  // SLAM state
  const [isRunning, setIsRunning] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [pose, setPose] = useState({ x: 0, y: 0, heading: 0 });
  const [trajectory, setTrajectory] = useState([{ x: 0, y: 0 }]);
  const [landmarkCount, setLandmarkCount] = useState(0);
  const [features, setFeatures] = useState([]);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);
  const [depthAvailable, setDepthAvailable] = useState(false);
  const [sensorInfo, setSensorInfo] = useState("");

  // GPS state
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsPath, setGpsPath] = useState([]);
  const watchIdRef = useRef(null);

  // Depth & AR state
  const depthDataRef = useRef(null);
  const arSessionRef = useRef(null);

  // (Sensor data removed from SLAM display and processing)

  // Refs for state that doesn't trigger re-renders
  const poseRef = useRef({ x: 0, y: 0, heading: 0 });
  const trajectoryRef = useRef([{ x: 0, y: 0 }]);
  const landmarksRef = useRef([]); // Map of 3D landmarks
  const prevFeaturesRef = useRef(null);
  const prevFrameRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);

  // IMU removed: SLAM now uses visual odometry only

  // ======================
  // FEATURE EXTRACTION
  // ======================

  /**
   * Extract corner features from grayscale frame using FAST-like detector
   * Enhanced with depth data from LiDAR/ARCore/ARKit when available
   * Classify features as: environment (green - safe to go) or obstacle (red - objects)
   * Obstacles: localized clusters of features (objects/things)
   * Environment: distributed features (safe spaces)
   * @param {ImageData} frameData - Grayscale image data
   * @param {Object} depthData - Optional depth information from AR sensors
   * @returns {Array} Array of feature points {x, y, score, type, depth}
   */
  const extractFeatures = useCallback((frameData, depthData = null) => {
    const { width, height, data } = frameData;
    const features = [];
    const threshold = 20;
    const gridSize = 6;
    const grid = {};

    // Simple FAST-like corner detector
    const circle = [
      [-3, 0],
      [-3, 1],
      [-2, 2],
      [-1, 3],
      [0, 3],
      [1, 3],
      [2, 2],
      [3, 1],
      [3, 0],
      [3, -1],
      [2, -2],
      [1, -3],
      [0, -3],
      [-1, -3],
      [-2, -2],
      [-3, -1],
    ];

    // Optimize: larger step size for faster processing
    for (let y = 10; y < height - 10; y += 3) {
      for (let x = 10; x < width - 10; x += 3) {
        const centerIdx = y * width + x;
        const centerIntensity = data[centerIdx * 4];

        let brighterCount = 0;
        let darkerCount = 0;

        // Check circle pixels
        for (let i = 0; i < circle.length; i++) {
          const [dx, dy] = circle[i];
          const checkIdx = ((y + dy) * width + (x + dx)) * 4;
          const intensity = data[checkIdx];

          if (intensity > centerIntensity + threshold) brighterCount++;
          if (intensity < centerIntensity - threshold) darkerCount++;
        }

        // If enough pixels are brighter or darker, it's a corner
        if (brighterCount >= 12 || darkerCount >= 12) {
          const score = Math.max(brighterCount, darkerCount);
          const gridKey = `${Math.floor(x / gridSize)}_${Math.floor(
            y / gridSize
          )}`;

          // Get depth value if available (from AR depth sensing)
          let depth = null;
          if (depthData && depthData.data) {
            const depthIdx = centerIdx;
            if (depthIdx < depthData.data.length) {
              depth = depthData.data[depthIdx];
            }
          }

          // Non-maximum suppression within grid
          if (!grid[gridKey] || grid[gridKey].score < score) {
            grid[gridKey] = { x, y, score, brighterCount, darkerCount, depth };
          }
        }
      }
    }

    // Extract raw features from grid
    const rawFeatures = [];
    for (let key in grid) {
      rawFeatures.push(grid[key]);
    }

    // Analyze spatial clustering to distinguish obstacles from environment
    // Enhanced with depth information when available
    const clusterMap = new Map();
    const clusterSize = 35; // Smaller clusters for better human detection

    rawFeatures.forEach((feat) => {
      const clusterKey = `${Math.floor(feat.x / clusterSize)}_${Math.floor(
        feat.y / clusterSize
      )}`;
      if (!clusterMap.has(clusterKey)) {
        clusterMap.set(clusterKey, []);
      }
      clusterMap.get(clusterKey).push(feat);
    });

    // Calculate cluster statistics for better detection
    let maxClusterSize = 0;
    let totalFeatures = 0;
    const clusterSizes = [];

    clusterMap.forEach((cluster) => {
      const size = cluster.length;
      totalFeatures += size;
      clusterSizes.push(size);
      if (size > maxClusterSize) maxClusterSize = size;
    });

    // Sort to find median cluster size
    clusterSizes.sort((a, b) => a - b);
    const medianClusterSize =
      clusterSizes[Math.floor(clusterSizes.length / 2)] || 1;
    const avgClusterSize = totalFeatures / Math.max(clusterMap.size, 1);

    // Dynamic threshold based on scene complexity
    const obstacleDensityThreshold = Math.max(2.5, avgClusterSize * 1.4);

    // Classify each feature and KEEP ONLY obstacle-type features
    rawFeatures.forEach((feat) => {
      const clusterKey = `${Math.floor(feat.x / clusterSize)}_${Math.floor(
        feat.y / clusterSize
      )}`;
      const clusterDensity = clusterMap.get(clusterKey).length;

      let isObstacle = false;

      // 1. DEPTH-BASED: close depth => obstacle
      if (feat.depth !== null && feat.depth !== undefined) {
        if (feat.depth < 1.8) isObstacle = true;
        else if (feat.depth > 0.5 && feat.depth < 4.0 && clusterDensity >= 2)
          isObstacle = true;
      }

      // 2. Dense clusters
      if (!isObstacle && clusterDensity >= obstacleDensityThreshold * 1.1)
        isObstacle = true;

      // 3. High-contrast edges
      if (
        !isObstacle &&
        feat.score >= 15 &&
        Math.abs(feat.brighterCount - feat.darkerCount) <= 2
      )
        isObstacle = true;

      // 4. Center-frame vertical features
      if (
        !isObstacle &&
        feat.x > width * 0.3 &&
        feat.x < width * 0.7 &&
        feat.y > height * 0.2 &&
        feat.y < height * 0.8 &&
        clusterDensity >= medianClusterSize * 1.4
      )
        isObstacle = true;

      // 5. Strong corners or anomalies
      if (!isObstacle && feat.score >= 16) isObstacle = true;
      if (!isObstacle && clusterDensity > medianClusterSize * 2.2)
        isObstacle = true;

      // Only keep features considered obstacles
      if (isObstacle) {
        features.push({
          x: feat.x,
          y: feat.y,
          score: feat.score,
          type: "obstacle",
          depth: feat.depth,
        });
      }
    });

    return features.slice(0, 1500);
  }, []);

  /**
   * Compute descriptor for a feature point (simple patch-based)
   * @param {ImageData} frameData - Image data
   * @param {Object} feature - Feature point {x, y}
   * @returns {Array} Simple descriptor vector
   */
  const computeDescriptor = useCallback((frameData, feature) => {
    const { width, data } = frameData;
    const { x, y } = feature;
    const patchSize = 3; // Reduced from 5 for faster computation
    const descriptor = [];

    for (let dy = -patchSize; dy <= patchSize; dy++) {
      for (let dx = -patchSize; dx <= patchSize; dx++) {
        const idx = ((y + dy) * width + (x + dx)) * 4;
        descriptor.push(data[idx] || 0);
      }
    }

    return descriptor;
  }, []);

  /**
   * Track features between consecutive frames using patch matching
   * @param {ImageData} prevFrame - Previous frame
   * @param {ImageData} currFrame - Current frame
   * @param {Array} prevFeatures - Features from previous frame
   * @returns {Array} Matched feature pairs [{prev, curr}, ...]
   */
  const trackFeatures = useCallback(
    (prevFrame, currFrame, prevFeatures) => {
      const matches = [];
      const searchRadius = 20; // Reduced from 30 for faster search
      const { width, height } = currFrame;

      // Sample only a subset of features for tracking to improve FPS
      const sampleStep = Math.max(1, Math.floor(prevFeatures.length / 300));

      for (let i = 0; i < prevFeatures.length; i += sampleStep) {
        const prevFeat = prevFeatures[i];
        const prevDesc = computeDescriptor(prevFrame, prevFeat);

        let bestMatch = null;
        let bestScore = Infinity;

        // Search for best match in current frame with larger step
        for (let dy = -searchRadius; dy <= searchRadius; dy += 3) {
          for (let dx = -searchRadius; dx <= searchRadius; dx += 3) {
            const currX = prevFeat.x + dx;
            const currY = prevFeat.y + dy;

            if (
              currX < 10 ||
              currX >= width - 10 ||
              currY < 10 ||
              currY >= height - 10
            ) {
              continue;
            }

            const currDesc = computeDescriptor(currFrame, {
              x: currX,
              y: currY,
            });

            // Compute Sum of Squared Differences (SSD)
            let ssd = 0;
            for (let j = 0; j < prevDesc.length; j++) {
              const diff = prevDesc[j] - currDesc[j];
              ssd += diff * diff;
            }

            if (ssd < bestScore) {
              bestScore = ssd;
              bestMatch = { x: currX, y: currY };
            }
          }
        }

        // Only accept good matches
        if (bestMatch && bestScore < 3000) {
          matches.push({
            prev: prevFeat,
            curr: bestMatch,
            score: bestScore,
          });
        }
      }

      return matches;
    },
    [computeDescriptor]
  );

  /**
   * Estimate pose change from matched features
   * Uses 2D motion estimation (translation + rotation)
   * @param {Array} matches - Matched feature pairs
   * @returns {Object} Pose delta {dx, dy, dHeading}
   */
  const estimatePose = useCallback((matches) => {
    if (matches.length < 5) {
      return { dx: 0, dy: 0, dHeading: 0 };
    }

    // Compute median displacement (robust to outliers)
    const displacements = matches.map((m) => ({
      dx: m.curr.x - m.prev.x,
      dy: m.curr.y - m.prev.y,
    }));

    displacements.sort((a, b) => a.dx - b.dx);
    const medianDx = displacements[Math.floor(displacements.length / 2)].dx;

    displacements.sort((a, b) => a.dy - b.dy);
    const medianDy = displacements[Math.floor(displacements.length / 2)].dy;

    // Estimate rotation from feature flow
    let rotationSum = 0;
    let rotationCount = 0;

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const angle1 = Math.atan2(m.prev.y - 240, m.prev.x - 320); // Center at 320x240
      const angle2 = Math.atan2(m.curr.y - 240, m.curr.x - 320);
      let dAngle = angle2 - angle1;

      // Normalize angle
      if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
      if (dAngle < -Math.PI) dAngle += 2 * Math.PI;

      if (Math.abs(dAngle) < 0.5) {
        rotationSum += dAngle;
        rotationCount++;
      }
    }

    const dHeading = rotationCount > 0 ? rotationSum / rotationCount : 0;

    // Scale from pixels to meters (rough calibration)
    const pixelToMeter = 0.001; // Adjust based on camera FOV and distance

    return {
      dx: -medianDx * pixelToMeter, // Negative because camera moves opposite
      dy: medianDy * pixelToMeter,
      dHeading: dHeading,
    };
  }, []);

  /**
   * Fuse visual odometry (no IMU available in this build)
   * @param {Object} visualPose - Pose from visual odometry {dx, dy, dHeading}
   * @param {Number} dt - Time delta
   * @returns {Object} Pose delta (visual only)
   */
  // Simplified fusion: visual odometry only (no IMU)
  const fuseIMU = useCallback((visualPose, dt) => {
    return visualPose;
  }, []);

  /**
   * Update map landmarks with new features
   * @param {Array} landmarks - Current map landmarks
   * @param {Array} features - New detected features
   * @param {Object} currentPose - Current robot pose
   * @returns {Array} Updated landmarks
   */
  const updateMap = useCallback((landmarks, features, currentPose) => {
    const updatedLandmarks = [...landmarks];
    const maxLandmarks = 500;
    const matchThreshold = 10; // pixels

    features.forEach((feat) => {
      // Transform feature to world coordinates
      const worldX =
        currentPose.x + feat.x * 0.001 * Math.cos(currentPose.heading);
      const worldY =
        currentPose.y + feat.x * 0.001 * Math.sin(currentPose.heading);

      // Check if landmark already exists
      let matched = false;
      for (let i = 0; i < updatedLandmarks.length; i++) {
        const lm = updatedLandmarks[i];
        const dist = Math.hypot(lm.x - worldX, lm.y - worldY);

        if (dist < matchThreshold * 0.001) {
          // Update existing landmark
          lm.x = (lm.x * lm.quality + worldX) / (lm.quality + 1);
          lm.y = (lm.y * lm.quality + worldY) / (lm.quality + 1);
          lm.quality = Math.min(lm.quality + 1, 10);
          matched = true;
          break;
        }
      }

      // Add new landmark
      if (!matched && updatedLandmarks.length < maxLandmarks) {
        updatedLandmarks.push({
          id: Date.now() + Math.random(),
          x: worldX,
          y: worldY,
          quality: 1,
        });
      }
    });

    return updatedLandmarks;
  }, []);

  // IMU handlers removed — SLAM uses visual odometry only

  // ======================
  // CAMERA CONTROL
  // ======================

  const startCamera = async () => {
    try {
      setError(null);
      let sensorTypes = [];

      // Request camera access with high frame rate (fallback to lower rates if unavailable)
      let stream;
      try {
        // Try to get depth stream first (ARCore/ARKit supported devices)
        const constraints = {
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 120 },
          },
        };

        // Check for depth sensor support
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");

        // Try to detect LiDAR/depth capable devices
        for (const device of videoDevices) {
          if (
            device.label.toLowerCase().includes("depth") ||
            device.label.toLowerCase().includes("tof") ||
            device.label.toLowerCase().includes("lidar")
          ) {
            sensorTypes.push("LiDAR/Depth");
            setDepthAvailable(true);
          }
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Check video track capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (capabilities.torch) sensorTypes.push("Torch");
        if (capabilities.zoom) sensorTypes.push("Zoom");

        sensorTypes.push("RGB Camera");
      } catch (err) {
        // Fallback to standard constraints if high FPS not supported
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });
        sensorTypes.push("RGB Camera");
      }

      // Try to initialize WebXR for AR depth data (disabled to prevent fullscreen)
      // Uncomment below if you want AR session support
      /*
      if ("xr" in navigator) {
        try {
          const isARSupported = await navigator.xr.isSessionSupported(
            "immersive-ar"
          );
          if (isARSupported) {
            sensorTypes.push("WebXR AR");
            // Request AR session with depth sensing
            const xrSession = await navigator.xr
              .requestSession("immersive-ar", {
                requiredFeatures: ["local-floor"],
                optionalFeatures: ["depth-sensing", "hit-test", "anchors"],
              })
              .catch(() => null);

            if (xrSession) {
              arSessionRef.current = xrSession;
              sensorTypes.push("Depth Sensing");
              setDepthAvailable(true);
            }
          }
        } catch (xrErr) {
          console.log("WebXR AR not available:", xrErr);
        }
      }
      */

      setSensorInfo(
        sensorTypes.length > 0 ? sensorTypes.join(" + ") : "Basic Camera"
      );

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      return true;
    } catch (err) {
      setError(`Camera error: ${err.message}`);
      return false;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // End AR session if active
    if (arSessionRef.current) {
      arSessionRef.current.end();
      arSessionRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Stop GPS tracking
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setDepthAvailable(false);
    setSensorInfo("");
    setGpsPath([]);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities();

    if (capabilities.torch) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: !torchEnabled }],
        });
        setTorchEnabled(!torchEnabled);
      } catch (err) {
        console.error("Torch error:", err);
      }
    }
  };

  // ======================
  // SLAM PROCESSING LOOP
  // ======================

  const processSLAMFrame = useCallback(() => {
    if (!isRunning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const processCanvas = processCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const processCtx = processCanvas.getContext("2d");

    // Calculate FPS
    const now = performance.now();
    const dt = (now - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = now;
    if (dt > 0) {
      setFps(Math.round(1 / dt));
    }

    // Draw video to canvas
    ctx.drawImage(video, 0, 0, 640, 480);
    const imageData = ctx.getImageData(0, 0, 640, 480);

    // Convert to grayscale
    const grayData = new ImageData(640, 480);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const gray =
        0.299 * imageData.data[i] +
        0.587 * imageData.data[i + 1] +
        0.114 * imageData.data[i + 2];
      grayData.data[i] = grayData.data[i + 1] = grayData.data[i + 2] = gray;
      grayData.data[i + 3] = 255;
    }

    // Extract features with depth data if available
    const features = extractFeatures(grayData, depthDataRef.current);

    // Draw live video on process canvas
    processCtx.drawImage(video, 0, 0, 640, 480);

    // Track features if we have previous frame
    let poseDelta = { dx: 0, dy: 0, dHeading: 0 };
    let matches = [];

    if (prevFrameRef.current && prevFeaturesRef.current) {
      matches = trackFeatures(
        prevFrameRef.current,
        grayData,
        prevFeaturesRef.current
      );

      if (matches.length > 5) {
        // Estimate visual odometry pose
        const visualPose = estimatePose(matches);

        // Use visual odometry (no IMU fusion)
        poseDelta = fuseIMU(visualPose, dt);
      }
    }

    // Draw all detected features with color-coding based on type
    // Optimize: render only every 3rd feature for better FPS
    const time = performance.now() / 1000;
    const renderStep = Math.max(1, Math.floor(features.length / 800)); // Limit rendered features

    // Count obstacle features (we only keep obstacles now)
    let obstacleCount = features.length;

    for (let idx = 0; idx < features.length; idx += renderStep) {
      const feat = features[idx];
      // Simplified pulsing animation
      const pulse = Math.sin(time * 2 + idx * 0.05) * 0.15 + 0.85;

      // All features are obstacles now (smaller, sharper markers)
      const radius = 2.6 * pulse;
      processCtx.fillStyle = `rgba(255, 0, 0, ${0.9 * pulse})`;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius, 0, Math.PI * 2);
      processCtx.fill();

      // Thin double ring for precision
      processCtx.strokeStyle = `rgba(255, 60, 60, ${0.75 * pulse})`;
      processCtx.lineWidth = 1.4;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius + 2, 0, Math.PI * 2);
      processCtx.stroke();

      // Subtle inner glow
      processCtx.strokeStyle = `rgba(255, 200, 200, ${0.45 * pulse})`;
      processCtx.lineWidth = 0.8;
      processCtx.beginPath();
      processCtx.arc(feat.x, feat.y, radius + 3.5, 0, Math.PI * 2);
      processCtx.stroke();
    }

    // Draw legend on canvas - centered at top
    const legendWidth = depthAvailable ? 320 : 280;
    const legendHeight = depthAvailable ? 75 : 60;
    const legendX = (640 - legendWidth) / 2;
    processCtx.fillStyle = "rgba(0, 0, 0, 0.75)";
    processCtx.fillRect(legendX, 10, legendWidth, legendHeight);

    // Title
    processCtx.fillStyle = "white";
    processCtx.font = "bold 13px Arial";
    processCtx.textAlign = "center";
    const titleText = depthAvailable
      ? "Feature Detection (LiDAR/Depth Enhanced)"
      : "Feature Detection";
    processCtx.fillText(titleText, legendX + legendWidth / 2, 28);

    // Obstacles count - centered
    const obstacleX = legendX + 40;
    processCtx.fillStyle = "rgba(255, 0, 0, 1)";
    processCtx.fillRect(obstacleX, 40, 10, 10);
    processCtx.fillStyle = "rgba(255, 0, 0, 1)";
    processCtx.font = "12px Arial";
    processCtx.textAlign = "left";
    processCtx.fillText(`Obstacles: ${obstacleCount}`, obstacleX + 15, 49);

    // Depth indicator if available
    if (depthAvailable) {
      processCtx.fillStyle = "rgba(100, 200, 255, 1)";
      processCtx.font = "10px Arial";
      processCtx.textAlign = "center";
      processCtx.fillText(
        "⚡ Depth Sensing Active",
        legendX + legendWidth / 2,
        68
      );
    }

    // Reset text align
    processCtx.textAlign = "left";

    // Update pose
    const newPose = {
      x: poseRef.current.x + poseDelta.dx,
      y: poseRef.current.y + poseDelta.dy,
      heading: poseRef.current.heading + poseDelta.dHeading,
    };

    poseRef.current = newPose;
    setPose(newPose);

    // Update trajectory
    const newTrajectory = [
      ...trajectoryRef.current,
      { x: newPose.x, y: newPose.y },
    ];
    if (newTrajectory.length > 500) newTrajectory.shift(); // Limit trajectory length
    trajectoryRef.current = newTrajectory;
    setTrajectory(newTrajectory);

    // Update map
    const updatedLandmarks = updateMap(landmarksRef.current, features, newPose);
    landmarksRef.current = updatedLandmarks;
    setLandmarkCount(updatedLandmarks.length);

    // Update features state for UI display
    setFeatures(features);

    // Draw trajectory
    drawTrajectory();

    // Store current frame and features for next iteration
    prevFrameRef.current = grayData;
    prevFeaturesRef.current = features;

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(processSLAMFrame);
  }, [
    isRunning,
    extractFeatures,
    trackFeatures,
    estimatePose,
    fuseIMU,
    updateMap,
  ]);

  /**
   * Draw 2D trajectory on canvas
   */
  const drawTrajectory = useCallback(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    const traj = trajectoryRef.current;
    if (traj.length < 2) return;

    // Find bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    traj.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rangeX = Math.max(maxX - minX, 1);
    const rangeY = Math.max(maxY - minY, 1);
    const padding = 20;

    // Draw trajectory
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();

    traj.forEach((p, i) => {
      const x = padding + ((p.x - minX) / rangeX) * (width - 2 * padding);
      const y =
        height - padding - ((p.y - minY) / rangeY) * (height - 2 * padding);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw start point
    const start = traj[0];
    const sx = padding + ((start.x - minX) / rangeX) * (width - 2 * padding);
    const sy =
      height - padding - ((start.y - minY) / rangeY) * (height - 2 * padding);
    ctx.fillStyle = "#0088ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw current point
    const curr = traj[traj.length - 1];
    const cx = padding + ((curr.x - minX) / rangeX) * (width - 2 * padding);
    const cy =
      height - padding - ((curr.y - minY) / rangeY) * (height - 2 * padding);
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw landmarks
    ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
    landmarksRef.current.forEach((lm) => {
      const lx = padding + ((lm.x - minX) / rangeX) * (width - 2 * padding);
      const ly =
        height - padding - ((lm.y - minY) / rangeY) * (height - 2 * padding);
      ctx.fillRect(lx - 1, ly - 1, 2, 2);
    });
  }, []);

  // ======================
  // CONTROL HANDLERS
  // ======================

  const handleStart = async () => {
    const success = await startCamera();
    if (success) {
      setIsRunning(true);
      lastFrameTimeRef.current = performance.now();
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    stopCamera();
  };

  const handleReset = () => {
    poseRef.current = { x: 0, y: 0, heading: 0 };
    trajectoryRef.current = [{ x: 0, y: 0 }];
    landmarksRef.current = [];
    prevFrameRef.current = null;
    prevFeaturesRef.current = null;

    setPose({ x: 0, y: 0, heading: 0 });
    setTrajectory([{ x: 0, y: 0 }]);
    setLandmarkCount(0);
    setFeatures([]);
    setGpsPath([]);
  };

  // Start processing loop when running
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(processSLAMFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, processSLAMFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // GPS tracking
  useEffect(() => {
    if (isRunning && "geolocation" in navigator) {
      const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      const successCallback = (position) => {
        const newPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        setGpsLocation(newPoint);
        setGpsError(null);
        setGpsPath((prev) => {
          if (prev.length === 0) return [newPoint];
          const last = prev[prev.length - 1];
          if (last.latitude === newPoint.latitude && last.longitude === newPoint.longitude) return prev;
          return [...prev, newPoint];
        });
      };

      const errorCallback = (error) => {
        let errorMessage = "GPS error: ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "User denied GPS access";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location unavailable";
            break;
          case error.TIMEOUT:
            errorMessage += "Request timeout";
            break;
          default:
            errorMessage += "Unknown error";
        }
        setGpsError(errorMessage);
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        options
      );
    } else if (!isRunning && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isRunning]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-purple-950 to-slate-950 text-white overflow-y-auto flex flex-col">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 p-8 md:p-10 shadow-2xl">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-lg mb-3">
                Visual SLAM
              </h2>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className="px-6 py-3 rounded-xl font-bold text-sm md:text-base bg-green-500 text-white shadow-xl hover:brightness-110 disabled:opacity-50 transition"
              >
                ▶ Start
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="px-6 py-3 rounded-xl font-bold text-sm md:text-base bg-red-500 text-white shadow-xl hover:brightness-110 disabled:opacity-50 transition"
              >
                ⏹ Stop
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 rounded-xl font-bold text-sm bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 transition"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-2 mt-6">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isRunning
                  ? "bg-green-400/30 border border-green-300 text-green-100"
                  : "bg-gray-400/20 border border-gray-300 text-gray-100"
              }`}
            >
              {isRunning ? "🟢 LIVE" : "⭕ IDLE"}
            </span>
            {sensorInfo && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-400/30 border border-blue-300 text-blue-100">
                📹 {sensorInfo}
              </span>
            )}
            {depthAvailable && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-400/30 border border-purple-300 text-purple-100">
                🔷 Depth Active
              </span>
            )}
            {error && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-400/30 border border-red-300 text-red-100">
                ⚠ ERROR
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="p-6 md:p-8 border-b border-white/10">
        <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-wider">Live Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* FPS
          <div className="bg-gradient-to-br from-cyan-600/90 to-cyan-700/70 p-5 rounded-xl border border-cyan-400/30 backdrop-blur-sm shadow-lg">
            <p className="text-cyan-100 text-[10px] uppercase font-bold tracking-wider mb-2">FPS</p>
            <p className="text-3xl font-black text-white">
              {fps.toFixed(0)}
            </p>
            <p className="text-cyan-100 text-xs mt-1 font-semibold">frames/sec</p>
          </div> */}

          {/* Landmarks */}
          <div className="bg-gradient-to-br from-purple-600/90 to-purple-700/70 p-5 rounded-xl border border-purple-400/30 backdrop-blur-sm shadow-lg">
            <p className="text-purple-100 text-[10px] uppercase font-bold tracking-wider mb-2">Landmarks</p>
            <p className="text-3xl font-black text-white">
              {landmarkCount}
            </p>
            <p className="text-purple-100 text-xs mt-1 font-semibold">detected</p>
          </div>

          {/* Pose X/Y */}
          <div className="bg-gradient-to-br from-orange-600/90 to-orange-700/70 p-5 rounded-xl border border-orange-400/30 backdrop-blur-sm shadow-lg">
            <p className="text-orange-100 text-[10px] uppercase font-bold tracking-wider mb-2">Pose X/Y</p>
            <p className="text-lg font-black text-white">
              {format2DData(pose)}
            </p>
            <p className="text-orange-100 text-xs mt-1 font-semibold">position</p>
          </div>

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 flex-1 p-6 md:p-8 min-h-0">
        {/* Camera Panel */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Camera Card */}
          <div className="bg-gradient-to-br from-purple-600/80 to-pink-600/70 p-6 rounded-2xl border border-purple-400/30 shadow-2xl overflow-hidden flex-1 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-purple-100 text-[10px] uppercase font-bold tracking-wider">Live Camera</p>
                <h3 className="text-2xl font-black text-white">Feature Detection</h3>
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] bg-red-500/30 border border-red-300 text-red-100 font-semibold">
                🔴 Obstacles
              </span>
            </div>
            <div
              className="relative w-full h-full rounded-xl overflow-hidden bg-slate-900/40"
              style={{ minHeight: "320px" }}
            >
              <video
                ref={videoRef}
                className="absolute top-0 left-0 w-full h-full opacity-0 object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="hidden"
              />
              <canvas
                ref={processCanvasRef}
                width={640}
                height={480}
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Data Panel */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Trajectory Card */}
          <div className="bg-gradient-to-br from-green-600/80 to-emerald-700/70 p-6 rounded-2xl border border-green-400/30 shadow-2xl overflow-hidden flex-1">
            <p className="text-green-100 text-[10px] uppercase font-bold tracking-wider mb-2">Path Visualization</p>
            <h3 className="text-2xl font-black text-white mb-4">SLAM Trajectory</h3>
            <div className="rounded-xl overflow-hidden border border-green-400/30 bg-slate-950 h-full">
              <PathVisualizer path={trajectory} gpsLocation={gpsLocation} gpsPath={gpsPath} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pose Card */}
            <div className="bg-gradient-to-br from-blue-600/80 to-indigo-700/70 p-6 rounded-2xl border border-blue-400/30 shadow-xl">
              <p className="text-blue-100 text-[10px] uppercase font-bold tracking-wider mb-2">Position Data</p>
              <h3 className="text-xl font-black text-white mb-4">SLAM Pose</h3>
              <div className="space-y-2">
                <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                  <div className="text-blue-100 text-[10px] uppercase font-bold tracking-wider">Coordinates (2D)</div>
                  <div className="text-lg font-black text-white mt-1">{format2DData(pose)}</div>
                  <div className="text-blue-100 text-xs mt-1">meters</div>
                </div>
              </div>
            </div>

            {/* GPS Card */}
            <div className="bg-gradient-to-br from-orange-600/80 to-amber-700/70 p-6 rounded-2xl border border-orange-400/30 shadow-xl">
              <p className="text-orange-100 text-[10px] uppercase font-bold tracking-wider mb-2">Ground Position</p>
              <h3 className="text-xl font-black text-white mb-4">GPS Position</h3>
              {gpsError ? (
                <div className="bg-red-900/30 border border-red-400/30 p-3 rounded-lg">
                  <p className="text-xs text-red-100 font-semibold">⚠ {gpsError}</p>
                </div>
              ) : gpsLocation ? (
                <div className="space-y-2">
                  <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                    <div className="text-orange-100 text-[10px] uppercase font-bold tracking-wider">Coordinates</div>
                    <div className="text-sm font-black text-white mt-1">
                      Lat: {gpsLocation.latitude.toFixed(6)}°
                    </div>
                    <div className="text-sm font-black text-white">
                      Lon: {gpsLocation.longitude.toFixed(6)}°
                    </div>
                    <div className="text-orange-100 text-xs mt-2">±{gpsLocation.accuracy.toFixed(1)}m</div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/10 border border-white/10 p-3 rounded-lg">
                  <p className="text-xs text-orange-100 font-semibold">
                    {isRunning
                      ? "📡 Acquiring GPS signal..."
                      : "▶ Start SLAM to enable GPS"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

