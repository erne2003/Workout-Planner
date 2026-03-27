"use client";
import { useState } from "react";
import PageShell from "../../components/PageShell";
import { PROGRESS_DATA, PERSONAL_RECORDS } from "../../lib/data";

/* ─── Lift config ───────────────────────────────────────────── */
const LIFTS = [
  { key: "bench",    label: "Bench Press", color: "#0A84FF", unit: "lbs" },
  { key: "squat",    label: "Back Squat",  color: "#FF2D55", unit: "lbs" },
  { key: "deadlift", label: "Deadlift",    color: "#FFD60A", unit: "lbs" },
];

/* ─── SVG Line Chart ────────────────────────────────────────── */
function LineChart({ data, dataKey, color, width = 340, height = 160 }) {
  const values = data.map((d) => d[dataKey]);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const range = max - min || 1;

  const padL = 8, padR = 8, padT = 12, padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toX = (i) => padL + (i / (data.length - 1)) * innerW;
  const toY = (v) => padT + innerH - ((v - min) / range) * innerH;

  const pathD = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L${toX(values.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${padL},${(padT + innerH).toFixed(1)} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal guide lines */}
      {[0.25, 0.5, 0.75, 1].map((lvl) => {
        const y = padT + innerH * (1 - lvl);
        const val = Math.round(min + range * lvl);
        return (
          <g key={lvl}>
            <line
              x1={padL} y1={y} x2={padL + innerW} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4"
            />
            <text
              x={padL - 4} y={y + 4}
              fontSize="8" fill="rgba(255,255,255,0.2)"
              textAnchor="end" fontFamily="DM Sans, sans-serif"
            >
              {val}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaD} fill={`url(#grad-${dataKey})`} />

      {/* Line */}
      <path d={pathD} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(v)} r="4" fill={color} stroke="rgba(7,7,15,0.9)" strokeWidth="2" />
        </g>
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={toX(i)} y={height - 6}
          textAnchor="middle" fontSize="9"
          fill="rgba(255,255,255,0.25)"
          fontFamily="DM Sans, sans-serif"
          fontWeight="500"
        >
          {d.week}
        </text>
      ))}
    </svg>
  );
}

/* ─── Sparkline (tiny inline chart) ────────────────────────── */
function Sparkline({ data, dataKey, color, width = 80, height = 32 }) {
  const values = data.map((d) => d[dataKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toX = (i) => (i / (values.length - 1)) * width;
  const toY = (v) => height - 4 - ((v - min) / range) * (height - 8);

  const pathD = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={toX(values.length - 1)} cy={toY(values[values.length - 1])}
        r="3" fill={color}
      />
    </svg>
  );
}

/* ─── Weekly Volume Bar Chart ───────────────────────────────── */
function VolumeChart({ data }) {
  const totalVolumes = data.map((d) => d.bench * 8 + d.squat * 8 + d.deadlift * 5);
  const max = Math.max(...totalVolumes);
  const width = 340, height = 80;
  const barW = (width / data.length) * 0.6;
  const gap = (width / data.length) * 0.4;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const vol = totalVolumes[i];
        const barH = (vol / max) * (height - 20);
        const x = i * (barW + gap) + gap / 2;
        const y = height - barH - 16;
        const isLast = i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx="4"
              fill={isLast ? "#0A84FF" : "rgba(255,255,255,0.08)"}
            />
            <text
              x={x + barW / 2} y={height - 2}
              textAnchor="middle" fontSize="8"
              fill="rgba(255,255,255,0.25)"
              fontFamily="DM Sans, sans-serif"
            >
              {d.week}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Lift Selector ─────────────────────────────────────────── */
function LiftSelector({ selected, onSelect }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
      {LIFTS.map((lift) => {
        const active = selected === lift.key;
        return (
          <button
            key={lift.key}
            onClick={() => onSelect(lift.key)}
            style={{
              flex: 1,
              padding: "9px 6px",
              borderRadius: "12px",
              border: `1px solid ${active ? lift.color + "60" : "rgba(255,255,255,0.07)"}`,
              background: active ? `${lift.color}18` : "rgba(255,255,255,0.025)",
              color: active ? lift.color : "rgba(255,255,255,0.35)",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              whiteSpace: "nowrap",
            }}
          >
            {lift.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Streak + Activity Card ────────────────────────────────── */
function ActivityCard() {
  // 10 weeks × 7 days = 70 cells
  const days = Array.from({ length: 70 }, (_, i) => {
    const rand = Math.random();
    return rand > 0.6 ? (rand > 0.85 ? 2 : 1) : 0;
  });

  const colors = ["rgba(255,255,255,0.06)", "#0A84FF60", "#0A84FF"];

  return (
    <div className="glass-card animate-fade-up delay-3" style={{ padding: "16px 20px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.4px",
            color: "var(--text-tertiary)",
          }}
        >
          Activity · 10 Weeks
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#FF2D55",
              boxShadow: "0 0 8px #FF2D55",
              animation: "pulse-glow 2s ease infinite",
            }}
          />
          <span style={{ fontSize: "11px", color: "#FF2D55", fontWeight: 700 }}>
            14-day streak
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: "4px",
        }}
      >
        {days.map((intensity, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              borderRadius: "3px",
              background: colors[intensity],
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
        {[
          { label: "Workouts", val: "28", color: "#0A84FF" },
          { label: "Avg / week", val: "2.8", color: "#FF9F0A" },
          { label: "Rest days", val: "42", color: "var(--text-secondary)" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "18px", fontWeight: 800, color }}>
              {val}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Log PR Form ───────────────────────────────────────────── */
function LogPRCard() {
  const [exercise, setExercise] = useState("bench");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("0");

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now, just a console log or alert. The user will implement the backend function later.
    alert(`Logged PR: ${LIFTS.find(l => l.key === exercise)?.label || exercise} - ${weight}lbs x ${reps} @ RIR ${rir}`);
    setWeight("");
    setReps("");
    setRir("0");
  };

  const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "10px 12px",
    color: "#fff",
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 600,
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: "10px",
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "4px",
    fontWeight: 700,
  };

  return (
    <div className="glass-card animate-fade-up delay-1" style={{ padding: "16px 20px", marginBottom: "16px", borderTop: "2px solid #30D15840" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <div style={{ width: 28, height: 28, borderRadius: "8px", background: "rgba(48, 209, 88, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="#30D158" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "1px" }}>
            Log New PR
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
            Record strength milestones
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Row 1: Exercise */}
        <div>
          <label style={labelStyle}>Exercise</label>
          <select
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
          >
            {LIFTS.map(l => (
              <option key={l.key} value={l.key} style={{ background: "#111" }}>{l.label}</option>
            ))}
            <option value="other" style={{ background: "#111" }}>Other...</option>
          </select>
        </div>

        {/* Row 2: Weight & Reps */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Weight (lbs)</label>
            <input
              type="number"
              placeholder="e.g. 265"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Reps</label>
            <input
              type="number"
              placeholder="e.g. 1"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* Row 3: RIR & Submit */}
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>RIR (Buffer)</label>
            <select
              value={rir}
              onChange={(e) => setRir(e.target.value)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
            >
              {[0, 1, 2, 3, 4].map(r => (
                <option key={r} value={r} style={{ background: "#111" }}>{r} RIR</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            style={{
              flex: 1,
              padding: "11px",
              borderRadius: "10px",
              background: "#30D158",
              color: "#000",
              fontFamily: "var(--font-display)",
              fontSize: "13px",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
            onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
            onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.98)"}
            onMouseUp={e => e.currentTarget.style.transform = "scale(1.02)"}
          >
            Save PR
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function ProgressPage() {
  const [selectedLift, setSelectedLift] = useState("bench");
  const lift = LIFTS.find((l) => l.key === selectedLift);

  const firstVal = PROGRESS_DATA[0][selectedLift];
  const lastVal = PROGRESS_DATA[PROGRESS_DATA.length - 1][selectedLift];
  const gain = lastVal - firstVal;
  const gainPct = ((gain / firstVal) * 100).toFixed(1);

  return (
    <PageShell title="Progress" subtitle="Historical · 8 Weeks">
      {/* ── Top Summary Cards ─────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        {LIFTS.map((l, i) => {
          const pr = PERSONAL_RECORDS[l.key];
          const vals = PROGRESS_DATA.map((d) => d[l.key]);
          const gain = vals[vals.length - 1] - vals[0];
          return (
            <div
              key={l.key}
              className={`glass-card animate-fade-up delay-${i + 1}`}
              style={{ flex: 1, padding: "12px" }}
            >
              <div style={{ fontSize: "9px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>
                {l.label.split(" ")[0]}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: l.color,
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  marginBottom: "4px",
                }}
              >
                {pr.weight}
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "var(--font-body)", fontWeight: 500, letterSpacing: 0 }}> lbs</span>
              </div>
              <Sparkline data={PROGRESS_DATA} dataKey={l.key} color={l.color} />
              <div style={{ fontSize: "10px", color: "#30D158", fontWeight: 600, marginTop: "2px" }}>
                +{gain} lbs
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Log PR Form ───────────────────────────────────── */}
      <LogPRCard />

      {/* ── Main Chart Card ───────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-2"
        style={{ padding: "16px 20px", marginBottom: "12px" }}
      >
        {/* Chart header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 700,
                marginBottom: "2px",
              }}
            >
              {lift.label}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>8-week progression</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "22px",
                fontWeight: 800,
                color: lift.color,
                letterSpacing: "-1px",
                lineHeight: 1,
              }}
            >
              +{gain} lbs
            </div>
            <div style={{ fontSize: "11px", color: "#30D158", fontWeight: 600 }}>
              +{gainPct}% total
            </div>
          </div>
        </div>

        {/* Lift selector tabs */}
        <LiftSelector selected={selectedLift} onSelect={setSelectedLift} />

        {/* Chart */}
        <div style={{ padding: "0 4px" }}>
          <LineChart data={PROGRESS_DATA} dataKey={selectedLift} color={lift.color} />
        </div>
      </div>

      {/* ── Weekly Volume ─────────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-3"
        style={{ padding: "16px 20px", marginBottom: "12px" }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.4px",
            color: "var(--text-tertiary)",
            marginBottom: "14px",
          }}
        >
          Total Volume · Per Week
        </div>
        <VolumeChart data={PROGRESS_DATA} />
      </div>

      {/* ── Activity Grid ─────────────────────────────────── */}
      <ActivityCard />

      {/* ── Insight Card ──────────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-5"
        style={{
          padding: "16px",
          borderColor: "rgba(255,214,10,0.2)",
          background: "rgba(255,214,10,0.04)",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "10px",
              background: "rgba(255,214,10,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "16px",
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#FFD60A",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                marginBottom: "4px",
              }}
            >
              Trend Insight
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Your <strong style={{ color: "#fff" }}>deadlift progression rate</strong> is 2.4× your bench press rate. Consider adding more horizontal pressing volume to balance your posterior-anterior strength ratio.
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
