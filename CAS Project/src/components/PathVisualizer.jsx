import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Fix default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/**
 * Component to auto-fit map bounds to both trajectories
 */
function MapBoundsHandler({ drPathCoords, gpsPathCoords }) {
  const map = useMap();

  useEffect(() => {
    const allCoords = [...drPathCoords, ...gpsPathCoords];
    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [drPathCoords, gpsPathCoords, map]);

  return null;
}

/**
 * Renders the calculated path with toggle between SVG and Map view.
 * @param {object} props - Component props.
 * @param {Array<object>} props.path - Array of {x, y} points (DR path).
 * @param {object} props.gpsLocation - GPS location {latitude, longitude, accuracy}.
 */
export default function PathVisualizer({ path, gpsLocation, gpsPath }) {
  // Map view state
  const [drPathCoords, setDrPathCoords] = useState([]);
  const [gpsPathCoords, setGpsPathCoords] = useState([]);
  const [mapCenter, setMapCenter] = useState([0, 0]);
  const [initialCenter, setInitialCenter] = useState(null);

  // Convert DR path (x,y in meters) to GPS coordinates
  useEffect(() => {
    if (!gpsLocation || path.length < 2) {
      setDrPathCoords([]);
      return;
    }

    // Use GPS location as origin (0,0) for DR path
    const originLat = gpsLocation.latitude;
    const originLon = gpsLocation.longitude;

    // Convert meters to lat/lon offset (approximate)
    // 1 degree latitude ≈ 111,320 meters
    // 1 degree longitude ≈ 111,320 * cos(latitude) meters
    const metersPerLatDegree = 111320;
    const metersPerLonDegree = 111320 * Math.cos((originLat * Math.PI) / 180);

    const coords = path.map((p) => {
      const lat = originLat + p.y / metersPerLatDegree;
      const lon = originLon + p.x / metersPerLonDegree;
      return [lat, lon];
    });

    setDrPathCoords(coords);

    // Set initial center to first DR-derived coordinate
    if (!initialCenter && coords.length > 0) {
      setInitialCenter(coords[0]);
      setMapCenter(coords[0]);
    }
  }, [path, gpsLocation, initialCenter]);

  // Track GPS path as user moves only when gpsPath prop isn't provided
  useEffect(() => {
    if (gpsPath && gpsPath.length > 0) return; // external gpsPath provided - skip internal tracking
    if (!gpsLocation) return;

    const newPoint = [gpsLocation.latitude, gpsLocation.longitude];

    setGpsPathCoords((prev) => {
      // Avoid duplicate points (within 0.5m accuracy)
      const isDuplicate = prev.some((point) => {
        const distance = Math.sqrt(
          Math.pow((point[0] - newPoint[0]) * 111320, 2) +
          Math.pow(
            (point[1] - newPoint[1]) *
              111320 *
              Math.cos((point[0] * Math.PI) / 180),
            2
          )
        );
        return distance < 0.5;
      });

      if (isDuplicate) return prev;
      return [...prev, newPoint];
    });

    // Update map center to current GPS position
    setMapCenter(newPoint);
  }, [gpsLocation, gpsPath]);

  return (
    <div className="bg-white/10 p-4 rounded-lg mb-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Path Comparison
        </h3>
      </div>

      {/* Map Visualization */}
      <div
        className="w-full bg-gray-800 rounded-md mt-2 overflow-hidden relative"
        style={{ height: "400px" }}
      >
        {(drPathCoords.length > 0 || (gpsPath && gpsPath.length > 0) || gpsPathCoords.length > 0) ? (
          <MapContainer
            center={mapCenter}
            zoom={18}
            className="w-full h-full"
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapBoundsHandler
              drPathCoords={drPathCoords}
              gpsPathCoords={gpsPath && gpsPath.length > 0 ? gpsPath.map(p => [p.latitude, p.longitude]) : gpsPathCoords}
            />

            {/* GPS Path (Real Path) - Blue */}
            {( (gpsPath && gpsPath.length > 1) || gpsPathCoords.length > 1) && (
              <>
                <Polyline
                  positions={gpsPath && gpsPath.length > 1 ? gpsPath.map(p => [p.latitude, p.longitude]) : gpsPathCoords}
                  pathOptions={{
                    color: "#3b82f6",
                    weight: 4,
                    opacity: 0.8,
                  }}
                />
                {/* GPS Start Point */}
                <Circle
                  center={(gpsPath && gpsPath.length > 0) ? [gpsPath[0].latitude, gpsPath[0].longitude] : gpsPathCoords[0]}
                  radius={2}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
                {/* GPS Current Point */}
                <Circle
                  center={(gpsPath && gpsPath.length > 0) ? [gpsPath[gpsPath.length - 1].latitude, gpsPath[gpsPath.length - 1].longitude] : gpsPathCoords[gpsPathCoords.length - 1]}
                  radius={3}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              </>
            )}

            {/* DR Path (Dead Reckoning) - Green */}
            {drPathCoords.length > 1 && (
              <>
                <Polyline
                  positions={drPathCoords}
                  pathOptions={{
                    color: "#10b981",
                    weight: 4,
                    opacity: 0.8,
                    dashArray: "10, 5",
                  }}
                />
                {/* DR Start Point */}
                <Circle
                  center={drPathCoords[0]}
                  radius={2}
                  pathOptions={{
                    color: "#10b981",
                    fillColor: "#10b981",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
                {/* DR Current Point */}
                <Circle
                  center={drPathCoords[drPathCoords.length - 1]}
                  radius={3}
                  pathOptions={{
                    color: "#10b981",
                    fillColor: "#10b981",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              </>
            )}
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
            <p className="text-gray-400 text-sm">
              {gpsLocation
                ? "Waiting for movement data..."
                : "Waiting for GPS signal..."}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
        <div className="flex items-center gap-4">
          <span>
            <span className="w-3 h-0.5 inline-block bg-blue-500 mr-1"></span>
            Estimated Path
          </span>
        </div>
        <div className="text-gray-500">Use map controls to navigate</div>
      </div>
    </div>
  );
}
