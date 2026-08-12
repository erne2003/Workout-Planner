"use client";
import { useEffect, useState, useMemo } from "react";
import PageShell from "../../components/PageShell";
import { useSettings } from "../../contexts/SettingsContext";
import { useData } from "../../contexts/DataContext";
import { OVERALL_STRENGTH_SCORE, PERSONAL_RECORDS } from "../../lib/data";
import {
  RECOVERY_COLOR,
  getStatusFromPct,
  getMuscleSoreness,
  setMuscleSoreness,
  computeDynamicRecovery,
} from "../../lib/recovery";
/* --- Biomechanical Classifier Parameters --------------------- */
const MALE_REF_WT = 80.0;
const MALE_REF_HT = 178.0;
const FEMALE_REF_WT = 60.0;
const FEMALE_REF_HT = 163.0;

const MULTIPLIERS = {
  male: {
    squat:    { novice: 1.15, intermediate: 1.50, advanced: 2.00, elite: 2.40 },
    bench:    { novice: 0.85, intermediate: 1.15, advanced: 1.40, elite: 1.75 },
    deadlift: { novice: 1.30, intermediate: 1.75, advanced: 2.25, elite: 2.75 }
  },
  female: {
    squat:    { novice: 0.75, intermediate: 1.10, advanced: 1.50, elite: 1.85 },
    bench:    { novice: 0.50, intermediate: 0.75, advanced: 1.00, elite: 1.25 },
    deadlift: { novice: 0.90, intermediate: 1.30, advanced: 1.75, elite: 2.15 }
  }
};

function parseHeightToCm(heightStr) {
  if (!heightStr) return 178;
  const clean = heightStr.trim().toLowerCase();
  if (clean.endsWith("cm")) {
    return parseFloat(clean) || 178;
  }
  const match = clean.match(/^(\d+)'(\d+)"?$/);
  if (match) {
    const feet = parseInt(match[1]) || 0;
    const inches = parseInt(match[2]) || 0;
    return feet * 30.48 + inches * 2.54;
  }
  const justNum = parseFloat(clean);
  if (!isNaN(justNum)) {
    if (justNum > 100) return justNum;
    return justNum * 30.48;
  }
  return 178;
}

function calculateStrengthTier(gender, weight_kg, height_cm, lift_type, actual_lift_kg) {
  const isFemale = String(gender).toLowerCase() === "female";
  const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
  const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
  
  const sAllometric = refWt * Math.pow(Math.max(1, weight_kg) / refWt, 2/3);
  const cRaw = 1.0 - 0.012 * (height_cm - refHt);
  const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
  
  const mults = isFemale ? MULTIPLIERS.female[lift_type] : MULTIPLIERS.male[lift_type];
  if (!mults) return { grade: "Novice", pct: 0, targetKg: 0 };
  
  const tNovice = mults.novice * sAllometric * cLeverage;
  const tIntermediate = mults.intermediate * sAllometric * cLeverage;
  const tAdvanced = mults.advanced * sAllometric * cLeverage;
  const tElite = mults.elite * sAllometric * cLeverage;
  
  let grade = "Novice";
  let gradeColor = "#30D158";
  let pct = 0;
  let targetKg = tNovice;
  
  if (actual_lift_kg < tNovice) {
    grade = "Novice";
    gradeColor = "#30D158";
    pct = (actual_lift_kg / tNovice) * 25;
    targetKg = tNovice;
  } else if (actual_lift_kg < tIntermediate) {
    grade = "Novice";
    gradeColor = "#30D158";
    pct = 25 + ((actual_lift_kg - tNovice) / (tIntermediate - tNovice)) * 25;
    targetKg = tIntermediate;
  } else if (actual_lift_kg < tAdvanced) {
    grade = "Intermediate";
    gradeColor = "#0A84FF";
    pct = 50 + ((actual_lift_kg - tIntermediate) / (tAdvanced - tIntermediate)) * 25;
    targetKg = tAdvanced;
  } else if (actual_lift_kg < tElite) {
    grade = "Advanced";
    gradeColor = "#FF3B30";
    pct = 75 + ((actual_lift_kg - tAdvanced) / (tElite - tAdvanced)) * 25;
    targetKg = tElite;
  } else {
    grade = "Elite";
    gradeColor = "#FFD60A";
    pct = 100;
    targetKg = tElite;
  }
  
  return {
    grade,
    gradeColor,
    pct: Math.round(Math.min(100, Math.max(0, pct))),
    targetKg
  };
}

/* --- Overall Score Ring -------------------------------------- */
function OverallRing({ score, bw, age, index }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const r = 72;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (mounted ? score : 0) / 100);

  const grade = score >= 100 ? "Elite" : score >= 75 ? "Advanced" : score >= 50 ? "Intermediate" : "Novice";
  const gradeColor = score >= 100 ? "#FFD60A" : score >= 75 ? "#FF3B30" : score >= 50 ? "#0A84FF" : "#30D158";
  const percentile = score >= 100 ? "2%" : score >= 75 ? "8%" : score >= 50 ? "15%" : "45%";

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

/* --- Lift Card (BW Multiplier) ------------------------------- */
function LiftCard({ liftName, weight, bw, delay, gender, height, unit }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 150); return () => clearTimeout(t); }, []);

  const multiplier = bw > 0 ? (weight / bw) : 0;
  
  const bwKg = unit === "kg" ? bw : bw / 2.20462262;
  const actualLiftKg = unit === "kg" ? weight : weight / 2.20462262;
  const heightCm = parseHeightToCm(height);
  
  const { grade, gradeColor, pct, targetKg } = calculateStrengthTier(
    gender || "male",
    bwKg,
    heightCm,
    liftName,
    actualLiftKg
  );
  
  const displayTarget = unit === "kg" ? Math.round(targetKg) : Math.round(targetKg * 2.20462262);

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
            {weight} <span style={{ fontSize: "14px", color: "var(--text-tertiary)", fontWeight: 500 }}>{unit}</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          {grade !== "Elite" && targetKg > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "2px" }}>
              Next Tier Target: {displayTarget} {unit}
            </div>
          )}
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

/* --- Strength Bar Row ---------------------------------------- */
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

/* --- Personal Record Card ------------------------------------ */
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
              {data.gain} lbs
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- Radar-style muscle radar (SVG) ------------------------- */
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
          style={{ textTransform: "uppercase" }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

/* --- Page ---------------------------------------------------- */
export default function StrengthPage() {
  const ctx = useSettings();
  const unit = ctx?.weightUnit || "lbs";
  const [metrics, setMetrics] = useState({ weight: 0, trainingYears: 0, gender: "male", height: "Not Selected" });
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

  const [recoveryData, setRecoveryData] = useState({});
  const [selectedMuscle, setSelectedMuscle] = useState(null);

  // Constants
  const ALL_MUSCLES = [
    "chest", "shoulders", "biceps", "triceps",
    "lats", "core", "quads", "hamstrings", "glutes", "calves",
  ];

  const { workouts, prs: prData, metrics: metData, loading } = useData();

  // 1. Process data for strength analytics when available
  useEffect(() => {
      try {
        if (workouts) {
            const overrides = getMuscleSoreness();
            setRecoveryData(computeDynamicRecovery(ALL_MUSCLES, workouts, overrides));
        }

        let bw = 1;
        if (metData && metData.length > 0) {
            const latest = metData[metData.length - 1];
            const rawBw = parseFloat(latest.weight) || 1;
            bw = unit === "kg" ? Math.round(rawBw / 2.205) : rawBw;

            const firstMetric = metData[0];
            let trainingYears = parseFloat(firstMetric.training_years) || 0;
            if (firstMetric.logged_at) {
                const startDate = new Date(firstMetric.logged_at);
                const now = new Date();
                const diffYears = now.getFullYear() - startDate.getFullYear();
                const diffMonths = now.getMonth() - startDate.getMonth();
                let monthsElapsed = diffYears * 12 + diffMonths;
                if (now.getDate() < startDate.getDate()) {
                    monthsElapsed--;
                }
                trainingYears = Math.max(0, trainingYears + (Math.max(0, monthsElapsed) / 12));
            }
            setMetrics({ 
                weight: bw, 
                trainingYears: parseFloat(trainingYears.toFixed(1)),
                gender: latest.gender || "male",
                height: latest.height || "Not Selected"
            });
        }
        
        if (prData) {
            const liftHistory = { bench: [], squat: [], deadlift: [] };
            const rawMaxes = { bench: 0, squat: 0, deadlift: 0, rows: 0 };
            
            if (prData.length > 0) {
                prData.forEach(p => {
                    const e = p.exercise_name?.toLowerCase();
                    const rawW = parseFloat(p.weight);
                    const w = unit === "kg" ? Math.round(rawW / 2.205) : rawW;
                    if (["bench press", "bench", "chest press"].includes(e)) {
                        liftHistory.bench.push(w);
                        rawMaxes.bench = Math.max(rawMaxes.bench, w);
                    }
                    else if (["squat", "barbell squat", "back squat"].includes(e)) {
                        liftHistory.squat.push(w);
                        rawMaxes.squat = Math.max(rawMaxes.squat, w);
                    }
                    else if (["deadlift", "barbell deadlift", "rdl"].includes(e)) {
                        liftHistory.deadlift.push(w);
                        rawMaxes.deadlift = Math.max(rawMaxes.deadlift, w);
                    }
                    else if (["rows", "barbell row", "seated row", "pull"].includes(e)) rawMaxes.rows = Math.max(rawMaxes.rows, w);
                });
                const getGain = (arr) => {
                    const a = arr || [];
                    if (a.length < 2) return "±0";
                    const diff = a[a.length - 1] - a[a.length - 2];
                    return diff >= 0 ? `+${diff.toFixed(0)}` : `${diff.toFixed(0)}`;
                };

                setPrs({
                    bench: { weight: liftHistory.bench[liftHistory.bench.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.bench) },
                    squat: { weight: liftHistory.squat[liftHistory.squat.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.squat) },
                    deadlift: { weight: liftHistory.deadlift[liftHistory.deadlift.length - 1] || 0, unit: "lbs", gain: getGain(liftHistory.deadlift) }
                });
            }

            const latest = (metData && metData.length > 0) ? metData[metData.length - 1] : { gender: "male", height: "178cm" };
            const isFemale = String(latest.gender || "male").toLowerCase() === "female";
            const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
            const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
            
            const bwKg = unit === "kg" ? bw : bw / 2.20462262;
            const heightCm = parseHeightToCm(latest.height);
            
            const sAllometric = refWt * Math.pow(Math.max(1, bwKg) / refWt, 2/3);
            const cRaw = 1.0 - 0.012 * (heightCm - refHt);
            const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
            
            const mults = isFemale ? MULTIPLIERS.female : MULTIPLIERS.male;
            
            const tEliteBench = mults.bench.elite * sAllometric * cLeverage;
            const tEliteSquat = mults.squat.elite * sAllometric * cLeverage;
            const tEliteDeadlift = mults.deadlift.elite * sAllometric * cLeverage;
            
            const tEliteBenchUnit = unit === "kg" ? tEliteBench : tEliteBench * 2.20462262;
            const tEliteSquatUnit = unit === "kg" ? tEliteSquat : tEliteSquat * 2.20462262;
            const tEliteDeadliftUnit = unit === "kg" ? tEliteDeadlift : tEliteDeadlift * 2.20462262;
            
            const tEliteRowsUnit = tEliteBenchUnit * 0.8;
            
            const calcScore = (cur, target) => target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;

            const scores = [
                { muscle: "Chest",     score: calcScore(rawMaxes.bench, tEliteBenchUnit), color: "#0A84FF", prev: 0 },
                { muscle: "Back",      score: calcScore(rawMaxes.deadlift, tEliteDeadliftUnit), color: "#BF5AF2", prev: 0 },
                { muscle: "Shoulders", score: Math.round(calcScore(rawMaxes.bench, tEliteBenchUnit) * 0.75), color: "#FF9F0A", prev: 0 },
                { muscle: "Legs",      score: calcScore(rawMaxes.squat, tEliteSquatUnit), color: "#FFD60A", prev: 0 },
                { 
                  muscle: "Arms",      
                  score: Math.round((calcScore(rawMaxes.bench, tEliteBenchUnit) * 0.5) + (calcScore(rawMaxes.rows, tEliteRowsUnit) * 0.5)), 
                  color: "#30D158", prev: 0 
                },
                { 
                  muscle: "Core",      
                  score: Math.max(0, calcScore(rawMaxes.squat, tEliteSquatUnit) - 15), // Proxy from squat stability
                  color: "#FF3B30", prev: 0 
                },
            ];

            setDynamicScores(scores);
        }
      } catch (e) {
        console.error("Failed processing strength profiles", e);
      }
  }, [unit, workouts, prData, metData]);

  const handleMuscleClick = (muscle) => {
    setSelectedMuscle(muscle);
    // Option to toggle soreness could be added here
  };

  const handleSorenessChange = (muscle, level) => {
    setMuscleSoreness(muscle, level);
    // Trigger refresh
    window.location.reload(); // Simple refresh for now to trigger useEffect
  };

  // Stabilize performance calculations with useMemo
  const { strengthIndex, derivedOverall } = useMemo(() => {
    const bw = metrics.weight || 1;
    const bMultiplier = prs.bench.weight / bw;
    const sMultiplier = prs.squat.weight / bw;
    const dMultiplier = prs.deadlift.weight / bw;
    const rawIndex = (bMultiplier + sMultiplier + dMultiplier) / 3;
    const indexStr = rawIndex.toFixed(1);

    const isFemale = String(metrics.gender).toLowerCase() === "female";
    const refWt = isFemale ? FEMALE_REF_WT : MALE_REF_WT;
    const refHt = isFemale ? FEMALE_REF_HT : MALE_REF_HT;
    
    const bwKg = unit === "kg" ? bw : bw / 2.20462262;
    const heightCm = parseHeightToCm(metrics.height);
    
    const sAllometric = refWt * Math.pow(Math.max(1, bwKg) / refWt, 2/3);
    const cRaw = 1.0 - 0.012 * (heightCm - refHt);
    const cLeverage = Math.min(Math.max(cRaw, 0.80), 1.20);
    
    const getProgress = (liftKey, weightVal) => {
      if (bw <= 0 || weightVal <= 0) return 0;
      const actualLiftKg = unit === "kg" ? weightVal : weightVal / 2.20462262;
      const mults = isFemale ? MULTIPLIERS.female[liftKey] : MULTIPLIERS.male[liftKey];
      
      const tNovice = mults.novice * sAllometric * cLeverage;
      const tIntermediate = mults.intermediate * sAllometric * cLeverage;
      const tAdvanced = mults.advanced * sAllometric * cLeverage;
      const tElite = mults.elite * sAllometric * cLeverage;
      
      if (actualLiftKg < tNovice) {
        return (actualLiftKg / tNovice) * 25;
      } else if (actualLiftKg < tIntermediate) {
        return 25 + ((actualLiftKg - tNovice) / (tIntermediate - tNovice)) * 25;
      } else if (actualLiftKg < tAdvanced) {
        return 50 + ((actualLiftKg - tIntermediate) / (tAdvanced - tIntermediate)) * 25;
      } else if (actualLiftKg < tElite) {
        return 75 + ((actualLiftKg - tAdvanced) / (tElite - tAdvanced)) * 25;
      } else {
        return 100;
      }
    };
    
    const benchProgress = getProgress("bench", prs.bench.weight);
    const squatProgress = getProgress("squat", prs.squat.weight);
    const deadliftProgress = getProgress("deadlift", prs.deadlift.weight);
    
    const score = Math.round((benchProgress + squatProgress + deadliftProgress) / 3);
    
    return { strengthIndex: indexStr, derivedOverall: score };
  }, [metrics, prs, unit]);

  return (
    <PageShell title="Strength" subtitle="Analytics · Big Lifts & Recovery">
      {/* -- Overall Score ----------------------------------- */}
      {loading.prs || loading.metrics ? (
        <div className="glass-card skeleton" style={{ height: "420px", marginBottom: "12px", borderRadius: "22px" }} />
      ) : (
        <OverallRing score={derivedOverall} bw={metrics.weight} age={metrics.trainingYears} index={strengthIndex} />
      )}
      {/* -- Lift Cards --------------------------------------- */}
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

      {loading.prs || loading.metrics ? (
        <>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card skeleton" style={{ height: "92px", marginBottom: "12px", borderRadius: "22px" }} />
          ))}
        </>
      ) : (
        <>
          <LiftCard liftName="bench" weight={prs.bench.weight} bw={metrics.weight} delay={3} gender={metrics.gender} height={metrics.height} unit={unit} />
          <LiftCard liftName="squat" weight={prs.squat.weight} bw={metrics.weight} delay={4} gender={metrics.gender} height={metrics.height} unit={unit} />
          <LiftCard liftName="deadlift" weight={prs.deadlift.weight} bw={metrics.weight} delay={5} gender={metrics.gender} height={metrics.height} unit={unit} />
        </>
      )}

      {/* -- PRs -------------------------------------------- */}
      <div style={{ marginTop: "12px" }}>
        {loading.prs ? (
          <div className="glass-card skeleton" style={{ height: "130px", marginBottom: "12px", borderRadius: "22px" }} />
        ) : (
          <PRCard prData={prs} />
        )}
      </div>

      {/* -- Section label ----------------------------------- */}
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
        Strength by Muscle Group
      </div>

      {/* -- Strength rows ----------------------------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {loading.prs || loading.metrics ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card skeleton" style={{ height: "50px", borderRadius: "16px" }} />
            ))}
          </>
        ) : (
          [...dynamicScores].map((item, i) => (
            <StrengthRow key={item.muscle} item={item} delay={Math.min(i + 6, 8)} />
          ))
        )}
      </div>
    </PageShell>
  );
}
