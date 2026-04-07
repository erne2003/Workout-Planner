"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../components/PageShell";
import PlateCalculator from "../components/PlateCalculator";
import { OVERALL_STRENGTH_SCORE, WORKOUT_EXERCISES } from "../lib/data";
import {
  RECOVERY_COLOR,
  getStatusFromPct,
  getMuscleSoreness,
  computeDynamicRecovery,
} from "../lib/recovery";

/* --- Helpers ----------------------------------------------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}



const RECOVERY_MUSCLES = ["chest", "shoulders", "quads", "lats"];

/* --- Stat Card --------------------------------------------- */
function StatCard({ label, value, unit, color = "#fff", delay }) {
  return (
    <div
      className={`glass-card animate-fade-up delay-${delay}`}
      style={{ flex: 1, padding: "14px 12px" }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "1px",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 800,
          letterSpacing: "-1px",
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              marginLeft: "2px",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* --- Page -------------------------------------------------- */
export default function HomePage() {
  const router = useRouter();

  const [sessionCount, setSessionCount] = useState(0);
  const [strengthScore, setStrengthScore] = useState(0);
  const [recoveryScore, setRecoveryScore] = useState(0);
  const [lastWorkout, setLastWorkout] = useState({
    name: "No Sessions Logged",
    subtitle: "Start a workout to see stats here",
    date: "-",
    duration: "0 min",
    volume: "0 lbs",
    sets: 0,
    exercises: [] // populated by name and sets mapping
  });

  const [strengthData, setStrengthData] = useState({});
  const [recoveryData, setRecoveryData] = useState({});
  const [showPlateCalc, setShowPlateCalc] = useState(true);

  useEffect(() => {
    setShowPlateCalc(localStorage.getItem("plateCalc") !== "false");
    
    const fetchDashboardDetails = async () => {
      try {
        const uId = localStorage.getItem("userId") || 1;
        
        // Fetch Body Weight
        const metReq = await fetch(`http://localhost:5000/metrics?userId=${uId}`);
        const metData = metReq.ok ? await metReq.json() : [];
        let bw = 1;
        if (metData.length > 0) {
            bw = parseFloat(metData[metData.length - 1].weight) || 1;
        }

        // Fetch PRs for Strength calculation
        const prReq = await fetch(`http://localhost:5000/prs?userId=${uId}`);
        const prData = prReq.ok ? await prReq.json() : [];
        const rawMaxes = { bench: 0, squat: 0, deadlift: 0, ohp: 0, rows: 0 };
        prData.forEach(p => {
            const e = p.exercise_name?.toLowerCase();
            const w = parseFloat(p.weight);
            if (["bench press", "bench", "chest press"].includes(e)) rawMaxes.bench = Math.max(rawMaxes.bench, w);
            else if (["squat", "barbell squat", "back squat"].includes(e)) rawMaxes.squat = Math.max(rawMaxes.squat, w);
            else if (["deadlift", "barbell deadlift", "rdl"].includes(e)) rawMaxes.deadlift = Math.max(rawMaxes.deadlift, w);
            else if (["ohp", "overhead press", "shoulder press"].includes(e)) rawMaxes.ohp = Math.max(rawMaxes.ohp, w);
            else if (["rows", "barbell row", "seated row", "pull"].includes(e)) rawMaxes.rows = Math.max(rawMaxes.rows, w);
        });

        const ELITE = { bench: 1.5, deadlift: 2.5, ohp: 0.9, squat: 2.0, rows: 1.2 };
        const calcScore = (cur, target) => Math.min(100, Math.round(((cur / bw) / target) * 100));

        const benchScore = calcScore(rawMaxes.bench, ELITE.bench);
        const dlScore = calcScore(rawMaxes.deadlift, ELITE.deadlift);
        const ohpScore = calcScore(rawMaxes.ohp, ELITE.ohp);
        const squatScore = calcScore(rawMaxes.squat, ELITE.squat);
        const rowScore = calcScore(rawMaxes.rows, ELITE.rows);

        const muscleScores = [
            benchScore,
            dlScore,
            ohpScore,
            squatScore,
            Math.round((benchScore * 0.5) + (rowScore * 0.5)), // Arms proxy
            Math.max(0, squatScore - 15) // Core proxy
        ];
        
        const avgPerf = Math.round(muscleScores.reduce((a, b) => a + b, 0) / muscleScores.length);
        const rawIndex = ((rawMaxes.bench / bw) + (rawMaxes.squat / bw) + (rawMaxes.deadlift / bw)) / 3;
        const perfBasis = (rawIndex / 1.5) * 100;
        
        setStrengthScore(Math.min(100, Math.round((perfBasis * 0.7) + (avgPerf * 0.3))));

        const res = await fetch(`http://localhost:5000/workouts?userId=${uId}`);
        if (!res.ok) return;
        const data = await res.json();

        // Recovery Logic
        const ALL_MUSCLES = [
            "chest", "shoulders", "biceps", "triceps",
            "lats", "core", "quads", "hamstrings", "glutes", "calves",
        ];
        const overrides = getMuscleSoreness();
        const recData = computeDynamicRecovery(ALL_MUSCLES, data, overrides);
        setRecoveryData(recData);
        
        const avgRec = Math.round(Object.values(recData).reduce((a, b) => a + b.pct, 0) / ALL_MUSCLES.length);
        setRecoveryScore(avgRec);

        if (data.length > 0) {
          // -- Aggregates: the Last 7 Days --
          const now = new Date();
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);

          let weekSessions = 0;
          data.forEach(w => {
            const wDate = new Date(w.created_at);
            if (wDate >= oneWeekAgo) {
              weekSessions++;
            }
          });
          setSessionCount(weekSessions);

          // -- Profile: The Last Workout --
          const lw = data[0];
          let lwVol = 0;
          const exMap = {};

          lw.sets?.forEach(s => {
            lwVol += (s.reps * s.weight);
            const nm = s.name || s.exercise_name || "Unknown Exercise";
            if (!exMap[nm]) { exMap[nm] = 0; }
            exMap[nm]++;
          });

          // Check if completion time was written in notes string securely
          const dMatch = typeof lw.notes === "string" ? lw.notes.match(/in (\d+:\d+)/) : null;
          const dStr = dMatch ? `${dMatch[1]} min` : "N/A";

          setLastWorkout({
            name: lw.name || "Workout Session",
            subtitle: Object.keys(exMap).slice(0, 3).join(" · ") || "-",
            date: new Date(lw.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            duration: dStr,
            volume: `${lwVol.toLocaleString()} lbs`,
            sets: lw.sets?.length || 0,
            exercises: Object.entries(exMap).map(([nm, ct], idx) => ({
              id: `ex-${idx}`,
              name: nm,
              setsLength: ct,
              accentColor: ["#0A84FF", "#FF2D55", "#FFD60A", "#30D158", "#BF5AF2"][idx % 5]
            }))
          });
        }
      } catch (e) {
        console.error("Dashboard pull failed", e);
      }
    };

    fetchDashboardDetails();
  }, []);

  return (
    <PageShell 
      title={`${greeting()}, ${localStorage.getItem("userName")?.split(" ")[0] || "User"}`} 
      subtitle={formatDate()}
      onSettingsClick={() => router.push("/settings")}
    >
      {/* Quick Stats */}
      {/* -- Quick Stats ------------------------------------ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <StatCard label="This Week" value={sessionCount} unit="sessions" color="#0A84FF" delay={1} />
        <StatCard 
          label="Recovery" 
          value={recoveryScore} 
          unit="%" 
          color={RECOVERY_COLOR[getStatusFromPct(recoveryScore)]} 
          delay={2} 
        />
        <StatCard 
          label="Strength" 
          value={strengthScore} 
          unit="/ 100" 
          color={strengthScore >= 90 ? "#FFD60A" : strengthScore >= 75 ? "#30D158" : strengthScore >= 60 ? "#0A84FF" : "#FF9F0A"} 
          delay={3} 
        />
      </div>

      {/* -- Start Workout CTA ------------------------------- */}
      <button
        onClick={() => router.push("/workout")}
        className="animate-fade-up delay-4"
        style={{
          width: "100%",
          padding: "18px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)",
          border: "none",
          color: "#fff",
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 800,
          letterSpacing: "0.3px",
          cursor: "pointer",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          boxShadow: "0 8px 32px rgba(10,132,255,0.25)",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <polygon points="6,3 17,10 6,17" fill="white" />
        </svg>
        Start Today's Workout
      </button>

      {/* -- Section label ----------------------------------- */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "10px",
        }}
      >
        Last Workout
      </div>

      {/* -- Last Workout Card ------------------------------- */}
      <div
        className="glass-card animate-fade-up delay-5"
        style={{ padding: "16px", marginBottom: "20px" }}
      >
        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              fontWeight: 800,
            }}
          >
            {lastWorkout.name}
          </span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            {lastWorkout.date}
          </span>
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "14px",
          }}
        >
          {lastWorkout.subtitle}
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "0", marginBottom: "14px" }}>
          {[
            { label: "Duration", value: lastWorkout.duration },
            { label: "Volume", value: lastWorkout.volume },
            { label: "Sets", value: `${lastWorkout.sets} sets` },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                textAlign: i === 1 ? "center" : i === 2 ? "right" : "left",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: "2px",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {lastWorkout.exercises.map((ex) => (
            <div
              key={ex.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: ex.accentColor,
                  boxShadow: `0 0 6px ${ex.accentColor}80`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "13px", fontWeight: 500, flex: 1 }}>
                {ex.name}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--text-tertiary)",
                  fontWeight: 500,
                }}
              >
                {ex.setsLength} sets
              </span>
            </div>
          ))}
        </div>
      </div>


      {showPlateCalc && <PlateCalculator />}
    </PageShell>
  );
}
