"use client";
import { useEffect, useState, useMemo } from "react";
import PageShell from "../../components/PageShell";
import { OVERALL_STRENGTH_SCORE, PERSONAL_RECORDS } from "../../lib/data";
import {
  RECOVERY_COLOR,
  getStatusFromPct,
  getMuscleSoreness,
  computeDynamicRecovery,
} from "../../lib/recovery";

/* ─── Overall Score Ring ────────────────────────────────────── */
function OverallRing({ score, bw, age, index }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const r = 72;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (mounted ? score : 0) / 100);

  const grade = score >= 90 ? "Elite" : score >= 75 ? "Advanced" : score >= 60 ? "Intermediate" : "Developing";
  const gradeColor = score >= 90 ? "#FFD60A" : score >= 75 ? "#30D158" : score >= 60 ? "#0A84FF" : "#FF9F0A";
  const percentile = score >= 90 ? "2%" : score >= 75 ? "8%" : score >= 60 ? "15%" : "45%";

  return (
    <div
      className="glass-card animate-fade-up delay-1"
      style={{ padding: "28px 20px", textAlign: "center", marginBottom: "12px" }}
    >
      {/* Ring */}
      <div style={{ position: "relative", display: "inline-block", width: 164, height: 164, marginBottom: "20px" }}>
        {/* Glow layer */}
        <div
          style={{
            position: "absolute",
            inset: "10px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${gradeColor}22 0%, transparent 70%)`,
            filter: "blur(12px)",
            transition: "background 0.5s",
          }}
        />
        <svg width="164" height="164" viewBox="0 0 164 164" style={{ transform: "rotate(-90deg)", position: "relative", zIndex: 1 }}>
          {/* Track */}
          <circle cx="82" cy="82" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          {/* Track segments for visual texture */}
          {[...Array(24)].map((_, i) => {
            const angle = (i / 24) * 360;
            const rad = (angle * Math.PI) / 180;
            const x1 = 82 + (r - 6) * Math.cos(rad);
            const y1 = 82 + (r - 6) * Math.sin(rad);
            const x2 = 82 + (r + 6) * Math.cos(rad);
            const y2 = 82 + (r + 6) * Math.sin(rad);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
            );
          })}
          {/* Score arc */}
          <circle
            cx="82"
            cy="82"
            r={r}
            fill="none"
            stroke={gradeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.34,1.2,0.64,1), stroke 0.4s" }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "40px",
              fontWeight: 800,
              letterSpacing: "-2px",
              color: gradeColor,
              lineHeight: 1,
              transition: "color 0.4s",
            }}
          >
            {score}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px" }}>
            Score
          </span>
        </div>
      </div>

      {/* Grade label */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 800,
          color: gradeColor,
          marginBottom: "6px",
          letterSpacing: "-0.5px",
        }}
      >
        {grade}
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
        Top {percentile} of athletes your level
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)", margin: "18px 0" }} />

      {/* Quick stats row */}
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        {[
          { label: "Strength Index", val: `${index || "0.0"}×`, color: "#0A84FF" },
          { label: "Body Weight", val: bw ? `${Math.round(bw)} lbs` : "0 lbs", color: "var(--text-primary)" },
          { label: "Training Age", val: age ? `${age} yrs` : "0 yrs", color: "#FF9F0A" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "16px",
                fontWeight: 800,
                color,
                letterSpacing: "-0.5px",
              }}
            >
              {val}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.7px", marginTop: "2px" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Lift Card (BW Multiplier) ─────────────────────────────── */
function LiftCard({ liftName, weight, bw, delay }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t); }, []);

  const multiplier = bw > 0 ? (weight / bw) : 0;
  
  // Example brackets: Novice, Intermediate, Advanced, Elite
  let grade = "Unassigned";
  let gradeColor = "var(--text-secondary)";
  let pct = 0;

  if (liftName === "bench") {
    if (multiplier >= 1.5)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 1.2) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.0) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 0.7) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "var(--text-tertiary)"; pct = 20; }
  } else if (liftName === "squat") {
    if (multiplier >= 2.0)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 1.5) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.2) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 0.9) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "var(--text-tertiary)"; pct = 20; }
  } else if (liftName === "deadlift") {
    if (multiplier >= 2.5)      { grade = "Elite"; gradeColor = "#FFD60A"; pct = 100; }
    else if (multiplier >= 2.0) { grade = "Advanced"; gradeColor = "#30D158"; pct = 80; }
    else if (multiplier >= 1.5) { grade = "Intermediate"; gradeColor = "#0A84FF"; pct = 60; }
    else if (multiplier >= 1.1) { grade = "Novice"; gradeColor = "#BF5AF2"; pct = 40; }
    else                        { grade = "Beginner"; gradeColor = "var(--text-tertiary)"; pct = 20; }
  }

  return (
    <div
      className={`glass-card animate-fade-up delay-${delay}`}
      style={{
        padding: "16px",
        marginBottom: "12px",
        borderTop: `2px solid ${gradeColor}40`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-tertiary)", marginBottom: "2px" }}>
            {liftName}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, lineHeight: 1 }}>
            {weight} <span style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: 500 }}>lbs</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: gradeColor }}>
            {multiplier.toFixed(2)}x BW
          </div>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
            {grade}
          </div>
        </div>
      </div>

      <div className="bar-track" style={{ height: "6px" }}>
        <div
          className="bar-fill"
          style={{
            width: mounted ? `${pct}%` : "0%",
            background: gradeColor,
            boxShadow: `0 0 8px ${gradeColor}60`,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Strength Bar Row ──────────────────────────────────────── */
function StrengthRow({ item, delay }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t); }, []);

  const gain = item.score - item.prev;

  return (
    <div
      className={`animate-fade-up delay-${delay}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 16px",
        borderRadius: "16px",
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Color dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: item.color,
          boxShadow: `0 0 10px ${item.color}80`,
          flexShrink: 0,
        }}
      />

      {/* Muscle name */}
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-secondary)",
          width: "76px",
          flexShrink: 0,
        }}
      >
        {item.muscle}
      </span>

      {/* Bar */}
      <div style={{ flex: 1 }}>
        <div className="bar-track" style={{ height: "7px" }}>
          <div
            className="bar-fill"
            style={{
              width: mounted ? `${item.score}%` : "0%",
              background: item.color,
              boxShadow: `0 0 8px ${item.color}60`,
            }}
          />
        </div>
      </div>

      {/* Score + delta */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "16px",
            fontWeight: 800,
            color: item.color,
          }}
        >
          {item.score}
        </span>
        <div
          style={{
            fontSize: "10px",
            color: gain >= 0 ? "#30D158" : "#FF2D55",
            fontWeight: 600,
            textAlign: "right",
          }}
        >
          {gain > 0 ? `+${gain}` : gain < 0 ? gain : "±0"}
        </div>
      </div>
    </div>
  );
}

/* ─── Personal Record Card ──────────────────────────────────── */
function PRCard({ prData }) {
  if (!prData) return null;
  return (
    <div className="glass-card animate-fade-up delay-4" style={{ padding: "16px 20px", marginBottom: "12px" }}>
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
        Personal Records
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {Object.entries(prData).map(([lift, data]) => (
          <div key={lift}>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "4px",
              }}
            >
              {lift}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-1px",
                lineHeight: 1,
              }}
            >
              {data.weight}
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  letterSpacing: 0,
                }}
              >
                {" "}{data.unit}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "#30D158", fontWeight: 600, marginTop: "4px" }}>
              {data.gain} this month
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Radar-style muscle radar (SVG) ───────────────────────── */
function MuscleRadar({ scores }) {
  const cx = 100, cy = 100, r = 72;
  const n = scores.length;
  const points = scores.map((s, i) => {
    const angle = ((i / n) * 2 * Math.PI) - Math.PI / 2;
    const dist = (s.score / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), ...s, angle };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const labelPoints = scores.map((s, i) => {
    const angle = ((i / n) * 2 * Math.PI) - Math.PI / 2;
    const dist = r + 20;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), label: s.muscle };
  });

  return (
    <svg viewBox="0 0 200 200" width="200" height="200">
      {/* Grid rings */}
      {gridLevels.map((lvl) => {
        const pts = scores.map((_, i) => {
          const angle = ((i / n) * 2 * Math.PI) - Math.PI / 2;
          return `${cx + lvl * r * Math.cos(angle)},${cy + lvl * r * Math.sin(angle)}`;
        }).join(" ");
        return <polygon key={lvl} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}

      {/* Spokes */}
      {scores.map((_, i) => {
        const angle = ((i / n) * 2 * Math.PI) - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        );
      })}

      {/* Score area */}
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(10,132,255,0.1)"
        stroke="#0A84FF"
        strokeWidth="1.5"
      />

      {/* Score dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.color} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
      ))}

      {/* Labels */}
      {labelPoints.map(({ x, y, label }, i) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fontWeight="700"
          fill="rgba(255,255,255,0.4)"
          fontFamily="DM Sans, sans-serif"
          textTransform="uppercase"
        >
          {label.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function StrengthPage() {
  const [metrics, setMetrics] = useState({ weight: 0, trainingYears: 0 });
  const [prs, setPrs] = useState({ 
    bench: { weight: 0, unit: "lbs", gain: "+0" }, 
    squat: { weight: 0, unit: "lbs", gain: "+0" }, 
    deadlift: { weight: 0, unit: "lbs", gain: "+0" } 
  });
  
  const [dynamicScores, setDynamicScores] = useState([
      { muscle: "Chest",     score: 0, color: "#0A84FF", prev: 0 },
      { muscle: "Back",      score: 0, color: "#BF5AF2", prev: 0 },
      { muscle: "Shoulders", score: 0, color: "#FF9F0A", prev: 0 },
      { muscle: "Arms",      score: 0, color: "#30D158", prev: 0 },
      { muscle: "Legs",      score: 0, color: "#FFD60A", prev: 0 },
      { muscle: "Core",      score: 0, color: "#FF3B30", prev: 0 },
  ]);

  // 1. Fetch time-based recovery for all muscles
  const ALL_MUSCLES = [
    "chest", "shoulders", "biceps", "triceps",
    "lats", "core", "quads", "hamstrings", "glutes", "calves",
  ];
  const [recoveryData, setRecoveryData] = useState({});
  useEffect(() => {
    const fetchRecovery = async () => {
      try {
        const uId = localStorage.getItem("userId") || 1;
        const res = await fetch(`http://localhost:5000/workouts?userId=${uId}`);
        const data = res.ok ? await res.json() : [];
        const overrides = getMuscleSoreness();
        setRecoveryData(computeDynamicRecovery(ALL_MUSCLES, data, overrides));

        // Evaluate Volume for Muscle Group Breakdown dynamically
        const muscleVol = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0, Core: 0 };
        data.forEach(w => {
            w.sets?.forEach(s => {
                const n = (s.name || s.exercise_name || "").toLowerCase();
                if (n.includes("bench") || n.includes("chest") || n.includes("push") || n.includes("fly")) muscleVol.Chest += 1;
                else if (n.includes("row") || n.includes("pull") || n.includes("lat")) muscleVol.Back += 1;
                else if (n.includes("shoulder") || n.includes("press") || n.includes("delt")) muscleVol.Shoulders += 1;
                else if (n.includes("curl") || n.includes("extension") || n.includes("tricep") || n.includes("bicep")) muscleVol.Arms += 1;
                else if (n.includes("squat") || n.includes("leg") || n.includes("deadlift") || n.includes("calf")) muscleVol.Legs += 1;
                else muscleVol.Core += 1; // Default fallbacks
            });
        });
        
        setDynamicScores([
            { muscle: "Chest",     score: Math.min(100, muscleVol.Chest * 5), color: "#0A84FF", prev: 0 },
            { muscle: "Back",      score: Math.min(100, muscleVol.Back * 5), color: "#BF5AF2", prev: 0 },
            { muscle: "Shoulders", score: Math.min(100, muscleVol.Shoulders * 5), color: "#FF9F0A", prev: 0 },
            { muscle: "Arms",      score: Math.min(100, muscleVol.Arms * 5), color: "#30D158", prev: 0 },
            { muscle: "Legs",      score: Math.min(100, muscleVol.Legs * 5), color: "#FFD60A", prev: 0 },
            { muscle: "Core",      score: Math.min(100, Math.floor(muscleVol.Core * 2.5)), color: "#FF3B30", prev: 0 },
        ]);

        // Dynamically track body weight and physical constraints
        const metReq = await fetch(`http://localhost:5000/metrics?userId=${uId}`);
        const metData = metReq.ok ? await metReq.json() : [];
        if (metData.length > 0) {
            const latest = metData[metData.length - 1]; // most recent chronological snapshot
            setMetrics({ weight: latest.weight || 0, trainingYears: latest.training_years || 0 });
        }
        
        // Dynamically pull Personal Records explicitly mapping Big Lifts directly
        const prReq = await fetch(`http://localhost:5000/prs?userId=${uId}`);
        const prData = prReq.ok ? await prReq.json() : [];
        if (prData.length > 0) {
            let maxes = { bench: 0, squat: 0, deadlift: 0 };
            prData.forEach(p => {
                const e = p.exercise_name?.toLowerCase();
                if (["bench press", "bench"].includes(e) && parseFloat(p.weight) > maxes.bench) maxes.bench = parseFloat(p.weight);
                else if (["squat", "barbell squat"].includes(e) && parseFloat(p.weight) > maxes.squat) maxes.squat = parseFloat(p.weight);
                else if (["deadlift", "barbell deadlift"].includes(e) && parseFloat(p.weight) > maxes.deadlift) maxes.deadlift = parseFloat(p.weight);
            });
            setPrs({
                bench: { weight: maxes.bench, unit: "lbs", gain: `+0` },
                squat: { weight: maxes.squat, unit: "lbs", gain: `+0` },
                deadlift: { weight: maxes.deadlift, unit: "lbs", gain: `+0` }
            });
        }
      } catch (e) {
        console.error("Failed fetching muscle recovery profiles", e);
      }
    };
    fetchRecovery();
  }, []);

  // Stabilize performance calculations with useMemo
  const { strengthIndex, derivedOverall } = useMemo(() => {
    const volScore = Math.round(dynamicScores.reduce((acc, curr) => acc + curr.score, 0) / (dynamicScores.length || 1));
    const bw = metrics.weight || 1;
    const bMultiplier = prs.bench.weight / bw;
    const sMultiplier = prs.squat.weight / bw;
    const dMultiplier = prs.deadlift.weight / bw;
    const rawIndex = (bMultiplier + sMultiplier + dMultiplier) / 3;
    const indexStr = rawIndex.toFixed(1);

    // Performance Basis: 1.5x average (Elite) = 100 points, 0.75x (Intermediate) = 50 points
    const performanceBasis = (rawIndex / 1.5) * 100;
    const score = Math.min(100, Math.round((performanceBasis * 0.7) + (volScore * 0.3)));
    
    return { strengthIndex: indexStr, derivedOverall: score };
  }, [dynamicScores, metrics, prs]);

  return (
    <PageShell title="Strength" subtitle="Analytics · Big Lifts & Recovery">
      {/* ── Overall Score ─────────────────────────────────── */}
      <OverallRing score={derivedOverall} bw={metrics.weight} age={metrics.trainingYears} index={strengthIndex} />

      {/* ── Radar + Breakdown side by side ───────────────── */}
      <div
        className="glass-card animate-fade-up delay-2"
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
          Muscle Readiness Radar
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MuscleRadar scores={dynamicScores} />
        </div>
      </div>

      {/* ── Lift Cards ─────────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "12px",
          marginTop: "16px",
        }}
      >
        Big Lifts vs Bodyweight
      </div>

      <LiftCard liftName="bench" weight={prs.bench.weight} bw={metrics.weight} delay={3} />
      <LiftCard liftName="squat" weight={prs.squat.weight} bw={metrics.weight} delay={4} />
      <LiftCard liftName="deadlift" weight={prs.deadlift.weight} bw={metrics.weight} delay={5} />

      {/* ── PRs ──────────────────────────────────────────── */}
      <div style={{ marginTop: "12px" }}>
        <PRCard prData={prs} />
      </div>

      {/* ── Section label ─────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "12px",
          marginTop: "16px",
        }}
      >
        Muscle Group Breakdown (Strength Index)
      </div>

      {/* ── Strength rows ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {[...dynamicScores].map((item, i) => (
          <StrengthRow key={item.muscle} item={item} delay={Math.min(i + 6, 8)} />
        ))}
      </div>
    </PageShell>
  );
}
