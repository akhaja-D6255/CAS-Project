# 🚀 SLAM Project - Advanced Spatial Navigation Lab

<div align="center">

[![React](https://img.shields.io/badge/React-19.1-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet)](https://leafletjs.com/)

**Real-time Robotics Visualization Platform**

Compare Dead Reckoning vs Visual SLAM with live camera overlays, obstacle detection, and real-world map integration.

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [API](#-api-reference)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [Modules](#-modules)
  - [Dead Reckoning](#1-dead-reckoning-module)
  - [Visual SLAM](#2-visual-slam-module)
- [Components](#-components)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Configuration](#-configuration)
- [Browser Support](#-browser-support)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**SLAM Project** is a cutting-edge web-based spatial navigation platform that enables real-time comparison between two fundamental localization techniques:

- **Dead Reckoning (DR)** - IMU-based inertial navigation using accelerometer, gyroscope, and compass sensors
- **Visual SLAM** - Camera-first Simultaneous Localization and Mapping with obstacle detection

The platform features a modern glassmorphic UI, real-world map integration via OpenStreetMap, and advanced sensor fusion algorithms.

---

## ✨ Features

### 🎨 **Modern UI/UX**

- Glassmorphic design with gradient backgrounds
- Responsive layout (mobile, tablet, desktop)
- Dark theme optimized for extended use
- Smooth transitions and animations
- Hash-based routing for deep linking

### 🗺️ **Dual Path Visualization**

- **Grid View**: Technical SVG-based trajectory with pan/zoom controls
- **Map View**: Real-world OpenStreetMap overlay showing path on actual terrain
- One-click toggle between views
- Auto-fit bounds and accuracy circles

### 📡 **Dead Reckoning Module**

- **IMU Sensor Fusion**: Accelerometer + Gyroscope + Magnetometer
- **Heading Compensation**: Drift correction using compass
- **GPS Assist**: Ground truth positioning with accuracy metrics
- **Real-time Metrics**: Velocity, position, heading display
- **Trajectory Tracking**: Live path visualization with start/current markers

### 📷 **Visual SLAM Module**

- **Camera-First Design**: Live video feed with overlay graphics
- **Obstacle Detection**: Real-time depth-based detection with accuracy tuning
  - Density threshold: 2.5 (tight clustering)
  - Depth cutoff: <1.8m (close-range obstacles)
  - Edge score: ≥15 (high confidence)
- **Feature Tracking**: Corner detection with FAST algorithm
- **Performance Monitoring**: FPS counter, landmark count, pose estimation
- **Depth/LiDAR Ready**: Integration hooks for advanced sensors

### 🛰️ **GPS Integration**

- Real-time geolocation tracking
- Accuracy visualization (circle overlay)
- Lat/Lon coordinate display
- Error handling for denied permissions

### 🎮 **Interactive Controls**

- Start/Stop/Reset functionality
- Real-time sensor data streaming
- Zoom and pan controls
- Touch gesture support (mobile)

---

## 🛠️ Technology Stack

### **Frontend Framework**

- **React 19.1** - Component-based UI library
- **Vite 7.1** - Lightning-fast build tool with HMR

### **Styling**

- **Tailwind CSS 4.1** - Utility-first CSS framework
- Custom glassmorphic components
- Responsive design utilities

### **Mapping**

- **Leaflet.js 1.9.4** - Open-source interactive maps
- **React-Leaflet 5.0** - React bindings for Leaflet
- **OpenStreetMap** - Free map tiles (no API key required)

### **Sensors & APIs**

- **Device Orientation API** - Gyroscope and magnetometer
- **Device Motion API** - Accelerometer data
- **MediaDevices API** - Camera access (getUserMedia)
- **Geolocation API** - GPS positioning

### **Development Tools**

- **ESLint** - Code quality and consistency
- **PostCSS** - CSS processing
- **Autoprefixer** - Browser compatibility

---

## 📦 Installation

### **Prerequisites**

- Node.js 18+ and npm/yarn
- Modern browser with sensor support (Chrome, Firefox, Safari)
- HTTPS connection (required for sensors and camera)

### **Steps**

```bash
# Clone the repository
git clone https://github.com/Shivam-Ramoliya/TwinTrails.git
cd TwinTrails

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### **Build for Production**

```bash
npm run build
npm run preview
```

---

## 🚀 Usage

### **1. Launch Application**

Navigate to the app URL and grant necessary permissions:

- **Camera access** (for SLAM module)
- **Motion sensors** (for both modules)
- **Location access** (for GPS features)

### **2. Choose Module**

Select from the landing page:

- **Dead Reckoning** - IMU-based navigation
- **Visual SLAM** - Camera-based mapping

### **3. Start Navigation**

Click the **Start** button to begin sensor data collection and path tracking.

### **4. View Trajectory**

Toggle between:

- **📐 Grid View** - Technical measurements
- **🗺️ Map View** - Real-world overlay (requires GPS lock)

### **5. Monitor Metrics**

Watch real-time stats:

- **DR**: Velocity, Position, Heading, GPS Status
- **SLAM**: FPS, Landmarks, Obstacles, Camera Status

---

## 🧩 Modules

### **1. Dead Reckoning Module**

**Location**: `/drmodule` or `#drmodule`

#### **Features**

- **Sensor Fusion**: Combines accelerometer, gyroscope, and compass
- **Position Estimation**: Calculates x, y coordinates from motion data
- **Heading Tracking**: Magnetic north-referenced orientation
- **GPS Ground Truth**: Compares estimated vs actual position

#### **Key Components**

```jsx
<DRModule />
  ├── Stat Strip (velocity, position, heading, GPS)
  ├── Path Trajectory Card (with map toggle)
  ├── GPS Position Card (lat/lon display)
  ├── Pose Estimation Card (heading visualization)
  └── Sensor Readings Card (raw IMU data)
```

#### **Algorithm**

```javascript
// Simplified DR calculation
velocity = previousVelocity + acceleration * dt;
position = previousPosition + velocity * dt;
heading = atan2(magnetometerY, magnetometerX);
```

---

### **2. Visual SLAM Module**

**Location**: `/slammodule` or `#slammodule`

#### **Features**

- **Live Camera Feed**: 640x480 video stream with overlay canvas
- **Obstacle Detection**: Depth-based clustering with configurable thresholds
- **Feature Extraction**: FAST corner detection (max 1500 features)
- **Trajectory Mapping**: Real-time path construction
- **Performance Optimization**: 30 FPS target with frame skipping

#### **Key Components**

```jsx
<SLAMModule />
  ├── Glass Header (with feature badges)
  ├── Stat Strip (FPS, landmarks, pose, mode)
  ├── Camera Panel (video + canvas overlay)
  ├── SLAM Trajectory Card (with map toggle)
  ├── Pose Data Card (orientation metrics)
  └── GPS Position Card (geolocation)
```

#### **Obstacle Detection Algorithm**

```javascript
// Configurable thresholds
densityThreshold = 2.5      // Higher = tighter clusters
depthCutoff = 1.8           // Meters (close-range)
edgeScoreMin = 15           // Confidence threshold

// Detection logic
1. Extract features from camera frame
2. Estimate depth from feature density
3. Cluster nearby features (DBSCAN-inspired)
4. Filter by depth and edge score
5. Render obstacles as pulsing dots
```

---

## 🧱 Components

### **Core Components**

#### **App.jsx**

- Landing page with module selection
- Hash-based routing (`#drmodule`, `#slammodule`)
- Back navigation and header management

#### **DRModule.jsx**

- IMU sensor integration
- Dead reckoning calculations
- Path trajectory visualization
- GPS tracking and display

#### **SLAMModule.jsx**

- Camera stream management
- Feature detection (FAST algorithm)
- Obstacle detection and rendering
- Trajectory estimation

#### **PathVisualizer.jsx**

- Dual-mode visualization (SVG grid + Leaflet map)
- Pan/zoom controls for grid view
- GPS coordinate conversion (meters → lat/lon)
- Auto-fit bounds for map view
- Touch gesture support

#### **SensorCard.jsx**

- Reusable sensor data display
- Color-coded metrics
- Icon support

---

## 🏗️ Architecture

### **File Structure**

```
TwinTrails/
├── public/
│   ├── LOGO2.png              # Favicon
│   ├── LOGO3.png              # Apple touch icon
│   └── manifest.json          # PWA manifest
├── src/
│   ├── components/
│   │   ├── App.jsx            # Root component + routing
│   │   ├── DRModule.jsx       # Dead Reckoning module
│   │   ├── SLAMModule.jsx     # Visual SLAM module
│   │   ├── PathVisualizer.jsx # Dual-mode path display
│   │   └── SensorCard.jsx     # Reusable sensor widget
│   ├── utils/
│   │   └── formatters.js      # Utility functions
│   ├── assets/                # Static assets
│   ├── App.css                # Component styles
│   ├── index.css              # Global styles + Leaflet overrides
│   └── main.jsx               # React entry point
├── index.html                 # HTML template
├── package.json               # Dependencies
├── vite.config.js             # Vite configuration
├── eslint.config.js           # Linting rules
└── README.md                  # Documentation
```

### **Data Flow**

```
Sensors → API → State Management → UI Components → Visualization
   ↓                                      ↓
IMU/GPS                             React Hooks
   ↓                                      ↓
Camera                              useEffect/useState
   ↓                                      ↓
Raw Data                           Processed Metrics → PathVisualizer
                                                           ↓
                                                    Grid/Map View
```

---

## 📚 API Reference

### **PathVisualizer Component**

```jsx
<PathVisualizer
  path={Array<{x: number, y: number}>}  // Trajectory points in meters
  gpsLocation={{                        // GPS reference (optional)
    latitude: number,
    longitude: number,
    accuracy: number
  }}
/>
```

**Props:**

- `path` - Array of coordinates (origin at 0,0)
- `gpsLocation` - GPS origin for map view conversion

**Features:**

- Converts local coordinates to GPS lat/lon
- Auto-switches between grid/map modes
- Renders trajectory with start/current markers

---

### **SensorCard Component**

```jsx
<SensorCard
  title="Acceleration"
  value={{ x: 0.5, y: -0.2, z: 9.8 }}
  unit="m/s²"
  icon="🚀"
/>
```

---

## ⚙️ Configuration

### **SLAM Detection Tuning**

Edit `SLAMModule.jsx`:

```javascript
// Line ~600-610: Obstacle detection thresholds
const densityThreshold = 2.5; // 2.0-3.0 (higher = fewer, tighter clusters)
const depthCutoff = 1.8; // meters (1.0-3.0 range)
const edgeScoreMin = 15; // 10-20 (higher = more confident detections)
const maxFeatures = 1500; // max features per frame (1000-2000)
```

### **Map Tiles**

Edit `PathVisualizer.jsx` to change map provider:

```jsx
// Line ~350: TileLayer URL
<TileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  // Alternative: Satellite view
  // url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
/>
```

---

## 🌐 Browser Support

| Browser | Version | Sensors | Camera | GPS |
| ------- | ------- | ------- | ------ | --- |
| Chrome  | 90+     | ✅      | ✅     | ✅  |
| Firefox | 88+     | ✅      | ✅     | ✅  |
| Safari  | 14+     | ✅      | ✅     | ✅  |
| Edge    | 90+     | ✅      | ✅     | ✅  |

**Requirements:**

- HTTPS connection (mandatory for sensors/camera)
- JavaScript enabled
- WebGL support (for canvas rendering)

---

## 🤝 Contributing

Contributions welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 👥 Contributors

This project is made possible by these amazing contributors:

<div align="center">

| Contributor            | GitHub Profile                                         |
| -------------------    | ------------------------------------------------------ |
| **Shivam Ramoliya**    | [@Shivam-Ramoliya](https://github.com/Shivam-Ramoliya) |
| **Shubham Ramoliya**   | [@SHUBHHAM-0712](https://github.com/SHUBHHAM-0712)     |
| **Ayush Chovatiya**    | [@ayush-8955](https://github.com/ayush-8955)           |
| **Archan Maru**        | [@Archan-Maru](https://github.com/Archan-Maru)         |
| **Rishabh Jalu**       | [@rishabh27112](https://github.com/rishabh27112)       |

</div>

**Repository**: [SLAM Project](https://github.com/Shivam-Ramoliya/TwinTrails)

---

## 🙏 Acknowledgments

- **Leaflet.js** - Mapping library
- **OpenStreetMap** - Free map data
- **Tailwind CSS** - Styling framework
- **React & Vite** - Development tools

---

<div align="center">

**Made with ❤️ by the SLAM Project Team**

[⬆ Back to Top](#-slam-project---advanced-spatial-navigation-lab)

</div>
