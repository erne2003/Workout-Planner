// ─── Shared data constants used across all dashboard screens ───────────────

export const MUSCLE_RECOVERY = {
  chest:      { recovery: 42, status: "not_optimal" },
  shoulders:  { recovery: 78, status: "good" },
  biceps:     { recovery: 35, status: "not_optimal" },
  triceps:    { recovery: 88, status: "great" },
  lats:       { recovery: 61, status: "good" },
  core:       { recovery: 95, status: "great" },
  quads:      { recovery: 28, status: "not_optimal" },
  hamstrings: { recovery: 55, status: "good" },
  glutes:     { recovery: 70, status: "good" },
  calves:     { recovery: 91, status: "great" },
};

export const STRENGTH_SCORES = [
  { muscle: "Chest",     score: 0, prev: 0, color: "#0A84FF" },
  { muscle: "Back",      score: 0, prev: 0, color: "#30D158" },
  { muscle: "Shoulders", score: 0, prev: 0, color: "#FF9F0A" },
  { muscle: "Arms",      score: 0, prev: 0, color: "#BF5AF2" },
  { muscle: "Legs",      score: 0, prev: 0, color: "#FF2D55" },
  { muscle: "Core",      score: 0, prev: 0, color: "#FFD60A" },
];

export const OVERALL_STRENGTH_SCORE = 0;

export const PROGRESS_DATA = [
  { week: "W1", bench: 0, squat: 0, deadlift: 0 },
  { week: "W2", bench: 0, squat: 0, deadlift: 0 },
  { week: "W3", bench: 0, squat: 0, deadlift: 0 },
  { week: "W4", bench: 0, squat: 0, deadlift: 0 },
  { week: "W5", bench: 0, squat: 0, deadlift: 0 },
  { week: "W6", bench: 0, squat: 0, deadlift: 0 },
  { week: "W7", bench: 0, squat: 0, deadlift: 0 },
  { week: "W8", bench: 0, squat: 0, deadlift: 0 },
];

export const PERSONAL_RECORDS = {
  bench:    { weight: 0, unit: "lbs", gain: "" },
  squat:    { weight: 0, unit: "lbs", gain: "" },
  deadlift: { weight: 0, unit: "lbs", gain: "" },
};

export const WORKOUT_EXERCISES = [];

export const STATUS_COLOR = {
  great:       "#30D158",
  good:        "#0A84FF",
  not_optimal: "#FF2D55",
};

export const STATUS_LABEL = {
  great:       "Great",
  good:        "Good",
  not_optimal: "Not Optimal",
};

/**
 * Extract list of unique logged exercise names from workouts history.
 * @param {Array} workouts - Array of workout objects containing sets or exercises
 * @returns {Array<{name: string}>} Array of exercise objects with `name`
 */
export function getLoggedExercises(workouts = []) {
  if (!Array.isArray(workouts)) return [];

  const exerciseMap = new Map();

  workouts.forEach((w) => {
    if (!w) return;

    if (Array.isArray(w.sets)) {
      w.sets.forEach((s) => {
        const name = (s?.exercise_name || s?.name || "").trim();
        if (name) {
          const key = name.toLowerCase();
          if (!exerciseMap.has(key)) {
            exerciseMap.set(key, name);
          }
        }
      });
    }

    if (Array.isArray(w.exercises)) {
      w.exercises.forEach((ex) => {
        const name = (ex?.name || ex?.exercise_name || "").trim();
        if (name) {
          const key = name.toLowerCase();
          if (!exerciseMap.has(key)) {
            exerciseMap.set(key, name);
          }
        }
        if (Array.isArray(ex?.sets)) {
          ex.sets.forEach((s) => {
            const sName = (s?.exercise_name || s?.name || "").trim();
            if (sName) {
              const key = sName.toLowerCase();
              if (!exerciseMap.has(key)) {
                exerciseMap.set(key, sName);
              }
            }
          });
        }
      });
    }
  });

  return Array.from(exerciseMap.values())
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name }));
}

/**
 * Compute progress data points for a specific exercise over time.
 * @param {Array} workouts - Array of workout objects
 * @param {string} exerciseName - Name of the exercise to filter
 * @param {string} [timeRange="ALL"] - Time range filter ("1W", "1M", "3M", "6M", "1Y", "ALL")
 * @returns {Array<{date: string|Date, topSetWeight: number, topSetReps: number, estimated1RM: number, sessionVolume: number}>}
 */
export function getExerciseProgressPoints(workouts = [], exerciseName = "", timeRange = "ALL") {
  if (!Array.isArray(workouts) || !exerciseName) return [];

  const targetName = exerciseName.trim().toLowerCase();
  if (!targetName) return [];

  let cutoff = 0;
  const now = Date.now();
  const rangeDays = {
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
  };

  if (timeRange && rangeDays[timeRange]) {
    cutoff = now - rangeDays[timeRange] * 24 * 60 * 60 * 1000;
  }

  const sortedWorkouts = workouts
    .filter((w) => {
      if (!w) return false;
      const wDateRaw = w.created_at || w.date || w.logged_at;
      if (!wDateRaw) return true;
      const t = new Date(wDateRaw).getTime();
      return isNaN(t) || cutoff === 0 || t >= cutoff;
    })
    .sort((a, b) => {
      const tA = new Date(a.created_at || a.date || a.logged_at || 0).getTime();
      const tB = new Date(b.created_at || b.date || b.logged_at || 0).getTime();
      return tA - tB;
    });

  const points = [];

  sortedWorkouts.forEach((w) => {
    const matchingSets = [];

    if (Array.isArray(w.sets)) {
      w.sets.forEach((s) => {
        const name = (s?.exercise_name || s?.name || "").trim().toLowerCase();
        if (name === targetName) {
          matchingSets.push(s);
        }
      });
    }

    if (Array.isArray(w.exercises)) {
      w.exercises.forEach((ex) => {
        const exName = (ex?.name || ex?.exercise_name || "").trim().toLowerCase();
        if (exName === targetName && Array.isArray(ex.sets)) {
          ex.sets.forEach((s) => matchingSets.push(s));
        } else if (Array.isArray(ex.sets)) {
          ex.sets.forEach((s) => {
            const name = (s?.exercise_name || s?.name || "").trim().toLowerCase();
            if (name === targetName) {
              matchingSets.push(s);
            }
          });
        }
      });
    }

    if (matchingSets.length === 0) return;

    let topSetWeight = 0;
    let topSetReps = 0;
    let sessionVolume = 0;
    let estimated1RM = 0;

    matchingSets.forEach((s) => {
      const weight = parseFloat(s.weight) || 0;
      const reps = parseFloat(s.reps) || 0;

      sessionVolume += weight * reps;

      const e1RM = reps <= 1 ? weight : Math.round(weight * (1 + reps / 30));
      if (e1RM > estimated1RM) {
        estimated1RM = e1RM;
      }

      if (weight > topSetWeight || (weight === topSetWeight && reps > topSetReps)) {
        topSetWeight = weight;
        topSetReps = reps;
      }
    });

    const wDate = w.created_at || w.date || w.logged_at || new Date().toISOString();

    points.push({
      date: wDate,
      topSetWeight,
      topSetReps,
      estimated1RM,
      sessionVolume: Math.round(sessionVolume),
    });
  });

  return points;
}

