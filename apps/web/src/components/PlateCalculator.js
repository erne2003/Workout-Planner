"use client";
import { useState, useEffect } from "react";
import { useSettings } from "../contexts/SettingsContext";

export default function PlateCalculator() {
  const [targetWeight, setTargetWeight] = useState(135);
  const [plates, setPlates] = useState([]);
  
  const ctx = useSettings();
  const unit = ctx?.weightUnit || "lbs";
  const barWeight = ctx?.barWeight || 45;

  const calculatePlates = (target, bar) => {
    let weightPerSide = (target - bar) / 2;
    if (weightPerSide <= 0) {
      setPlates([]);
      return;
    }

    const standardPlates = unit === "lbs" 
      ? [45, 35, 25, 10, 5, 2.5] 
      : [25, 20, 15, 10, 5, 2.5, 1.25];
    
    const needed = [];
    let remaining = weightPerSide;

    standardPlates.forEach(plate => {
      const count = Math.floor(remaining / plate);
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          needed.push(plate);
        }
        remaining -= count * plate;
      }
    });

    setPlates(needed);
  };

  useEffect(() => {
    const t = setTimeout(() => calculatePlates(targetWeight, barWeight), 0);
    return () => clearTimeout(t);
  }, [targetWeight, barWeight]);

  return (
    <div 
      className="glass-card animate-fade-up"
      style={{
        padding: "24px 20px",
        marginBottom: "32px",
        marginTop: "16px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div style={{ 
            fontSize: "11px", 
            fontWeight: 700, 
            color: "var(--text-tertiary)", 
            textTransform: "uppercase", 
            letterSpacing: "1.4px", 
            marginBottom: "4px" 
          }}>
            Plate Calculator
          </div>
          <h3 style={{ 
            fontFamily: "var(--font-display)", 
            fontSize: "20px", 
            fontWeight: 800, 
            letterSpacing: "-0.5px" 
          }}>
            Load Your Bar
          </h3>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ 
            fontSize: "10px", 
            fontWeight: 700, 
            color: "var(--text-tertiary)", 
            textTransform: "uppercase", 
            letterSpacing: "0.8px", 
            marginBottom: "6px" 
          }}>
            Target ({unit})
          </div>
          <input 
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(parseFloat(e.target.value) || 0)}
            style={{
              width: "90px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "10px 14px",
              textAlign: "right",
              fontFamily: "var(--font-display)",
              fontSize: "22px",
              fontWeight: 900,
              color: "var(--accent-blue)",
              outline: "none"
            }}
          />
        </div>
      </div>

      {/* Visual Display Area */}
      <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1.2px" }}>
          Plates Per Side
        </span>
      </div>
      <div 
        style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          gap: "10px", 
          alignItems: "center", 
          justifyContent: "center", 
          minHeight: "80px", 
          padding: "20px", 
          background: "var(--bg-card)", 
          borderRadius: "16px", 
          border: "1px solid var(--border)",
          boxShadow: "inset 0 4px 12px rgba(0,0,0,0.1)"
        }}
      >
        {plates.length === 0 ? (
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontStyle: "italic", fontWeight: 500 }}>
            Enter a weight higher than {barWeight}{unit}
          </span>
        ) : (
          plates.map((p, i) => (
            <div 
              key={i} 
              className="animate-fade-in"
              style={{
                width: p >= 45 ? '54px' : p >= 25 ? '48px' : '42px',
                height: p >= 45 ? '54px' : p >= 25 ? '48px' : '42px',
                borderRadius: "50%",
                background: p >= 45 ? "#0a0a14" : p >= 25 ? "#181825" : "#242435",
                border: `2.5px solid ${p >= 45 ? 'var(--accent-blue)' : p >= 25 ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)'}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontSize: "12px",
                fontWeight: 900,
                color: "#fff",
                boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
                transition: "transform 0.2s"
              }}
            >
              {p}
            </div>
          ))
        )}
      </div>

      {/* Footer Info Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", padding: "0 4px" }}>
        <div style={{ display: "flex", gap: "24px" }}>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>Bar</div>
            <div style={{ fontSize: "13px", fontWeight: 800, fontFamily: "var(--font-display)" }}>{barWeight} <span style={{fontSize: "10px", color: "var(--text-tertiary)"}}>{unit}</span></div>
          </div>
          <div>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>One Side</div>
            <div style={{ fontSize: "13px", fontWeight: 800, fontFamily: "var(--font-display)" }}>{Math.max(0, (targetWeight - barWeight) / 2).toFixed(1)} <span style={{fontSize: "10px", color: "var(--text-tertiary)"}}>{unit}</span></div>
          </div>
        </div>

        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "6px", 
          background: "rgba(48,209,88,0.1)", 
          padding: "6px 12px", 
          borderRadius: "10px", 
          border: "1px solid rgba(48,209,88,0.2)" 
        }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#30D158", boxShadow: "0 0 8px #30D158" }} />
          <span style={{ fontSize: "10px", fontWeight: 900, color: "#30D158", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ready</span>
        </div>
      </div>
    </div>
  );
}
