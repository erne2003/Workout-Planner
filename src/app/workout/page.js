"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSettings } from "../../contexts/SettingsContext";
import PageShell from "../../components/PageShell";
import { WORKOUT_EXERCISES } from "../../lib/data";
import { setLastWorkoutTime } from "../../lib/recovery";

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
  let done = 0, total = 0;
  exercises.forEach((ex, ei) =>
    ex.sets.forEach((_, si) => { total++; if (completed[`${ei}-${si}`]) done++; })
  );
  return { done, total };
}

/* ─── SetRow ────────────────────────────────────────────────── */
// prevSet: { reps, weight, rir } from last session, or null
function SetRow({ exIdx, setIdx, set, isDone, onToggle, prevSet }) {
  const ctx = useSettings();
  const unit = ctx?.weightUnit || "lbs";

  return (
    <button
      onClick={() => onToggle(exIdx, setIdx)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "11px 14px",
        borderRadius: "12px",
        background: isDone ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isDone ? "rgba(48,209,88,0.3)" : "rgba(255,255,255,0.06)"}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
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
          flexShrink: 0,
        }}
      >
        S{setIdx + 1}
      </span>

      {/* ── Previous session ghost ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          minWidth: "72px",
          paddingRight: "10px",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          gap: "1px",
        }}
      >
        {prevSet ? (
          <>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.28)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.3px",
              }}
            >
              {prevSet.weight}
              <span style={{ fontWeight: 500, fontSize: "9px" }}>{unit}</span>
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontWeight: 500 }}>
              {prevSet.reps}r
              {prevSet.rir != null && prevSet.rir !== undefined && (
                <span style={{ marginLeft: "3px" }}>{prevSet.rir}rir</span>
              )}
            </span>
          </>
        ) : (
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.12)", fontWeight: 500 }}>
            —
          </span>
        )}
      </div>

      {/* Weight */}
      <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "3px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "19px",
            fontWeight: 800,
            color: isDone ? "#30D158" : "var(--text-primary)",
            transition: "color 0.2s",
          }}
        >
          {set.weight}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 500 }}>{unit}</span>
      </div>

      {/* Reps + RIR */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 }}>
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

/* ─── ExerciseCard ──────────────────────────────────────────── */
function ExerciseCard({ exercise, exIdx, completed, onToggle, animDelay }) {
  const [prevSets, setPrevSets] = useState([]); // last session sets for this exercise

  // Fetch previous sets from backend when the card mounts
  useEffect(() => {
    const exerciseId = exercise.exerciseId || exercise.id;
    if (!exerciseId || String(exerciseId).startsWith("e")) return; // skip local mock IDs

    fetch(`http://localhost:5000/workouts/history/${exerciseId}?userId=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPrevSets(Array.isArray(data) ? data : []))
      .catch(() => setPrevSets([]));
  }, [exercise.exerciseId, exercise.id]);

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
            <span style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700 }}>
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

      {/* Column headers — only show if there's any previous data */}
      {prevSets.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            paddingLeft: "32px",      // align with set number width
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              minWidth: "72px",
              paddingRight: "10px",
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              color: "rgba(255,255,255,0.2)",
              textAlign: "right",
            }}
          >
            Last session
          </span>
          <span style={{ flex: 1, fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.2)" }}>
            Today
          </span>
        </div>
      )}

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
            prevSet={prevSets[si] ?? null}   // null if no matching set index last time
          />
        ))}
      </div>
    </div>
  );
}

/* ─── ExerciseSearch ────────────────────────────────────────── */
function ExerciseSearch({ onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEx, setSelectedEx] = useState(null);

  const handleBlur = () => setTimeout(() => setOpen(false), 200);

  useEffect(() => {
    // Only search if user typed something new and it's not just the selected exercise name
    if (query.trim() === "" || (selectedEx && query === selectedEx.name)) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:5000/exercises/search?name=${encodeURIComponent(query)}`);
        setResults(res.ok ? await res.json() : []);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [query, selectedEx]);

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", zIndex: 50 }}>
      {/* Search Input Container */}
      <div style={{ flex: 1, position: "relative" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedEx(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="Type to search exercises..."
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
          }}
        />
        {open && query.trim() !== "" && !selectedEx && (
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
              zIndex: 100,
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
                    setSelectedEx(ex);
                    setQuery(ex.name);
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

      {/* Add Button */}
      <button
        onClick={() => {
          if (selectedEx) {
            onAdd(selectedEx);
            setQuery("");
            setSelectedEx(null);
          }
        }}
        disabled={!selectedEx}
        style={{
          padding: "12px 20px",
          borderRadius: "10px",
          background: selectedEx ? "#30D158" : "rgba(255,255,255,0.1)",
          color: selectedEx ? "#000" : "rgba(255,255,255,0.3)",
          border: "none",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          cursor: selectedEx ? "pointer" : "not-allowed",
          transition: "all 0.2s",
        }}
      >
        Add
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function WorkoutPage() {
  const ctx = useSettings();
  const unit = ctx?.weightUnit || "lbs";

  // ── Existing Workout States ──
  const [started, setStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [completed, setCompleted] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Routine Management States ──
  const [routines, setRoutines] = useState([]);
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [isManagingRoutines, setIsManagingRoutines] = useState(false);
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineConfig, setNewRoutineConfig] = useState([]);
  const [expandedOverviewEx, setExpandedOverviewEx] = useState(null);

  // Fetch Routines on mount / refresh
  const fetchRoutines = async () => {
    try {
      const resR = await fetch("http://localhost:5000/routines?userId=1");
      const dataR = resR.ok ? await resR.json() : [];

      // Tag routines specifically
      const formattedR = dataR.map(r => ({ ...r, isPastWorkout: false }));

      // Sort by creation date
      const combined = [...formattedR].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      
      setRoutines(combined);
    } catch (e) {
      console.error("Failed to fetch routines:", e);
    }
  };

  const pathname = usePathname();

  useEffect(() => {
    fetchRoutines();
  }, [pathname]);

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
    if (nowDone) { setRestTimer(90); setIsResting(true); }
  };

  const { done, total } = completedCount(workoutPlan, completed);
  const overallPct = total ? (done / total) * 100 : 0;
  const volume = totalVolume(workoutPlan, completed);

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
      id: Date.now(),
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
        body: JSON.stringify({
          userId: localStorage.getItem("userId") || 1,
          name: activeRoutine?.name || "Workout Session",
          notes: `Finished with ${Math.round(overallPct)}% completion in ${fmt(elapsed)}`,
        }),
      });
      if (!workoutRes.ok) throw new Error("Failed to create workout");
      const { id: workoutId } = await workoutRes.json();

      for (let ei = 0; ei < workoutPlan.length; ei++) {
        const exercise = workoutPlan[ei];
        const exId = exercise.exerciseId || exercise.id || 1;
        for (let si = 0; si < exercise.sets.length; si++) {
          if (completed[`${ei}-${si}`]) {
            const set = exercise.sets[si];
            await fetch(`http://localhost:5000/workouts/${workoutId}/sets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ exerciseId: exId, setOrder: si + 1, reps: set.reps, weight: unit === "kg" ? Math.round(Number(set.weight) * 2.205) : Number(set.weight), rir: set.rir || 0 }),
            });
          }
        }
      }
      setLastWorkoutTime(new Date());
      fetchRoutines();
      setActiveRoutine(null);
      setStarted(false);
      setElapsed(0);
      setCompleted({});
    } catch (err) {
      console.error("Error saving workout:", err);
      // Still close the workout view, even on error so they aren't stuck forever.
      setActiveRoutine(null);
      setStarted(false);
      setLastWorkoutTime(new Date());
    } finally {
      setIsSaving(false);
    }
  };

  // ── Routine CRUD Handlers ──
  const deleteRoutine = async (rId) => {
    if (!confirm("Delete this routine?")) return;
    try {
      await fetch(`http://localhost:5000/routines/${rId}`, { method: "DELETE" });
      fetchRoutines();
    } catch (e) {
      console.error(e);
    }
  };

  const saveNewRoutine = async () => {
    if (!newRoutineName.trim() || newRoutineConfig.length === 0) return alert("Add a name and exercises!");
    try {
      await fetch("http://localhost:5000/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 1, name: newRoutineName, exercises: newRoutineConfig }),
      });
      setIsCreatingRoutine(false);
      setNewRoutineName("");
      setNewRoutineConfig([]);
      fetchRoutines();
    } catch (e) {
      console.error(e);
      alert("Failed to save routine");
    }
  };

  const selectRoutine = (item) => {
    if (isManagingRoutines) return; 
    
    let plan = [];

    if (item.isPastWorkout) {
      // It's a past workout with individual sets. Group them by exercise.
      const exercisesMap = {};
      item.sets.forEach(set => {
        if (!exercisesMap[set.exercise_id]) {
          exercisesMap[set.exercise_id] = {
            id: set.exercise_id,
            name: set.name || set.exercise_name,
            muscle: set.muscle_group,
            accentColor: "#0A84FF",
            sets: []
          };
        }
        exercisesMap[set.exercise_id].sets.push({
          reps: set.reps, weight: unit === "kg" ? Math.round(Number(set.weight) / 2.205) : Number(set.weight), rir: set.rir !== null ? set.rir : 0
        });
      });
      plan = Object.values(exercisesMap);
    } else {
      // It's a template routine with bulk exercise params
      plan = item.exercises.map(ex => {
        const setsObj = Array(ex.sets).fill(0).map(() => ({
          reps: ex.reps, weight: unit === "kg" ? Math.round(Number(ex.weight) / 2.205) : Number(ex.weight), rir: ex.rir
        }));
        return {
          ...ex,
          id: ex.exercise_id, 
          sets: setsObj,
          accentColor: "#0A84FF", // Default color
        };
      });
    }

    setActiveRoutine(item);
    setWorkoutPlan(plan);
    setStarted(false);
    setIsEditing(false);
  };


  /* ── Routines List View ──────────────────────────────────────── */
  if (!activeRoutine) {
    return (
      <PageShell title="Workouts" subtitle="Choose or build a routine">
        
        {/* Routines Header & Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <button 
            onClick={() => setIsManagingRoutines(!isManagingRoutines)}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: isManagingRoutines ? "#FF2D55" : "var(--text-secondary)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}
          >
            {isManagingRoutines ? "Done Editing" : "Edit List"}
          </button>
          
          <button 
            onClick={() => setIsCreatingRoutine(true)}
            style={{ background: "#30D158", border: "none", color: "#000", padding: "6px 14px", borderRadius: "8px", fontSize: "16px", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            +
          </button>
        </div>

        {/* Create Routine Modal Overlay */}
        {isCreatingRoutine && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", flexDirection: "column", padding: "40px 20px 100px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>New Routine</h2>
              <button onClick={() => setIsCreatingRoutine(false)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: "24px" }}>×</button>
            </div>
            
            <input 
              value={newRoutineName}
              onChange={e => setNewRoutineName(e.target.value)}
              placeholder="Workout Name (e.g. Pull Day)" 
              style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-primary)", marginBottom: "20px", fontSize: "16px", fontFamily: "var(--font-display)", fontWeight: 700 }}
            />

            <div style={{ marginBottom: "20px" }}>
              <ExerciseSearch onAdd={(ex) => setNewRoutineConfig([...newRoutineConfig, { ...ex, sets: 3, reps: 10, weight: 0, rir: 0 }])} />
            </div>

            {/* Added Exercises List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {newRoutineConfig.map((ex, idx) => (
                <div key={idx} className="glass-card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{ex.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{ex.sets} sets x {ex.reps} reps</div>
                  </div>
                  <button onClick={() => setNewRoutineConfig(newRoutineConfig.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "#FF2D55", fontSize: "20px" }}>-</button>
                </div>
              ))}
            </div>

            <button onClick={saveNewRoutine} style={{ marginTop: "auto", width: "100%", padding: "16px", borderRadius: "16px", background: "#30D158", color: "#000", fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, border: "none", cursor: "pointer" }}>
              Save Routine
            </button>
          </div>
        )}

        {/* Existing Routines & Workouts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", flex: 1, paddingBottom: "20px" }}>
          {routines.map(r => (
            <div 
              key={`item-${r.isPastWorkout ? 'w' : 'r'}-${r.id}`} 
              className="glass-card transition-all active:scale-[0.98]" 
              onClick={() => selectRoutine(r)}
              style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: isManagingRoutines ? "default" : "pointer", position: "relative" }}
            >
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
                  {r.name} 
                  {r.isPastWorkout && <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, marginLeft: "8px", textTransform: "uppercase" }}>Completed Session</span>}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                  {r.isPastWorkout 
                    ? `${new Date(r.created_at).toLocaleDateString()} · ${[...new Set(r.sets?.map(s => s.exercise_id))].length} exercises` 
                    : `${r.exercises?.length || 0} exercises`}
                </div>
              </div>
              
              {isManagingRoutines && !r.isPastWorkout ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteRoutine(r.id); }}
                  style={{ background: "#FF2D55", border: "none", borderRadius: "50%", width: "24px", height: "24px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontWeight: 800 }}
                >
                  -
                </button>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
              )}
            </div>
          ))}
          {routines.length === 0 && !isCreatingRoutine && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-tertiary)" }}>
              No routines yet. Click + to build one!
            </div>
          )}
        </div>

      </PageShell>
    );
  }


  /* ── Edit screen ──────────────────────────────────────────────── */
  if (isEditing) {
    return (
      <PageShell title="Edit Workout" subtitle="Customize exercises & sets">
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "80px" }}>
          {workoutPlan.map((ex, ei) => (
            <div key={ex.id || ei} className="glass-card animate-fade-up shadow-xl" style={{ padding: "24px 20px", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 700 }}>{ex.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{ex.muscle}</div>
                </div>
                <button onClick={() => removeExercise(ei)} style={{ background: "none", border: "none", color: "#FF2D55", fontSize: "12px", cursor: "pointer", fontWeight: 700 }}>
                  Remove
                </button>
              </div>

              {ex.sets.map((set, si) => (
                <div key={si} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", width: "22px" }}>S{si + 1}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="number" value={set.weight} onChange={(e) => updateSet(ei, si, "weight", e.target.value)} style={{ width: "70px", padding: "6px 4px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700 }} />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>{unit}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="number" value={set.reps} onChange={(e) => updateSet(ei, si, "reps", e.target.value)} style={{ width: "60px", padding: "6px 4px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", outline: "none", textAlign: "right", fontFamily: "var(--font-display)", fontWeight: 700 }} />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>reps</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input type="number" value={set.rir !== undefined ? set.rir : 0} onChange={(e) => updateSet(ei, si, "rir", e.target.value)} style={{ width: "50px", padding: "8px 6px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--accent-blue)", outline: "none", textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800 }} />
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>RIR</span>
                  </div>
                  <button onClick={() => removeSet(ei, si)} style={{ marginLeft: "auto", background: "rgba(255,45,85,0.1)", border: "none", borderRadius: "8px", width: "24px", height: "24px", color: "#FF2D55", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} title="Remove Set">×</button>
                </div>
              ))}

              <button onClick={() => addSet(ei)} style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.2)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                + Add Set
              </button>
            </div>
          ))}

          <div className="glass-card" style={{ padding: "16px", border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.02)", overflow: "visible" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px", color: "var(--text-secondary)" }}>Add Exercise to Workout</div>
            <ExerciseSearch onAdd={addExercise} />
          </div>

          <button onClick={() => setIsEditing(false)} style={{ position: "fixed", bottom: "100px", left: "20px", width: "calc(100% - 40px)", padding: "16px", borderRadius: "16px", background: "#30D158", color: "#000", fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, border: "none", cursor: "pointer", zIndex: 100 }}>
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
      <PageShell 
        title={activeRoutine.name} 
        subtitle="Workout Overview"
        backAction={() => setActiveRoutine(null)}
      >
        <div className="glass-card animate-fade-up delay-1" style={{ padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "0" }}>
            {[
              { label: "Exercises", value: workoutPlan.length },
              { label: "Total Sets", value: totalSets },
              { label: "Est. Time", value: `~${estMins}m` },
            ].map(({ label, value }, i) => (
              <div key={label} style={{ flex: 1, textAlign: i === 1 ? "center" : i === 2 ? "right" : "left" }}>
                <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>{label}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 800, letterSpacing: "-1px", color: "var(--text-primary)" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "8px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.1)", marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text-tertiary)", marginBottom: "10px", padding: "4px 8px 0" }}>Exercises</div>
          {workoutPlan.map((ex, ei) => {
            const isExpanded = expandedOverviewEx === ei;
            return (
            <div 
              key={ex.id || ei} 
              className={`glass-card animate-fade-up delay-${Math.min(ei + 2, 6)}`} 
              style={{ padding: "14px 16px", marginBottom: "8px", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => setExpandedOverviewEx(isExpanded ? null : ei)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ex.accentColor, boxShadow: `0 0 8px ${ex.accentColor}80`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, marginBottom: "2px" }}>{ex.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{ex.muscle}</div>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                  {ex.sets.length} sets 
                  <span style={{ marginLeft: "6px", opacity: 0.5 }}>{isExpanded ? '▲' : '▼'}</span>
                </span>
              </div>
              
              {isExpanded && (
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {ex.sets.map((set, si) => (
                    <div key={si} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 600 }}>Set {si + 1}</span>
                      <span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{set.weight}</span> {unit} × <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{set.reps}</span> reps
                        {set.rir > 0 && <span style={{ marginLeft: "8px", color: "var(--text-tertiary)" }}>(RIR: {set.rir})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )})}
        </div>

        <button
          onClick={() => setStarted(true)}
          style={{ width: "100%", padding: "18px", borderRadius: "18px", background: "linear-gradient(135deg, #0A84FF 0%, #BF5AF2 100%)", border: "none", color: "#fff", fontFamily: "var(--font-display)", fontSize: "16px", fontWeight: 800, letterSpacing: "0.3px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 8px 32px rgba(10,132,255,0.25)", transition: "transform 0.15s" }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polygon points="6,3 17,10 6,17" fill="white" /></svg>
          Start Workout
        </button>

        <button
          onClick={() => setIsEditing(true)}
          style={{ width: "100%", padding: "14px", borderRadius: "14px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-secondary)", fontFamily: "var(--font-display)", fontSize: "14px", fontWeight: 700, letterSpacing: "0.3px", cursor: "pointer", marginTop: "12px", transition: "all 0.2s" }}
          onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
          ✎ Edit Workout
        </button>
      </PageShell>
    );
  }

  /* ── Active workout screen ───────────────────────────────────── */
  return (
    <PageShell 
      title={activeRoutine.name} 
      subtitle="Tracker Active" 
      badge="LIVE" 
      badgeColor="badge-red"
    >
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <div className="glass-card animate-fade-up delay-1" style={{ flex: 1, padding: "14px 16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Duration</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, letterSpacing: "-1.5px", color: "var(--text-primary)" }}>{fmt(elapsed)}</div>
        </div>
        <div className="glass-card animate-fade-up delay-2" style={{ flex: 1, padding: "14px 16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Volume</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, letterSpacing: "-1.5px", color: "#FFD60A" }}>
            {volume.toLocaleString()}<span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-body)", fontWeight: 500 }}> {unit}</span>
          </div>
        </div>
        <div className="glass-card animate-fade-up delay-3" style={{ flex: 1, padding: "14px 16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Sets</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 800, letterSpacing: "-1.5px", color: "#30D158" }}>
            {done}<span style={{ fontSize: "16px", color: "var(--text-tertiary)", fontWeight: 500 }}>/{total}</span>
          </div>
        </div>
      </div>

      <div className="glass-card animate-fade-up delay-4" style={{ padding: "14px 16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Workout Progress</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "12px", fontWeight: 700, color: overallPct === 100 ? "#30D158" : "#0A84FF" }}>{Math.round(overallPct)}%</span>
        </div>
        <div className="bar-track" style={{ height: "8px" }}>
          <div className="bar-fill" style={{ width: `${overallPct}%`, background: overallPct === 100 ? "#30D158" : "linear-gradient(90deg, #0A84FF, #BF5AF2)" }} />
        </div>
      </div>

      {isResting && (
        <div className="glass-card" style={{ padding: "14px 18px", marginBottom: "16px", borderColor: "rgba(255,159,10,0.3)", background: "rgba(255,159,10,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#FF9F0A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>Rest Timer</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "26px", fontWeight: 800, letterSpacing: "-1px", color: "#FF9F0A" }}>{fmt(restTimer)}</div>
          </div>
          <button onClick={() => { setIsResting(false); setRestTimer(0); }} style={{ padding: "8px 16px", borderRadius: "10px", background: "rgba(255,159,10,0.2)", border: "1px solid rgba(255,159,10,0.4)", color: "#FF9F0A", fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }}>Skip</button>
        </div>
      )}

      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text-tertiary)", marginBottom: "12px" }}>Exercises</div>

      {workoutPlan.map((ex, ei) => (
        <ExerciseCard key={ex.id} exercise={ex} exIdx={ei} completed={completed} onToggle={toggle} animDelay={Math.min(ei + 2, 6)} />
      ))}

      <button
        onClick={finishWorkout}
        disabled={isSaving}
        style={{ width: "100%", padding: "16px", borderRadius: "16px", background: overallPct === 100 ? "linear-gradient(135deg, #30D158, #0A84FF)" : "rgba(255,255,255,0.06)", border: `1px solid ${overallPct === 100 ? "transparent" : "rgba(255,255,255,0.1)"}`, color: "#fff", fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 800, letterSpacing: "0.5px", cursor: isSaving ? "wait" : "pointer", transition: "all 0.3s", marginTop: "4px", opacity: isSaving ? 0.7 : 1 }}
      >
        {isSaving ? "Saving to Database..." : overallPct === 100 ? "🎉 Complete Workout" : `Finish Early (${Math.round(overallPct)}%)`}
      </button>
    </PageShell>
  );
}