"use client";
import { useState, useEffect } from "react";
import PageShell from "../../components/PageShell";
import { WORKOUT_EXERCISES } from "../../lib/data";
import { setLastWorkoutTime } from "../../lib/recovery";

// A mini-catalog for adding new exercises on the fly.
const AVAILABLE_EXERCISES = [
  { id: "e1", name: "Barbell Squat", muscle: "Quads", accentColor: "#FF2D55" },
  { id: "e2", name: "Overhead Press", muscle: "Shoulders", accentColor: "#FF9F0A" },
  { id: "e3", name: "Deadlift", muscle: "Hamstrings", accentColor: "#FFD60A" },
  { id: "e4", name: "Pull-ups", muscle: "Back", accentColor: "#30D158" },
  { id: "e5", name: "Bicep Curls", muscle: "Biceps", accentColor: "#0A84FF" },
  { id: "e6", name: "Leg Extensions", muscle: "Quads", accentColor: "#BF5AF2" },
];

/* ─── Helpers ───────────────────────────────────────────────── */
function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function totalVolume(exercises, completed) {
  let vol = 0;
  exercises.forEach((ex, ei) =>
    ex.sets.forEach((set, si) => {
      if (completed[`${ei}-${si}`]) vol += set.reps * set.weight;
    })
  );
  return vol;
}

function completedCount(exercises, completed) {
  let done = 0;
  let total = 0;
  exercises.forEach((ex, ei) =>
    ex.sets.forEach((_, si) => {
      total++;
      if (completed[`${ei}-${si}`]) done++;
    })
  );
  return { done, total };
}

/* ─── Sub-components ────────────────────────────────────────── */
function SetRow({ exIdx, setIdx, set, isDone, onToggle }) {
  return (
    <button
      onClick={() => onToggle(exIdx, setIdx)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: "11px 14px",
        borderRadius: "12px",
        border: `1px solid ${isDone ? "rgba(48,209,88,0.25)" : "rgba(255,255,255,0.06)"}`,
        background: isDone ? "rgba(48,209,88,0.07)" : "rgba(255,255,255,0.025)",
        cursor: "pointer",
        transition: "all 0.2s",
        textAlign: "left",
      }}
    >
      {/* Set number */}
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--text-tertiary)",
          width: "22px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        S{setIdx + 1}
      </span>

      {/* Weight */}
      <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "19px",
            fontWeight: 800,
            color: isDone ? "#30D158" : "#fff",
            transition: "color 0.2s",
          }}
        >
          {set.weight}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 500 }}>lbs</span>
      </div>

      {/* Reps */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          {set.reps} reps
        </span>
        {set.rir !== undefined && (
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>
            {set.rir} RIR
          </span>
        )}
      </div>

      {/* Check circle */}
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          border: `2px solid ${isDone ? "#30D158" : "rgba(255,255,255,0.15)"}`,
          background: isDone ? "#30D158" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </button>
  );
}

function ExerciseCard({ exercise, exIdx, completed, onToggle, animDelay }) {
  const done = exercise.sets.filter((_, si) => completed[`${exIdx}-${si}`]).length;
  const pct = (done / exercise.sets.length) * 100;

  return (
    <div
      className={`glass-card animate-fade-up delay-${animDelay}`}
      style={{ padding: "16px", marginBottom: "12px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: exercise.accentColor,
                boxShadow: `0 0 8px ${exercise.accentColor}80`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "15px",
                fontWeight: 700,
              }}
            >
              {exercise.name}
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "16px" }}>
            {exercise.muscle}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "12px",
            fontWeight: 700,
            color: done === exercise.sets.length ? "#30D158" : "var(--text-secondary)",
          }}
        >
          {done}/{exercise.sets.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="bar-track" style={{ marginBottom: "14px" }}>
        <div
          className="bar-fill"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? "#30D158" : exercise.accentColor,
          }}
        />
      </div>

      {/* Sets */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {exercise.sets.map((set, si) => (
          <SetRow
            key={si}
            exIdx={exIdx}
            setIdx={si}
            set={set}
            isDone={!!completed[`${exIdx}-${si}`]}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function ExerciseSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleBlur = () => setTimeout(() => setOpen(false), 200);

  useEffect(() => {
    if (query.trim() === "") {
        setResults([]);
        return;
    }

    const delayDebounceFn = setTimeout(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:5000/exercises/search?name=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error("Failed to search exercises", error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div style={{ position: "relative", height: "150px", overflowY: "scroll", }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder="Type to search DB & API Ninjas..."
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          outline: "none",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          position: "relative",
          top: "0px"
        }}
      />
      {open && query.trim() !== "" && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#1c1c1e",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            marginTop: "6px",
            zIndex: 10,
            maxHeight: "160px",
            overflowY: "auto",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {isLoading ? (
            <div style={{ padding: "12px", color: "var(--text-tertiary)", fontSize: "13px", textAlign: "center" }}>
              Searching...
            </div>
          ) : results.length > 0 ? (
            results.map((ex) => (
              <div
                key={ex.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(ex);
                  setQuery("");
                  setOpen(false);
                }}
                style={{
                  padding: "12px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff", fontSize: "14px" }}>
                  {ex.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  {ex.muscle_group || ex.muscle}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "12px", color: "var(--text-tertiary)", fontSize: "13px", textAlign: "center" }}>
              No exercises found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function WorkoutPage() {
  const [started, setStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState(WORKOUT_EXERCISES);
  const [completed, setCompleted] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [started]);

  useEffect(() => {
    if (!isResting) return;
    if (restTimer <= 0) { setIsResting(false); return; }
    const t = setTimeout(() => setRestTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [isResting, restTimer]);

  const toggle = (ei, si) => {
    if (isSaving) return;
    const key = `${ei}-${si}`;
    const nowDone = !completed[key];
    setCompleted((prev) => ({ ...prev, [key]: nowDone }));
    if (nowDone) {
      setRestTimer(90);
      setIsResting(true);
    }
  };

  const { done, total } = completedCount(workoutPlan, completed);
  const overallPct = total ? (done / total) * 100 : 0;
  const volume = totalVolume(workoutPlan, completed);

  // ── Handlers for Editing Workout ────────────────────────────────
  const addSet = (exIdx) => {
    const newPlan = [...workoutPlan];
    const sets = newPlan[exIdx].sets;
    const lastSet = sets[sets.length - 1] || { reps: 10, weight: 0, rir: 0 };
    sets.push({ ...lastSet });
    setWorkoutPlan(newPlan);
  };
  const removeSet = (exIdx, setIdx) => {
    const newPlan = [...workoutPlan];
    newPlan[exIdx].sets.splice(setIdx, 1);
    setWorkoutPlan(newPlan);
  };
  const updateSet = (exIdx, setIdx, field, val) => {
    const newPlan = [...workoutPlan];
    newPlan[exIdx].sets[setIdx][field] = Number(val);
    setWorkoutPlan(newPlan);
  };
  const removeExercise = (exIdx) => {
    const newPlan = [...workoutPlan];
    newPlan.splice(exIdx, 1);
    setWorkoutPlan(newPlan);
  };
  const addExercise = (exercise) => {
    if (!exercise) return;
    const newPlan = [...workoutPlan];
    newPlan.push({
      ...exercise,
      muscle: exercise.muscle_group || exercise.muscle,
      accentColor: "#30D158",
      exerciseId: exercise.id,
      id: Date.now(), // Generate a unique instance ID for React
      sets: [{ reps: 10, weight: 0, rir: 0 }],
    });
    setWorkoutPlan(newPlan);
  };

  const finishWorkout = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
        const workoutRes = await fetch("http://localhost:5000/workouts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: 1, name: "Push Day API Sync", notes: `Finished with ${Math.round(overallPct)}% completion in ${fmt(elapsed)}` })
        });
        
        if (!workoutRes.ok) throw new Error("Failed to create workout");
        const workoutData = await workoutRes.json();
        const workoutId = workoutData.id;
        
        // Loop over completed sets and POST them to PostgreSQL backend
        for (let ei = 0; ei < workoutPlan.length; ei++) {
           const exercise = workoutPlan[ei];
           const exId = exercise.exerciseId || exercise.id || 1; 
           
           for (let si = 0; si < exercise.sets.length; si++) {
               if (completed[`${ei}-${si}`]) {
                   const set = exercise.sets[si];
                   await fetch(`http://localhost:5000/workouts/${workoutId}/sets`, {
                       method: "POST",
                       headers: { "Content-Type": "application/json" },
                       body: JSON.stringify({
                           exerciseId: exId,
                           setOrder: si + 1,
                           reps: set.reps,
                           weight: set.weight,
                           rir: set.rir || 0
                       })
                   });
               }
           }
        }
        
        setLastWorkoutTime(new Date());
        setIsSaving(false);
    } catch (err) {
        console.error("Error saving workout to database:", err);
        setIsSaving(false);
        setLastWorkoutTime(new Date()); 
    }
  };

  /* ── Edit screen ──────────────────────────────────────────────── */
  if (isEditing) {
    return (
      <PageShell title="Edit Workout" subtitle="Customize exercises & sets">
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "80px", }}>
          {workoutPlan.map((ex, ei) => (
            <div key={ex.id || ei} className="glass-card" style={{ padding: "20px", paddingRight: "20px", width: "100%", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>{ex.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{ex.muscle}</div>
                </div>
                <button
                  onClick={() => removeExercise(ei)}
                  style={{ background: "none", border: "none", color: "#FF2D55", fontSize: "12px", cursor: "pointer", fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>

              {ex.sets.map((set, si) => (
                <div key={si} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", width: "22px" }}>
                    S{si + 1}
                  </div>

                  {/* Weight */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => updateSet(ei, si, "weight", e.target.value)}
                      style={{ width: "60px", padding: "6px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>lbs</span>
                  </div>

                  {/* Reps */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(ei, si, "reps", e.target.value)}
                      style={{ width: "50px", padding: "6px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>reps</span>
                  </div>

                  {/* RIR */}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="number"
                      value={set.rir !== undefined ? set.rir : 0}
                      onChange={(e) => updateSet(ei, si, "rir", e.target.value)}
                      style={{ width: "40px", padding: "6px 8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700 }}
                    />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>RIR</span>
                  </div>

                  {/* Cross Remove Button */}
                  <button
                    onClick={() => removeSet(ei, si)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-tertiary)", fontSize: "18px", cursor: "pointer", padding: "0 8px", transition: "color 0.2s" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#FF2D55")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                    title="Remove Set"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={() => addSet(ei)}
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                + Add Set
              </button>
            </div>
          ))}

          {/* Add Exercise UI */}
          <div className="glass-card" style={{ minHeight: "120px", maxHeight: "200px", overflowY: "auto", overflowX: "hidden", wordBreak: "break-word", padding: "16px", border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px", color: "var(--text-secondary)" }}>
              Add Exercise to Workout
            </div>
            <ExerciseSearch onSelect={addExercise} />
          </div>

          <button
            onClick={() => setIsEditing(false)}
            style={{ position: "fixed", bottom: "80px", left: "20px", width: "calc(100% - 40px)", padding: "16px", borderRadius: "16px", background: "#30D158", color: "#000", fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, border: "none", cursor: "pointer", zIndex: 100 }}
          >
            Done Editing
          </button>
        </div>
      </PageShell>
    );
  }

  /* ── Pre-workout screen ──────────────────────────────────────── */
  if (!started) {
    const totalSets = workoutPlan.reduce((a, ex) => a + ex.sets.length, 0);
    const estMins = Math.round(totalSets * 1.8);
    return (
      <PageShell title="Push Day" subtitle="Chest · Triceps · Shoulders">
        {/* Overview card */}
        <div className="glass-card animate-fade-up delay-1" style={{ padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "0" }}>
            {[
              { label: "Exercises", value: WORKOUT_EXERCISES.length },
              { label: "Total Sets", value: totalSets },
              { label: "Est. Time", value: `~${estMins}m` },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ flex: 1, textAlign: i === 1 ? "center" : i === 2 ? "right" : "left" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                  {label}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, letterSpacing: "-1px", color: "#fff" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exercise preview list */}
        <div style={{ padding: "8px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.1)", marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text-tertiary)", marginBottom: "10px", padding: "4px 8px 0" }}>
            Exercises
          </div>
          {workoutPlan.map((ex, ei) => (
            <div
              key={ex.id || ei}
              className={`glass-card animate-fade-up delay-${Math.min(ei + 2, 6)}`}
              style={{ padding: "14px 16px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ex.accentColor, boxShadow: `0 0 8px ${ex.accentColor}80`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>{ex.name}</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{ex.muscle}</div>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{ex.sets.length} sets</span>
            </div>
          ))}

        </div>

        {/* Start button */}
        <button
          onClick={() => setStarted(true)}
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            boxShadow: "0 8px 32px rgba(10,132,255,0.25)",
            transition: "transform 0.15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <polygon points="6,3 17,10 6,17" fill="white" />
          </svg>
          Start Workout
        </button>

        {/* Edit button */}
        <button
          onClick={() => setIsEditing(true)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-display)",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.3px",
            cursor: "pointer",
            marginTop: "12px",
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
          ✎ Edit Workout
        </button>
      </PageShell>
    );
  }

  return (
    <PageShell title="Push Day" subtitle="Chest · Triceps · Shoulders" badge="LIVE" badgeColor="badge-red">
      {/* ── Top Stats Row ─────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        {/* Timer */}
        <div
          className="glass-card animate-fade-up delay-1"
          style={{ flex: 1, padding: "14px 16px" }}
        >
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
            Duration
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-1.5px",
              color: "#fff",
            }}
          >
            {fmt(elapsed)}
          </div>
        </div>

        {/* Volume */}
        <div
          className="glass-card animate-fade-up delay-2"
          style={{ flex: 1, padding: "14px 16px" }}
        >
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
            Volume
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-1.5px",
              color: "#FFD60A",
            }}
          >
            {volume.toLocaleString()}
            <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-body)", fontWeight: 500 }}> lbs</span>
          </div>
        </div>

        {/* Sets done */}
        <div
          className="glass-card animate-fade-up delay-3"
          style={{ flex: 1, padding: "14px 16px" }}
        >
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
            Sets
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-1.5px",
              color: "#30D158",
            }}
          >
            {done}
            <span style={{ fontSize: "16px", color: "var(--text-tertiary)", fontWeight: 500 }}>/{total}</span>
          </div>
        </div>
      </div>

      {/* ── Overall Progress ──────────────────────────────── */}
      <div
        className="glass-card animate-fade-up delay-4"
        style={{ padding: "14px 16px", marginBottom: "20px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Workout Progress</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "12px",
              fontWeight: 700,
              color: overallPct === 100 ? "#30D158" : "#0A84FF",
            }}
          >
            {Math.round(overallPct)}%
          </span>
        </div>
        <div className="bar-track" style={{ height: "8px" }}>
          <div
            className="bar-fill"
            style={{
              width: `${overallPct}%`,
              background: overallPct === 100
                ? "#30D158"
                : "linear-gradient(90deg, #0A84FF, #BF5AF2)",
            }}
          />
        </div>
      </div>

      {/* ── Rest Timer Banner ─────────────────────────────── */}
      {isResting && (
        <div
          className="glass-card"
          style={{
            padding: "14px 18px",
            marginBottom: "16px",
            borderColor: "rgba(255,159,10,0.3)",
            background: "rgba(255,159,10,0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "#FF9F0A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Rest Timer
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "-1px",
                color: "#FF9F0A",
              }}
            >
              {fmt(restTimer)}
            </div>
          </div>
          <button
            onClick={() => { setIsResting(false); setRestTimer(0); }}
            style={{
              padding: "8px 16px",
              borderRadius: "10px",
              background: "rgba(255,159,10,0.2)",
              border: "1px solid rgba(255,159,10,0.4)",
              color: "#FF9F0A",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Skip
          </button>
        </div>
      )}

      {/* ── Section Label ─────────────────────────────────── */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.4px",
          color: "var(--text-tertiary)",
          marginBottom: "12px",
        }}
      >
        Exercises
      </div>

      {/* ── Exercise Cards ────────────────────────────────── */}
      {workoutPlan.map((ex, ei) => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          exIdx={ei}
          completed={completed}
          onToggle={toggle}
          animDelay={Math.min(ei + 2, 6)}
        />
      ))}

      {/* ── Finish Button ─────────────────────────────────── */}
      <button
        onClick={finishWorkout}
        disabled={isSaving}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: "16px",
          background: overallPct === 100
            ? "linear-gradient(135deg, #30D158, #0A84FF)"
            : "rgba(255,255,255,0.06)",
          border: `1px solid ${overallPct === 100 ? "transparent" : "rgba(255,255,255,0.1)"}`,
          color: "#fff",
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          fontWeight: 800,
          letterSpacing: "0.5px",
          cursor: isSaving ? "wait" : "pointer",
          transition: "all 0.3s",
          marginTop: "4px",
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? "Saving to Database..." : overallPct === 100 ? "🎉 Complete Workout" : `Finish Early (${Math.round(overallPct)}%)`}
      </button>
    </PageShell>
  );
}
