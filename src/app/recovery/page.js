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
} from "../../lib/recovery";

const ALL_MUSCLES = [
  "chest", "shoulders", "biceps", "triceps",
  "lats", "core", "quads", "hamstrings", "glutes", "calves",
];

/* ─── Body Map SVG ──────────────────────────────────────────── */
function BodyMap({ muscleData }) {
  const fillFor = (key) => {
    const d = muscleData[key];
    if (!d) return "rgba(255,255,255,0.08)";
    const c = RECOVERY_COLOR[d.status];
    const alpha = 0.55 + (1 - d.pct / 100) * 0.3;
    return `${c}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  };

  return (
    <svg
      viewBox="0 0 160 320"
      width="130"
      height="260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <ellipse cx="80" cy="22" rx="18" ry="20" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      {/* Neck */}
      <rect x="73" y="40" width="14" height="12" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Shoulders */}
      <ellipse cx="46" cy="62" rx="18" ry="10" fill={fillFor("shoulders")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <ellipse cx="114" cy="62" rx="18" ry="10" fill={fillFor("shoulders")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Chest */}
      <path d="M60 56 Q80 50 100 56 L104 90 Q80 96 56 90 Z" fill={fillFor("chest")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Upper arms (biceps) */}
      <rect x="28" y="68" width="16" height="44" rx="8" fill={fillFor("biceps")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="116" y="68" width="16" height="44" rx="8" fill={fillFor("biceps")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Forearms */}
      <rect x="22" y="114" width="14" height="38" rx="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <rect x="124" y="114" width="14" height="38" rx="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {/* Core / Abs */}
      <path d="M60 90 Q80 86 100 90 L100 148 Q80 154 60 148 Z" fill={fillFor("core")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Lats (back – rendered as wide side panels) */}
      <path d="M44 70 Q34 90 38 148 Q50 150 60 148 L56 90 Z" fill={fillFor("lats")} stroke="rgba(255,255,255,0.08)" strokeWidth="1" opacity="0.7" />
      <path d="M116 70 Q126 90 122 148 Q110 150 100 148 L104 90 Z" fill={fillFor("lats")} stroke="rgba(255,255,255,0.08)" strokeWidth="1" opacity="0.7" />
      {/* Quads */}
      <rect x="62" y="154" width="26" height="68" rx="13" fill={fillFor("quads")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="72" y="154" width="26" height="68" rx="13" fill={fillFor("quads")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Hamstrings (lighter, behind quads) */}
      <rect x="63" y="154" width="24" height="66" rx="12" fill={fillFor("hamstrings")} stroke="rgba(255,255,255,0.06)" strokeWidth="1" opacity="0.5" />
      <rect x="73" y="154" width="24" height="66" rx="12" fill={fillFor("hamstrings")} stroke="rgba(255,255,255,0.06)" strokeWidth="1" opacity="0.5" />
      {/* Calves */}
      <rect x="62" y="226" width="22" height="46" rx="11" fill={fillFor("calves")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <rect x="76" y="226" width="22" height="46" rx="11" fill={fillFor("calves")} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Feet */}
      <ellipse cx="70" cy="274" rx="14" ry="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <ellipse cx="90" cy="274" rx="14" ry="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

/* ─── Legend Dot ────────────────────────────────────────────── */
function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ─── Soreness Picker ───────────────────────────────────────── */
const SORENESS_LEVELS = ["fresh", "moderate", "sore"];

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
  const values = Object.values(muscleData);
  if (!values.length) return null;
  const avg = Math.round(values.reduce((s, m) => s + m.pct, 0) / values.length);
  const color = avg >= 75 ? "#30D158" : avg >= 50 ? "#FF9F0A" : "#FF2D55";
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - avg / 100);

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
            {avg}
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
      <span>Last workout <strong style={{ color: "#fff" }}>{hLabel} ago</strong></span>
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

  const refresh = useCallback(() => {
    const lt = getLastWorkoutTime();
    const overrides = getMuscleSoreness();
    setLastTimeState(lt);
    setManualOverrides(overrides);
    setMuscleData(computeRecovery(ALL_MUSCLES, lt, overrides));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSelect = (muscle, level) => {
    setMuscleSoreness(muscle, level);
    refresh();
  };

  const handleClear = (muscle) => {
    setMuscleSoreness(muscle, null);
    refresh();
  };

  const handleReset = () => {
    setLastWorkoutTime(new Date());
    refresh();
  };

  const sortedMuscles = [...ALL_MUSCLES].sort(
    (a, b) => (muscleData[a]?.pct ?? 0) - (muscleData[b]?.pct ?? 0)
  );

  return (
    <PageShell title="Recovery" subtitle="Muscle Readiness · Today">
      {/* ── Last workout banner ───────────────────────────── */}
      <LastWorkoutBanner lastTime={lastTime} onReset={handleReset} />

      {/* ── Hero Card: Body Map + Score ───────────────────── */}
      <div className="glass-card animate-fade-up delay-1" style={{ padding: "20px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, marginBottom: "2px" }}>
              Muscle Readiness
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
              Tap a muscle row to set soreness
            </div>
          </div>
          <OverallScore muscleData={muscleData} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <BodyMap muscleData={muscleData} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <LegendDot color="#30D158" label="≥ 24h (Fresh)" />
          <LegendDot color="#FF9F0A" label="≥ 12h" />
          <LegendDot color="#FF2D55" label="< 12h (Sore)" />
        </div>
      </div>

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
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sortedMuscles.map((name, i) => (
          <MuscleRow
            key={name}
            name={name}
            data={muscleData[name] ?? { status: "fresh", pct: 0, isManual: false, hours: 0 }}
            manualLevel={manualOverrides[name] ?? null}
            onSelect={handleSelect}
            onClear={handleClear}
            delay={Math.min(i + 1, 6)}
          />
        ))}
      </div>
    </PageShell>
  );
}
