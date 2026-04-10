"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ANTERIOR_PATHS, POSTERIOR_PATHS } from "../lib/muscle-paths";

/**
 * RECOVERY COLORS (Project Index)
 */
const RECOVERY_COLOR = {
  fully_recovered:     "#30D158",
  mostly_recovered:    "#FFD60A",
  partially_recovered: "#FF9F0A",
  not_recovered:       "#FF2D55",
  none: "rgba(255,255,255,0.08)"
};

export default function BodyMap({ muscleData = {}, onMuscleClick, size = 300 }) {
  const [view, setView] = useState("front"); // "front" or "back"
  const [showAdvanced, setShowAdvanced] = useState(true);

  const getGradientId = (muscleId) => {
    const d = muscleData[muscleId.toLowerCase()];
    if (!d) return "freshGradient";
    // Map pct (recovery) to fatigueScore (100 - pct)
    const fatigue = 100 - d.pct;
    if (fatigue >= 60) return "soreGradient";
    if (fatigue >= 30) return "midGradient";
    return "freshGradient";
  };

  const currentPaths = view === "front" ? ANTERIOR_PATHS : POSTERIOR_PATHS;

  return (
    <div style={{ position: "relative", width: size, height: size * 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Tool Overlay */}
      <div style={{ position: "absolute", top: 10, right: -50, display: "flex", flexDirection: "column", gap: "10px", zIndex: 10 }}>
        <button
            onClick={() => setView(view === "front" ? "back" : "front")}
            className="anatomy-tool-btn"
            title="Turn Over"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-5v5h5" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 5v-5h-5" />
            </svg>
        </button>
        <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`anatomy-tool-btn ${showAdvanced ? "active" : ""}`}
            title="Advanced Detail"
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showAdvanced ? "#30D158" : "#fff"} strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                <circle cx="12" cy="12" r="3" fill={showAdvanced ? "#30D158" : "none"} stroke="none" />
            </svg>
        </button>
      </div>

      {/* Main SVG Map */}
      <svg
        viewBox="30 15 200 950"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ filter: "drop-shadow(0 0 20px rgba(0,0,0,0.5))" }}
      >
        <defs>
          {/* SORE: Red center to Dark Red edge */}
          <radialGradient id="soreGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#FF2D55" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#800000" />
          </radialGradient>

          {/* MID: Yellow center to Amber edge */}
          <radialGradient id="midGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#FFD60A" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FF9F0A" />
          </radialGradient>

          {/* FRESH: White/Light Grey center to Slate edge */}
          <radialGradient id="freshGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#F2F2F7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#48484A" />
          </radialGradient>

          <filter id="pro-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Body Shell (Silhouette) */}
        <path 
            d="M130,20 Q100,20 90,60 L80,120 Q50,130 40,160 L50,450 L70,700 L80,950 H180 L190,700 L210,450 L220,160 Q210,130 180,120 L170,60 Q160,20 130,20 Z" 
            fill="rgba(255,255,255,0.02)" 
            stroke="rgba(255,255,255,0.05)" 
            strokeWidth="1" 
        />

        {currentPaths.map((muscle, idx) => (
            <g 
                key={`${view}-${muscle.id}-${idx}`}
                onClick={() => onMuscleClick && onMuscleClick(muscle.id)}
                className="muscle-pro-group"
                style={{ 
                    cursor: onMuscleClick ? "pointer" : "default",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                }}
            >
                <motion.path
                    id={muscle.id}
                    d={muscle.d}
                    initial={false}
                    animate={{ fill: `url(#${getGradientId(muscle.id)})` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    stroke="#1a202c"
                    strokeWidth="1.5"
                    className="muscle-pro-path"
                />
                
                {/* Anatomical Details (Fiber Lines) */}
                {showAdvanced && muscle.detail && muscle.detail.map((dd, i) => (
                    <path
                        key={i}
                        d={dd}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="0.6"
                        fill="none"
                        pointerEvents="none"
                    />
                ))}
            </g>
        ))}
      </svg>

      <style jsx>{`
        .anatomy-tool-btn {
            width: 40px;
            height: 40px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            backdrop-filter: blur(12px);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .anatomy-tool-btn:hover {
            background: rgba(255,255,255,0.12);
            border-color: rgba(255,255,255,0.25);
            transform: translateY(-2px);
        }
        .anatomy-tool-btn.active {
            background: rgba(48, 209, 88, 0.1);
            border-color: rgba(48, 209, 88, 0.4);
            box-shadow: 0 0 15px rgba(48, 209, 88, 0.2);
        }
        .muscle-pro-group:hover .muscle-pro-path {
            filter: brightness(1.3) saturate(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.2));
            stroke: #fff;
            stroke-width: 1.5px;
        }
      `}</style>

    </div>
  );
}
