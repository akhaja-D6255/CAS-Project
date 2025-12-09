import React, { useState, useEffect, useCallback, useRef } from "react";
import SensorCard from "./SensorCard";
import PathVisualizer from "./PathVisualizer";
import { formatSensorData, format2DData } from "../utils/formatters";

/**
 * DRModule - Dead Reckoning Module
 * Uses IMU sensors (accelerometer, gyroscope, compass) for position tracking
 */
export default function DRModule() {
    // Raw sensor data
    const [accelerometerData, setAccelerometerData] = useState(null);
    const [gyroscopeData, setGyroscopeData] = useState(null);

    // Dead Reckoning state
    const [velocity, setVelocity] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [path, setPath] = useState([{ x: 0, y: 0 }]);
    const [heading, setHeading] = useState(0);

    // GPS state
    const [gpsLocation, setGpsLocation] = useState(null);
    const [gpsError, setGpsError] = useState(null);
    const [gpsPath, setGpsPath] = useState([]); // explicit GPS trajectory
    const watchIdRef = useRef(null);

    // System state
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [error, setError] = useState(null);
    const [isCalibrating, setIsCalibrating] = useState(false);

    // Refs for DR state
    const velRef = useRef(velocity);
    const posRef = useRef(position);
    const pathRef = useRef(path);
    const headingRef = useRef(heading);
    const lastTimestampRef = useRef(null);
    const stationaryCountRef = useRef(0);
    const accelBiasRef = useRef({ x: 0, y: 0 });
    const compassFilterRef = useRef({ lastValue: null, alpha: 0.2 });

    // Update refs whenever state changes
    useEffect(() => {
        velRef.current = velocity;
    }, [velocity]);
    useEffect(() => {
        posRef.current = position;
    }, [position]);
    useEffect(() => {
        pathRef.current = path;
    }, [path]);
    useEffect(() => {
        headingRef.current = heading;
    }, [heading]);

    // Handle device orientation (compass)
    const handleDeviceOrientation = useCallback((event) => {
        const alpha = event.alpha ?? event.webkitCompassHeading;
        const beta = event.beta;
        const gamma = event.gamma;

        if (
            typeof alpha === "number" &&
            !Number.isNaN(alpha) &&
            typeof beta === "number" &&
            !Number.isNaN(beta) &&
            typeof gamma === "number" &&
            !Number.isNaN(gamma)
        ) {
            let compensatedHeading = alpha;

            // Tilt compensation
            if (Math.abs(beta) > 5 || Math.abs(gamma) > 5) {
                const betaRad = beta * (Math.PI / 180);
                const gammaRad = gamma * (Math.PI / 180);
                const cosB = Math.cos(betaRad);
                const sinB = Math.sin(betaRad);
                const cosG = Math.cos(gammaRad);
                const sinG = Math.sin(gammaRad);

                compensatedHeading =
                    Math.atan2(
                        sinG * cosB * Math.cos((alpha * Math.PI) / 180) +
                        sinB * Math.sin((alpha * Math.PI) / 180),
                        cosG * Math.cos((alpha * Math.PI) / 180)
                    ) *
                    (180 / Math.PI);

                compensatedHeading = (compensatedHeading + 360) % 360;
            }

            // Low-pass filter
            if (compassFilterRef.current.lastValue === null) {
                compassFilterRef.current.lastValue = compensatedHeading;
            } else {
                const alpha = compassFilterRef.current.alpha;
                const filtered =
                    alpha * compensatedHeading +
                    (1 - alpha) * compassFilterRef.current.lastValue;
                compassFilterRef.current.lastValue = filtered;
                compensatedHeading = filtered;
            }

            // Handle iOS vs Android
            if (event.webkitCompassHeading !== undefined) {
                compensatedHeading = 360 - compensatedHeading;
            } else if (window.screen && window.screen.orientation) {
                const screenOrientation = window.screen.orientation.angle || 0;
                compensatedHeading = (compensatedHeading + screenOrientation) % 360;
            }

            // Detect interference
            const variationThreshold = 20;
            const previousHeading = headingRef.current;
            if (Math.abs(compensatedHeading - previousHeading) > variationThreshold) {
                setIsCalibrating(true);
                setTimeout(() => setIsCalibrating(false), 2000);
            }

            setHeading(compensatedHeading);
        }
    }, []);

    // Handle device motion (acceleration & rotation)
    const handleDeviceMotion = useCallback((event) => {
        // Raw acceleration for display
        if (event.accelerationIncludingGravity) {
            const { x, y, z } = event.accelerationIncludingGravity;
            setAccelerometerData({ x, y, z });
        }

        // Rotation rate for display
        if (event.rotationRate) {
            const { alpha, beta, gamma } = event.rotationRate;
            setGyroscopeData({
                alpha: (alpha || 0) * (180 / Math.PI),
                beta: (beta || 0) * (180 / Math.PI),
                gamma: (gamma || 0) * (180 / Math.PI),
            });
        }

        // Linear acceleration for DR
        const acc = event.acceleration;
        if (!acc) return;

        const now =
            typeof event.timeStamp === "number" ? event.timeStamp : performance.now();
        if (lastTimestampRef.current === null) {
            lastTimestampRef.current = now;
            return;
        }

        const deltaTime = (now - lastTimestampRef.current) / 1000.0;
        if (deltaTime <= 0 || deltaTime < 0.001) return;
        lastTimestampRef.current = now;

        const axRaw = acc.x || 0;
        const ayRaw = acc.y || 0;

        // Stationary detection
        const accMag2D = Math.hypot(axRaw, ayRaw);
        const stationaryThreshold = 0.12;
        const stationarySamplesRequired = 6;

        if (accMag2D < stationaryThreshold) {
            stationaryCountRef.current += 1;
        } else {
            stationaryCountRef.current = 0;
        }

        if (stationaryCountRef.current >= stationarySamplesRequired) {
            accelBiasRef.current.x = accelBiasRef.current.x * 0.8 + axRaw * 0.2;
            accelBiasRef.current.y = accelBiasRef.current.y * 0.8 + ayRaw * 0.2;
            velRef.current = { x: 0, y: 0 };
            setVelocity(velRef.current);
            return;
        }

        // Bias correction
        const axUnbiased = axRaw - accelBiasRef.current.x;
        const ayUnbiased = ayRaw - accelBiasRef.current.y;

        // Deadzone
        const deadzone = 0.05;
        const ax = Math.abs(axUnbiased) > deadzone ? axUnbiased : 0;
        const ay = Math.abs(ayUnbiased) > deadzone ? ayUnbiased : 0;

        // Rotate to world frame
        const headingRad = (headingRef.current || 0) * (Math.PI / 180);
        const worldAx = ax * Math.cos(headingRad) + ay * Math.sin(headingRad);
        const worldAy = -ax * Math.sin(headingRad) + ay * Math.cos(headingRad);

        // Integrate velocity with damping
        const damping = 1.0;
        const newVelX =
            (velRef.current.x + worldAx * deltaTime) * Math.exp(-damping * deltaTime);
        const newVelY =
            (velRef.current.y + worldAy * deltaTime) * Math.exp(-damping * deltaTime);

        // Integrate position
        const newPosX = posRef.current.x + newVelX * deltaTime;
        const newPosY = posRef.current.y + newVelY * deltaTime;

        velRef.current = { x: newVelX, y: newVelY };
        posRef.current = { x: newPosX, y: newPosY };

        setVelocity(velRef.current);
        setPosition(posRef.current);

        const newPath = [...pathRef.current, { x: newPosX, y: newPosY }];
        pathRef.current = newPath;
        setPath(newPath);
    }, []);

    // Start monitoring
    const startMonitoring = async () => {
        setError(null);
        lastTimestampRef.current = null;
        try {
            let motionGranted = false;
            let orientationGranted = false;

            if (typeof DeviceMotionEvent.requestPermission === "function") {
                const motionPermission = await DeviceMotionEvent.requestPermission();
                if (motionPermission === "granted") {
                    motionGranted = true;
                }
            } else {
                motionGranted = true;
            }

            if (typeof DeviceOrientationEvent.requestPermission === "function") {
                const orientationPermission =
                    await DeviceOrientationEvent.requestPermission();
                if (orientationPermission === "granted") {
                    orientationGranted = true;
                }
            } else {
                orientationGranted = true;
            }

            if (motionGranted && orientationGranted) {
                window.addEventListener("devicemotion", handleDeviceMotion);
                window.addEventListener("deviceorientation", handleDeviceOrientation);
                setIsMonitoring(true);
            } else {
                setError("Permission to access one or more sensors was denied.");
            }
        } catch (err) {
            setError(`Error starting sensor monitoring: ${err.message}`);
            console.error(err);
        }
    };

    // Stop monitoring
    const stopMonitoring = () => {
        window.removeEventListener("devicemotion", handleDeviceMotion);
        window.removeEventListener("deviceorientation", handleDeviceOrientation);
        setIsMonitoring(false);
        lastTimestampRef.current = null;
    };

    // Clear path
    const clearPath = () => {
        setVelocity({ x: 0, y: 0 });
        setPosition({ x: 0, y: 0 });
        setPath([{ x: 0, y: 0 }]);
        setGpsPath([]);
        lastTimestampRef.current = null;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener("devicemotion", handleDeviceMotion);
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [handleDeviceMotion, handleDeviceOrientation]);

    // GPS tracking
    useEffect(() => {
        if (isMonitoring && "geolocation" in navigator) {
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
                // Append to explicit GPS path for reliable plotting
                setGpsPath((prev) => {
                    if (prev.length === 0) return [newPoint];
                    const last = prev[prev.length - 1];
                    if (
                        last.latitude === newPoint.latitude &&
                        last.longitude === newPoint.longitude
                    ) {
                        return prev;
                    }
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
        } else if (!isMonitoring && watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [isMonitoring]);

    return (
        <div className="bg-gradient-to-br from-blue-950 via-purple-950 to-slate-950 text-white overflow-y-auto flex flex-col h-full">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-orange-500 p-8 md:p-10 shadow-2xl">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="flex-1">
                            <h2 className="text-4xl md:text-5xl font-black text-white drop-shadow-lg mb-3">
                                Dead Reckoning
                            </h2>
                           
                        </div>

                        <div className="flex flex-col gap-3 md:items-end">
                            <button
                                onClick={isMonitoring ? stopMonitoring : startMonitoring}
                                className={`px-6 py-3 rounded-xl font-bold text-sm md:text-base shadow-xl transition transform hover:scale-105 ${isMonitoring
                                        ? "bg-red-500 text-white shadow-red-500/40"
                                        : "bg-green-500 text-white shadow-green-500/40"
                                    }`}
                            >
                                {isMonitoring ? "⏹ Stop Sensors" : "▶ Start Sensors"}
                            </button>
                            <button
                                onClick={clearPath}
                                className="px-6 py-2 rounded-xl font-bold text-sm bg-white/10 border-2 border-white/30 text-white hover:bg-white/20 transition"
                            >
                                🔄 Reset
                            </button>
                        </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2 mt-6">
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${isMonitoring
                                    ? "bg-green-400/30 border border-green-300 text-green-100"
                                    : "bg-gray-400/20 border border-gray-300 text-gray-100"
                                }`}
                        >
                            {isMonitoring ? "🟢 LIVE" : "⭕ IDLE"}
                        </span>
                        {gpsLocation && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-400/30 border border-yellow-300 text-yellow-100">
                                📡 GPS LOCKED
                            </span>
                        )}
                        {isCalibrating && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-400/30 border border-orange-300 text-orange-100">
                                ⚙ CALIBRATING
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

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 md:px-8 py-6 bg-gradient-to-b from-white/5 to-transparent">
                <div className="rounded-lg bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/30 p-4 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-cyan-300 opacity-70 mb-1">Velocity</div>
                    <div className="text-xl font-black text-cyan-200">{format2DData(velocity)}</div>
                    <div className="text-[10px] text-cyan-300/60 mt-1">m/s</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/30 p-4 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-purple-300 opacity-70 mb-1">Position</div>
                    <div className="text-xl font-black text-purple-200">{format2DData(position)}</div>
                    <div className="text-[10px] text-purple-300/60 mt-1">m</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-orange-900/40 to-red-900/40 border border-orange-500/30 p-4 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-orange-300 opacity-70 mb-1">Heading</div>
                    <div className="text-3xl font-black text-orange-200">{(heading ?? 0).toFixed(0)}°</div>
                    <div className="text-[10px] text-orange-300/60 mt-1">compass</div>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-500/30 p-4 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-green-300 opacity-70 mb-1">GPS Status</div>
                    <div className="text-xl font-black text-green-200">{gpsLocation ? "✓ Active" : "⟳ Pending"}</div>
                    <div className="text-[10px] text-green-300/60 mt-1">{gpsPath.length} pts</div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 md:p-8 min-h-0">
                {/* LEFT: Map */}
                <div className="flex flex-col gap-4 min-h-0">
                    <div className="bg-gradient-to-br from-slate-800/60 to-purple-900/40 border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden flex-1 min-h-0 backdrop-blur-sm">
                        <div className="px-5 py-4 bg-gradient-to-r from-purple-700/30 to-pink-700/20 border-b border-purple-500/20 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-purple-300">
                                    Navigation Map
                                </p>
                                <h3 className="text-xl font-black text-white mt-1">Trajectory Comparison</h3>
                            </div>
                        </div>
                        <div className="p-3">
                            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                                <PathVisualizer path={path} gpsLocation={gpsLocation} gpsPath={gpsPath} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/60 to-green-900/40 border border-green-500/20 rounded-2xl shadow-xl p-5 backdrop-blur-sm">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-green-300 mb-1">
                            Ground Position
                        </p>
                        <h3 className="text-xl font-black text-white mb-3">GPS Position</h3>
                        {gpsError ? (
                            <div className="bg-red-900/30 border border-red-500/40 p-4 rounded-lg">
                                <p className="text-sm text-red-100 font-semibold">⚠ {gpsError}</p>
                            </div>
                        ) : gpsLocation ? (
                            <div className="space-y-3">
                                <div className="bg-white/5 rounded-lg p-3 border border-green-500/20">
                                    <p className="text-[10px] uppercase font-bold text-green-300 mb-1">Latitude / Longitude</p>
                                    <p className="text-sm font-mono text-white">{gpsLocation.latitude.toFixed(6)}° / {gpsLocation.longitude.toFixed(6)}°</p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg">
                                <p className="text-sm text-yellow-100 font-semibold">
                                    {isMonitoring
                                        ? "🛰 Acquiring GPS signal..."
                                        : "Start sensors to enable GPS"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Sensors & Pose Details */}
                <div className="overflow-y-auto flex flex-col gap-4 min-h-0">
                    <div className="bg-gradient-to-br from-slate-800/60 to-blue-900/40 border border-blue-500/20 rounded-2xl shadow-xl p-5 backdrop-blur-sm">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-blue-300 mb-1">
                            Measured Pose
                        </p>
                        <h3 className="text-xl font-black text-white mb-3">Position & Velocity</h3>
                        <div className="space-y-3">
                            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/20">
                                <p className="text-[10px] uppercase font-bold text-blue-300">Position (X, Y)</p>
                                <p className="text-lg font-mono font-bold text-blue-200 mt-1">{format2DData(position)}</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-cyan-500/20">
                                <p className="text-[10px] uppercase font-bold text-cyan-300">Velocity (X, Y)</p>
                                <p className="text-lg font-mono font-bold text-cyan-200 mt-1">{format2DData(velocity)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-800/60 to-orange-900/40 border border-orange-500/20 rounded-2xl shadow-xl p-5 backdrop-blur-sm">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-orange-300 mb-1">
                            Inertial Sensors
                        </p>
                        <h3 className="text-xl font-black text-white mb-3">Accelerometer & Gyroscope</h3>
                        <div className="space-y-3">
                            <div className="bg-white/5 rounded-lg p-3 border border-orange-500/20">
                                <p className="text-[10px] uppercase font-bold text-orange-300">Accelerometer</p>
                                <p className="text-sm font-mono text-orange-200 mt-1">{formatSensorData(accelerometerData) || "--"}</p>
                                <p className="text-[9px] text-orange-300/60 mt-1">m/s²</p>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 border border-red-500/20">
                                <p className="text-[10px] uppercase font-bold text-red-300">Gyroscope</p>
                                <p className="text-sm font-mono text-red-200 mt-1">{formatSensorData(gyroscopeData) || "--"}</p>
                                <p className="text-[9px] text-red-300/60 mt-1">°/s</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
