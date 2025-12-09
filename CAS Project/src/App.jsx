import React, { useState } from "react";
import DRModule from "./components/DRModule";
import SLAMModule from "./components/SLAMModule";

/**
 * Landing page with module selection
 */
export default function App() {
  // Default landing module is SLAM now
  const [activeModule, setActiveModule] = useState("slam");

  // Landing page view
  if (!activeModule) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 bg-white/5 backdrop-blur-md shadow-lg tt-hero">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-8 text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow">
              Spatial Navigation Lab
            </h1>
            <p className="text-sm text-slate-300 mt-2 mx-auto max-w-2xl">
              Compare dead reckoning against visual SLAM with live camera
              overlays, depth readiness, and trajectory insights.
            </p>
            <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-white/80 justify-center">
              <span className="px-3 py-1 rounded-full bg-cyan-600/30 border border-cyan-400/50">
                Visual SLAM
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-600/30 border border-emerald-400/50">
                Dead Reckoning
              </span>
              <span className="px-3 py-1 rounded-full bg-fuchsia-600/30 border border-fuchsia-400/50">
                Depth Ready
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-slate-200">
              Choose Your Module
            </h2>
            <p className="text-center text-slate-400 mb-12 max-w-2xl mx-auto">
              Select either Dead Reckoning or Visual SLAM to explore real-time
              spatial localization and mapping.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Dead Reckoning Card */}
              <div className="group relative rounded-2xl bg-slate-900/70 border border-white/10 shadow-2xl shadow-emerald-900/30 overflow-hidden hover:border-emerald-400/40 transition-all duration-300">
                <div className="absolute inset-0 bg-linear-to-br from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-8 flex flex-col h-full">
                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300/80 mb-3">
                      Module
                    </p>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Dead Reckoning
                    </h3>
                    <p className="text-sm text-slate-300 mb-4">
                      IMU-based inertial navigation using accelerometer,
                      gyroscope, and compass for baseline localization.
                    </p>
                  </div>

                  <div className="mb-6">
                    <p className="text-xs font-semibold text-emerald-200 mb-3 uppercase tracking-wide">
                      Features
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Sensor fusion (IMU)
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Heading compensation
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        GPS ground truth
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Trajectory tracking
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setActiveModule("dr")}
                    className="mt-auto px-6 py-3 rounded-lg bg-linear-to-r from-emerald-500 to-cyan-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/30 hover:brightness-110 transition-all duration-200"
                  >
                    Explore DR
                  </button>
                </div>
              </div>

              {/* Visual SLAM Card */}
              <div className="group relative rounded-2xl bg-slate-900/70 border border-white/10 shadow-2xl shadow-cyan-900/30 overflow-hidden hover:border-cyan-400/40 transition-all duration-300">
                <div className="absolute inset-0 bg-linear-to-br from-cyan-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-8 flex flex-col h-full">
                  <div className="mb-6">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300/80 mb-3">
                      Module
                    </p>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Visual SLAM
                    </h3>
                    <p className="text-sm text-slate-300 mb-4">
                      Camera-first simultaneous localization and mapping with
                      live obstacle detection and depth sensing.
                    </p>
                  </div>

                  <div className="mb-6">
                    <p className="text-xs font-semibold text-cyan-200 mb-3 uppercase tracking-wide">
                      Features
                    </p>
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Live camera feed
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Obstacle detection
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Depth/LiDAR support
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Feature tracking
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => setActiveModule("slam")}
                    className="mt-auto px-6 py-3 rounded-lg bg-linear-to-r from-cyan-500 to-blue-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/30 hover:brightness-110 transition-all duration-200"
                  >
                    Explore SLAM
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-white/5 backdrop-blur py-6 text-center text-sm text-slate-400">
          <p>SLAM Project © 2025 | Spatial Navigation Lab</p>
        </footer>
      </div>
    );
  }

  // Module view with top navigation to switch modules
  return (
    <div className="flex-1 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen font-sans flex flex-col">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-md shadow-lg tt-hero">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModule("slam")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeModule === "slam"
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-transparent text-white/80 hover:bg-white/5"
              }`}
            >
              SLAM
            </button>

            <button
              onClick={() => setActiveModule("dr")}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeModule === "dr"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-transparent text-white/80 hover:bg-white/5"
              }`}
            >
              Dead Reckoning
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeModule === "dr" && <DRModule />}
        {activeModule === "slam" && <SLAMModule />}
      </div>
    </div>
  );
}
