/**
 * Recovery utilities: time-based color logic + optional manual soreness overrides.
 *
 * Color thresholds (hours since last workout):
 *   ≥ 24h  → green  (#30D158)  "Fresh"
 *   ≥ 12h  → orange (#FF9F0A)  "Moderate"
 *   <  12h → red    (#FF2D55)  "Sore"
 *
 * Manual soreness levels (set by the user per muscle):
 *   "fresh" | "moderate" | "sore"
 *
 * localStorage keys:
 *   "lastWorkoutTime"   - ISO timestamp of when last workout was completed
 *   "muscleSoreness"    - JSON object { [muscleName]: "fresh"|"moderate"|"sore" }
 */

import { getStorage } from "./storage";

export const RECOVERY_COLOR = {
  fully_recovered:     "#30D158", // Green ✅
  mostly_recovered:    "#FFD60A", // Yellow 🟡
  partially_recovered: "#FF9F0A", // Orange 🟠
  not_recovered:       "#FF2D55", // Red 🔴
};

export const RECOVERY_LABEL = {
  fully_recovered:     "Fully Recovered",
  mostly_recovered:    "Mostly Recovered",
  partially_recovered: "Partially Recovered",
  not_recovered:       "Not Recovered",
};

/** Map percentage cleanly to the configured statuses */
export function getStatusFromPct(pct) {
  if (pct >= 80) return "fully_recovered";
  if (pct >= 60) return "mostly_recovered";
  if (pct >= 40) return "partially_recovered";
  return "not_recovered";
}

/** Derive status strictly from hours elapsed dynamically mapping to smooth percentage logic */
export function statusFromHours(hours) {
  const pct = Math.min(Math.round((hours / 24) * 100), 100);
  return getStatusFromPct(pct);
}

/** Percentage (0-100) to fill the bar, based purely on hours (caps at 100 after 24h). */
export function recoveryPct(hours) {
  return Math.min(Math.round((hours / 24) * 100), 100);
}

/** Parses database naive UTC dates back to local epoch time */
export function parseLocalISO(dateStr) {
  if (!dateStr) return 0;
  let t = new Date(dateStr).getTime();
  // Reverse the naive timestamp shift: Node `pg` interprets UTC naive strings as local time, 
  // mistakenly dragging the absolute epoch into the future. Removing the offset cancels it out.
  if (typeof dateStr === "string" && dateStr.endsWith("Z")) {
    const tzOffset = typeof window !== "undefined" ? new Date().getTimezoneOffset() * 60000 : 0;
    t -= tzOffset;
  }
  return t;
}



/** Read the last workout timestamp from localStorage (safe for SSR). */
export function getLastWorkoutTime() {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem("lastWorkoutTime");
  return raw ? new Date(raw) : null;
}

/** Persist the last workout completion time. */
export function setLastWorkoutTime(date = new Date()) {
  const storage = getStorage();
  if (storage) {
    storage.setItem("lastWorkoutTime", date.toISOString());
  }
}

/** Read all manual override soreness levels { muscleName: "fresh"|"moderate"|"sore" }. */
export function getMuscleSoreness() {
  const storage = getStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem("muscleSoreness") || "{}");
  } catch {
    return {};
  }
}

/** Persist a single muscle's manual soreness override. Pass null to clear it. */
export function setMuscleSoreness(muscle, level) {
  const current = getMuscleSoreness();
  if (level === null) {
    delete current[muscle];
  } else {
    current[muscle] = level;
  }
  const storage = getStorage();
  if (storage) {
    storage.setItem("muscleSoreness", JSON.stringify(current));
  }
}

/**
 * Compute the effective recovery entry for every muscle.
 * Priority: manual override > time-based.
 *
 * Returns: { [muscle]: { status, pct, isManual, hours } }
 */
export function computeRecovery(muscles, lastWorkoutTime, manualOverrides) {
  const now = Date.now();
  const hours = lastWorkoutTime
    ? (now - lastWorkoutTime.getTime()) / 3_600_000
    : 0;

  const result = {};
  muscles.forEach((muscle) => {
    const manual = manualOverrides[muscle] ?? null;
    const timeStatus = statusFromHours(hours);
    const status = manual ?? timeStatus;

    // Default time-based pct
    let pct = recoveryPct(hours);
    
    // If there's a manual override, enforce a baseline pct so it displays reasonably in the UI
    if (manual) {
      if (manual === "fully_recovered") pct = 100;
      else if (manual === "mostly_recovered") pct = 70;
      else if (manual === "partially_recovered") pct = 50;
      else if (manual === "not_recovered") pct = 20;
    }

    result[muscle] = {
      status,
      pct,
      isManual: !!manual,
      hours,
    };
  });
  return result;
}

/**
 * Compute recovery dynamically per-muscle by scanning raw `/workouts` history.
 * Aggressively scans chronologically discovering the explicit last entry per muscle mapped structurally.
 */
export function computeDynamicRecovery(muscles, workoutsData, manualOverrides) {
  const now = Date.now();
  const lastHit = {};

  workoutsData.forEach(w => {
    const wDate = parseLocalISO(w.created_at);
    w.sets?.forEach(s => {
      const nm = (s.muscle_group || "").toLowerCase();
      if (nm && (!lastHit[nm] || wDate > lastHit[nm])) {
        lastHit[nm] = wDate;
      }
    });
  });

  const INHERITANCE_MAP = {
    // MuscleMap ID => DB Parent mapped ID
    "upperchest": "chest",
    "lowerchest": "chest",
    "frontdeltoid": "shoulders",
    "reardeltoid": "shoulders",
    "deltoids": "shoulders",
    "innerquad": "quadriceps",
    "outerquad": "quadriceps",
    "uppertrapezius": "traps",
    "lowertrapezius": "traps",
    "trapezius": "traps",
    "upperabs": "abdominals",
    "lowerabs": "abdominals",
    "abs": "abdominals"
  };

  const result = {};
  muscles.forEach(muscle => {
    const mKey = muscle.toLowerCase();
    const manual = manualOverrides[muscle] ?? null;

    // Direct hit OR parent hit
    const parentKey = INHERITANCE_MAP[mKey];
    let muscleHitTime = lastHit[mKey];
    if (!muscleHitTime && parentKey && lastHit[parentKey]) {
      muscleHitTime = lastHit[parentKey];
    }

    const hours = muscleHitTime ? (now - muscleHitTime) / 3600000 : Infinity;
    const timeStatus = statusFromHours(hours);
    const status = manual ?? timeStatus;

    let pct = recoveryPct(hours);
    if (hours === Infinity) pct = 100;

    if (manual) {
      if (manual === "fully_recovered") pct = 100;
      else if (manual === "mostly_recovered") pct = 70;
      else if (manual === "partially_recovered") pct = 50;
      else if (manual === "not_recovered") pct = 20;
    }

    result[muscle] = {
      status,
      pct,
      isManual: !!manual,
      hours: hours === Infinity ? 0 : hours
    };
  });

  return result;
}

/**
 * Calculate readiness score based on sleep stages, HRV, RHR, and workout intervals.
 * 
 * Rules & Calculations:
 * 1. Total Sleep Time = Sum of deep, core, and rem minutes.
 * 2. Duration Score = Math.min(100, (Total Sleep Time / 480) * 100)
 * 3. Deep Component = Math.min(100, (deepMinutes / (Total Sleep Time * 0.15)) * 100)
 * 4. REM Component = Math.min(100, (remMinutes / (Total Sleep Time * 0.20)) * 100)
 * 5. Sleep Quality Score = (Duration Score * 0.5) + (((Deep Component + REM Component) / 2) * 0.5)
 * 
 * 6. HRV Score = Math.min(120, (todayHRV / avg14DayHRV) * 100)
 * 7. RHR Score = Math.min(120, (avg14DayRHR / todayRHR) * 100)
 * 
 * 8. Workout Interval Score Calculation:
 *    - If hoursSinceLastWorkout < 12: Score = 25
 *    - If hoursSinceLastWorkout >= 12 AND hoursSinceLastWorkout < 18: Score = 50
 *    - If hoursSinceLastWorkout >= 18 AND hoursSinceLastWorkout < 24: Score = 75
 *    - If hoursSinceLastWorkout >= 24: Score = 100
 * 
 * 9. Final Composite Readiness (Weighted 50% Sleep, 20% HRV, 15% RHR, 15% Workout Interval):
 *    Composite Readiness = Math.min(100, 
 *      (Sleep Quality Score * 0.50) + 
 *      (HRV Score * 0.20) + 
 *      (RHR Score * 0.15) + 
 *      (Workout Interval Score * 0.15)
 *    )
 * 
 * Deliverable: Output the final readiness percentage as an integer alongside the computed sub-scores for detailed analytical charts.
 */
export function calculateReadinessScore(data) {
  if (!data) return null;

  const {
    sleepStages = { deepMinutes: 0, coreMinutes: 0, remMinutes: 0, awakeMinutes: 0 },
    todayHRV = 0,
    avg14DayHRV = 1,
    todayRHR = 60,
    avg14DayRHR = 60,
    hoursSinceLastWorkout = 0
  } = data;

  const {
    deepMinutes = 0,
    coreMinutes = 0,
    remMinutes = 0
  } = sleepStages;

  // 1. Total Sleep Time = Sum of deep, core, and rem minutes.
  const totalSleepTime = deepMinutes + coreMinutes + remMinutes;

  // 2. Duration Score = Math.min(100, (Total Sleep Time / 480) * 100)
  const durationScore = Math.min(100, (totalSleepTime / 480) * 100);

  // 3. Deep Component = Math.min(100, (deepMinutes / (Total Sleep Time * 0.15)) * 100)
  const deepComponent = totalSleepTime > 0
    ? Math.min(100, (deepMinutes / (totalSleepTime * 0.15)) * 100)
    : 0;

  // 4. REM Component = Math.min(100, (remMinutes / (Total Sleep Time * 0.20)) * 100)
  const remComponent = totalSleepTime > 0
    ? Math.min(100, (remMinutes / (totalSleepTime * 0.20)) * 100)
    : 0;

  // 5. Sleep Quality Score = (Duration Score * 0.5) + (((Deep Component + REM Component) / 2) * 0.5)
  const sleepQualityScore = (durationScore * 0.5) + (((deepComponent + remComponent) / 2) * 0.5);

  // 6. HRV Score = Math.min(120, (todayHRV / avg14DayHRV) * 100)
  const hrvScore = avg14DayHRV > 0
    ? Math.min(120, (todayHRV / avg14DayHRV) * 100)
    : 0;

  // 7. RHR Score = Math.min(120, (avg14DayRHR / todayRHR) * 100)
  const rhrScore = todayRHR > 0
    ? Math.min(120, (avg14DayRHR / todayRHR) * 100)
    : 0;

  // 8. Workout Interval Score Calculation
  let workoutIntervalScore = 100;
  if (hoursSinceLastWorkout < 12) {
    workoutIntervalScore = 25;
  } else if (hoursSinceLastWorkout < 18) {
    workoutIntervalScore = 50;
  } else if (hoursSinceLastWorkout < 24) {
    workoutIntervalScore = 75;
  }

  // 9. Final Composite Readiness
  const compositeReadiness = Math.min(100, 
    (sleepQualityScore * 0.50) + 
    (hrvScore * 0.20) + 
    (rhrScore * 0.15) + 
    (workoutIntervalScore * 0.15)
  );

  return {
    compositeReadiness: Math.round(compositeReadiness),
    sleepQualityScore,
    durationScore,
    deepComponent,
    remComponent,
    hrvScore,
    rhrScore,
    workoutIntervalScore
  };
}
