"use client";
import { useEffect, useState, useCallback } from "react";
import PageShell from "../../components/PageShell";
import {
  RECOVERY_COLOR,
  RECOVERY_LABEL,
  getLastWorkoutTime,
  setLastWorkoutTime,
  getMuscleSoreness,
  setMuscleSoreness,
  computeRecovery,
  computeDynamicRecovery,
  computeMuscleReadiness,
  parseLocalISO,
} from "../../lib/recovery";
import { useData } from "../../contexts/DataContext";
import MuscleMap from "../../components/MuscleMap";
import { ANTERIOR_PATHS, POSTERIOR_PATHS } from "@apex/core";

const ALL_MUSCLES = [
  ...new Set([...ANTERIOR_PATHS, ...POSTERIOR_PATHS].map(p => p.id))
];

/* ─── Legend Dot ────────────────────────────────────────────── */
function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color }} />
      <small style={{ color: "#8E8E93" }}>{label}</small>
    </div>
  );
}

/* ─── Soreness Picker ───────────────────────────────────────── */
const SORENESS_LEVELS = ["fully_recovered", "mostly_recovered", "partially_recovered", "not_recovered"];

function SorenessPicker({ current, muscle, onSelect, onClear }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        alignItems: "center",
        marginTop: "8px",
        paddingTop: "8px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginRight: "2px" }}>
        Override
      </span>
      {SORENESS_LEVELS.map((level) => {
        const color = RECOVERY_COLOR[level];
        const isActive = current === level;
        return (
          <button
            key={level}
            onClick={() => isActive ? onClear(muscle) : onSelect(muscle, level)}
            style={{
              flex: 1,
              padding: "5px 0",
              borderRadius: "8px",
              border: `1px solid ${isActive ? color : "rgba(255,255,255,0.08)"}`,
              background: isActive ? `${color}20` : "transparent",
              color: isActive ? color : "var(--text-tertiary)",
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              cursor: "pointer",
              transition: "all 0.18s",
            }}
          >
            {RECOVERY_LABEL[level]}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Muscle Row ────────────────────────────────────────────── */
function MuscleRow({ name, data, manualLevel, onSelect, onClear, delay }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const color = RECOVERY_COLOR[data.status];
  const hours = data.hours ?? 0;
  const hoursLabel = hours >= 24
    ? `${Math.round(hours)}h ago`
    : hours >= 1
    ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m ago`
    : "just now";

  return (
    <div
      className={`animate-fade-up delay-${delay}`}
      style={{
        padding: "12px 14px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${data.isManual ? `${color}30` : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {/* Top row */}
      <div
        style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "capitalize" }}>
              {name}
            </span>
            {data.isManual && (
              <span style={{ fontSize: "9px", color, opacity: 0.7 }}>✎ manual</span>
            )}
          </div>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
            {data.isManual ? "Manual override active" : hoursLabel}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color,
              padding: "2px 6px",
              borderRadius: "999px",
              background: `${color}18`,
              border: `1px solid ${color}40`,
            }}
          >
            {RECOVERY_LABEL[data.status]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "14px",
              fontWeight: 800,
              color,
            }}
          >
            {data.pct}%
          </span>
          {/* Chevron */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}
          >
            <path d="M2 4l4 4 4-4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bar-track" style={{ height: "5px", marginTop: "10px" }}>
        <div
          className="bar-fill"
          style={{
            width: mounted ? `${data.pct}%` : "0%",
            background: color,
          }}
        />
      </div>

      {/* Soreness picker (collapsible) */}
      {open && (
        <SorenessPicker
          current={manualLevel}
          muscle={name}
          onSelect={onSelect}
          onClear={onClear}
        />
      )}
    </div>
  );
}

/* ─── Overall Score Ring ────────────────────────────────────── */
function OverallScore({ muscleData }) {
  const { score } = computeMuscleReadiness(muscleData);
  const color = score >= 75 ? "#30D158" : score >= 50 ? "#FF9F0A" : "#FF2D55";
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - score / 100);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block", width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke={color} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.4,0.64,1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, color, letterSpacing: "-1px", lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            Overall
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Hours-since label ─────────────────────────────────────── */
function LastWorkoutBanner({ lastTime, onReset }) {
  if (!lastTime) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontSize: "12px",
          color: "var(--text-tertiary)",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>No workout logged yet</span>
        <button
          onClick={onReset}
          style={{
            fontSize: "11px",
            color: "#0A84FF",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Log now
        </button>
      </div>
    );
  }
  const hours = (Date.now() - lastTime.getTime()) / 3_600_000;
  const hLabel = hours >= 24
    ? `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`
    : `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "12px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: "12px",
        color: "var(--text-secondary)",
        marginBottom: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>Last workout <strong style={{ color: "var(--text-primary)" }}>{hLabel} ago</strong></span>
      <button
        onClick={onReset}
        style={{
          fontSize: "11px",
          color: "#FF9F0A",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Reset
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function RecoveryPage() {
  const [lastTime, setLastTimeState] = useState(null);
  const [manualOverrides, setManualOverrides] = useState({});
  const [muscleData, setMuscleData] = useState({});
  const [view, setView] = useState("front");

  const { workouts: data, loading } = useData();

  const updateHeatmap = useCallback(() => {
    try {
      if (!data) return;

      const overrides = getMuscleSoreness();
      setManualOverrides(overrides);

      let latestTime = 0;
      data.forEach(w => {
        const wTime = parseLocalISO(w.created_at);
        if (wTime > latestTime) latestTime = wTime;
      });
      setLastTimeState(latestTime > 0 ? new Date(latestTime) : null);

      const dynData = computeDynamicRecovery(ALL_MUSCLES, data, overrides);
      setMuscleData(dynData);
    } catch (e) {
      console.error("Failed to compute heatmap data", e);
    }
  }, [data]);

  useEffect(() => { updateHeatmap(); }, [updateHeatmap]);

  const handleSelect = (muscle, level) => {
    setMuscleSoreness(muscle, level);
    updateHeatmap();
  };

  const handleClear = (muscle) => {
    setMuscleSoreness(muscle, null);
    updateHeatmap();
  };

  const handleReset = () => {
    // Navigates to workout page for logging
    window.location.href = "/workout";
  };

  const sortedMuscles = [...ALL_MUSCLES].sort(
    (a, b) => (muscleData[a]?.pct ?? 0) - (muscleData[b]?.pct ?? 0)
  );

  return (
    <PageShell title="Recovery" subtitle="Muscle Readiness · Today">
      {/* ── Last workout banner ───────────────────────────── */}
      {loading.workouts ? (
        <div className="glass-card skeleton" style={{ height: "40px", marginBottom: "14px", borderRadius: "12px" }} />
      ) : (
        <LastWorkoutBanner lastTime={lastTime} onReset={handleReset} />
      )}

      {/* ── Hero Card: Body Map + Score ───────────────────── */}
      {loading.workouts ? (
        <div className="glass-card skeleton" style={{ height: "450px", padding: "20px", marginBottom: "12px", borderRadius: "22px" }} />
      ) : (
        <div className="glass-card animate-fade-up delay-1" style={{ padding: "20px", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>
                Muscle Readiness
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
                Tap a muscle row to set soreness
              </div>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
                <button 
                  onClick={() => setView("front")}
                  style={{
                    background: view === "front" ? "#0A84FF" : "transparent",
                    border: "none", color: view === "front" ? "#fff" : "var(--text-primary)", padding: "4px 12px", borderRadius: "6px",
                    fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s ease"
                  }}
                >
                  Front
                </button>
                <button 
                  onClick={() => setView("back")}
                  style={{
                    background: view === "back" ? "#0A84FF" : "transparent",
                    border: "none", color: view === "back" ? "#fff" : "var(--text-primary)", padding: "4px 12px", borderRadius: "6px",
                    fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s ease"
                  }}
                >
                  Back
                </button>
              </div>
            </div>
            <OverallScore muscleData={muscleData} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px", width: "100%", overflow: "visible" }}>
            <MuscleMap muscleData={muscleData} view={view} onSelect={(id) => {
                const el = document.getElementById(`muscle-row-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
            <LegendDot color="#30D158" label="Fresh" />
            <LegendDot color="#FF9F0A" label="Recovering" />
            <LegendDot color="#FF2D55" label="Taxed" />
          </div>
        </div>
      )}

      {/* ── AI Recommendation Card ────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-2"
        style={{ padding: "16px", marginBottom: "20px", borderColor: "rgba(10,132,255,0.2)", background: "rgba(10,132,255,0.05)" }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ width: 32, height: 32, borderRadius: "10px", background: "rgba(10,132,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2v4l3 1.5" stroke="#0A84FF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#0A84FF", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px" }}>
              APEX Recommendation
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Recovery is calculated from time since your last workout. Tap any muscle row to manually override the soreness level if you feel differently.
            </div>
          </div>
        </div>
      </div>

      {/* ── Section label ─────────────────────────────────── */}
      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text-tertiary)", marginBottom: "12px" }}>
        Breakdown
      </div>

      {/* ── Muscle Rows ───────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "30px" }}>
        {loading.workouts ? (
          <>
             {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card skeleton" style={{ height: "64px", borderRadius: "16px" }} />
             ))}
          </>
        ) : (
          sortedMuscles.map((name, i) => (
            <MuscleRow
              key={name}
              id={`muscle-row-${name}`}
              name={name}
              data={muscleData[name] ?? { status: "fresh", pct: 0, isManual: false, hours: 0 }}
              manualLevel={manualOverrides[name] ?? null}
              onSelect={handleSelect}
              onClear={handleClear}
              delay={Math.min(i + 1, 6)}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
