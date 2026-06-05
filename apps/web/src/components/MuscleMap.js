"use client";
import React, { useState } from "react";
import { ANTERIOR_PATHS, POSTERIOR_PATHS } from "@apex/core";
import { RECOVERY_COLOR } from "../lib/recovery";

export default function MuscleMap({ view = "front", muscleData = {}, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  const paths = view === "front" ? ANTERIOR_PATHS : POSTERIOR_PATHS;
  const viewBox = view === "front" ? "0 95 727 1280" : "696 95 727 1280";

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(m => m !== id);
      return [...prev, id];
    });
    if (onSelect) onSelect(id);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "400px", display: "flex", justifyContent: "center" }}>
      {hovered && (
         <div style={{
           position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
           background: 'rgba(0,0,0,0.8)', color: 'white', padding: '6px 14px', borderRadius: 8, fontSize: '13px',
           zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
         }}>
           <strong>{hovered.id.toUpperCase()}</strong>
         </div>
      )}
      
      <svg 
        viewBox={viewBox} 
        style={{ width: "100%", maxHeight: "600px", overflow: "visible", dropShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
      >
        <defs>
          <filter id="inner-shadow">
            <feOffset dx="0" dy="3"/>
            <feGaussianBlur stdDeviation="4" result="offset-blur"/>
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
            <feFlood floodColor="black" floodOpacity="0.4" result="color"/>
            <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
            <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
          </filter>

          <radialGradient id="muscleVol" cx="50%" cy="50%" r="50%" fx="50%" fy="40%">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="black" stopOpacity="0.4" />
          </radialGradient>
        </defs>

        {paths.map((muscle) => {
          // Prevent rendering sub-muscles over the main muscles
          if (["upperChest", "lowerChest", "innerQuad", "outerQuad", "upperAbs", "lowerAbs", "frontDeltoid"].includes(muscle.id)) {
            return null;
          }

          if (["head", "hair", "neck", "hands", "feet", "ankles"].includes(muscle.id)) {
            return <path key={muscle.id} d={muscle.d} fill="#2C2C2E" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5px" filter="url(#inner-shadow)" />;
          }

          const mData = muscleData[muscle.id] || muscleData[muscle.id.toLowerCase()];
          const status = mData ? mData.status : "fully_recovered";
          
          const isSelected = selectedIds.includes(muscle.id);
          const isHovered = hovered?.id === muscle.id;
          
          // Only apply the established soreness color when directly hovering over the muscle
          const fillColor = isHovered ? (RECOVERY_COLOR[status] || RECOVERY_COLOR.fully_recovered) : "#3A3A3C";

          const baseStyle = {
            cursor: "pointer",
            transition: "all 0.2s ease"
          };
          
          if (isHovered) {
             baseStyle.filter = "brightness(1.2)";
          } else if (isSelected) {
             baseStyle.filter = "brightness(1.1)";
          }

          return (
            <g 
                key={muscle.id} 
                onMouseEnter={() => setHovered({ id: muscle.id })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => toggleSelect(muscle.id)}
                style={baseStyle}
            >
              <path
                d={muscle.d}
                fill={fillColor}
                filter="url(#inner-shadow)"
                stroke="rgba(0,0,0,0.8)"
                strokeWidth="0.5px"
              />
              <path
                d={muscle.d}
                fill="url(#muscleVol)"
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
