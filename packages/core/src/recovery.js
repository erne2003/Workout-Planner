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

import { getStorage } from "./storage.js";

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

// ─── Per-muscle recovery time constants ────────────────────────────────────
// Larger muscles need more recovery time than smaller ones.
// Values are in hours to reach 100% recovery.
export const RECOVERY_WINDOW_HOURS = {
  quadriceps:  60,
  hamstrings:  60,
  glutes:      60,
  back:        48,
  chest:       48,
  shoulders:   48,
  traps:       36,
  calves:      36,
  biceps:      30,
  triceps:     30,
  forearms:    24,
  abdominals:  24,
};

// ─── Muscle mass / systemic-impact weights for aggregate readiness ─────────
// Weights sum to 1.0 across all tracked top-level muscle groups.
export const MUSCLE_WEIGHT = {
  quadriceps:  0.16,
  hamstrings:  0.12,
  glutes:      0.10,
  back:        0.14,
  chest:       0.10,
  shoulders:   0.08,
  traps:       0.04,
  calves:      0.06,
  biceps:      0.06,
  triceps:     0.06,
  forearms:    0.02,
  abdominals:  0.06,
};

// ─── Inheritance map: sub-muscle / muscle-path IDs → canonical DB group ────
// Hoisted here so both computeRecovery and computeDynamicRecovery can share it.
export const INHERITANCE_MAP = {
  // Anterior sub-muscles
  "upperchest":     "chest",
  "lowerchest":     "chest",
  "serratus":       "chest",
  "frontdeltoid":   "shoulders",
  "reardeltoid":    "shoulders",
  "reardeltoids":   "shoulders",
  "deltoids":       "shoulders",
  "innerquad":      "quadriceps",
  "outerquad":      "quadriceps",
  "hipflexors":     "quadriceps",
  "adductors":      "quadriceps",
  "uppertrapezius": "traps",
  "lowertrapezius": "traps",
  "trapezius":      "traps",
  "upperabs":       "abdominals",
  "lowerabs":       "abdominals",
  "abs":            "abdominals",
  "obliques":       "abdominals",
  // Posterior sub-muscles
  "upperback":      "back",
  "lowerback":      "back",
  "gluteal":        "glutes",
  "hamstring":      "hamstrings",
  "forearm":        "forearms",
};

/** Resolve a muscle key to its canonical top-level group via INHERITANCE_MAP. */
export function resolveCanonicalGroup(muscleKey) {
  const key = (muscleKey || "").toLowerCase();
  return INHERITANCE_MAP[key] || key;
}

/** Map percentage cleanly to the configured statuses */
export function getStatusFromPct(pct) {
  if (pct >= 80) return "fully_recovered";
  if (pct >= 60) return "mostly_recovered";
  if (pct >= 40) return "partially_recovered";
  return "not_recovered";
}

/**
 * Derive status from hours elapsed, using a per-muscle recovery window.
 * @param {number} hours - hours since last workout for this muscle
 * @param {number} [windowHours=24] - total hours for full recovery (from RECOVERY_WINDOW_HOURS)
 */
export function statusFromHours(hours, windowHours = 24) {
  const pct = Math.min(Math.round((hours / windowHours) * 100), 100);
  return getStatusFromPct(pct);
}

/**
 * Percentage (0-100) to fill the bar, using a per-muscle recovery window.
 * @param {number} hours - hours since last workout for this muscle
 * @param {number} [windowHours=24] - total hours for full recovery (from RECOVERY_WINDOW_HOURS)
 */
export function recoveryPct(hours, windowHours = 24) {
  return Math.min(Math.round((hours / windowHours) * 100), 100);
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
    const canonical = resolveCanonicalGroup(muscle);
    const windowHours = RECOVERY_WINDOW_HOURS[canonical] ?? 24;
    const timeStatus = statusFromHours(hours, windowHours);
    const status = manual ?? timeStatus;

    // Default time-based pct
    let pct = recoveryPct(hours, windowHours);
    
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
 * Uses per-muscle recovery windows from RECOVERY_WINDOW_HOURS based on muscle size.
 * Sub-muscles inherit their parent's recovery window via INHERITANCE_MAP.
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

  const result = {};
  muscles.forEach(muscle => {
    const mKey = muscle.toLowerCase();
    const manual = manualOverrides[muscle] ?? null;

    // Resolve to canonical group for both time lookup and recovery window
    const canonical = resolveCanonicalGroup(mKey);
    const windowHours = RECOVERY_WINDOW_HOURS[canonical] ?? 24;

    // Direct hit OR parent hit
    let muscleHitTime = lastHit[mKey];
    if (!muscleHitTime && canonical !== mKey && lastHit[canonical]) {
      muscleHitTime = lastHit[canonical];
    }

    const hours = muscleHitTime ? (now - muscleHitTime) / 3600000 : Infinity;
    const timeStatus = statusFromHours(hours, windowHours);
    const status = manual ?? timeStatus;

    let pct = recoveryPct(hours, windowHours);
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
 * Compute a weighted composite muscle readiness score.
 *
 * Only muscles trained within `activeWindowDays` count toward the composite.
 * Untrained muscles are excluded (they must NOT inflate the score at 100%).
 * Weights are renormalized over just the active subset.
 *
 * @param {Object} muscleRecoveryData - Output of computeDynamicRecovery:
 *   { [muscle]: { pct, hours, status, isManual } }
 * @param {number} [activeWindowDays=7] - Only muscles trained within this many days are included
 * @returns {{ score: number, activeCount: number, status: string }}
 */
export function computeMuscleReadiness(muscleRecoveryData, activeWindowDays = 7) {
  const activeWindowHours = activeWindowDays * 24;
  let totalWeight = 0;
  let weightedSum = 0;
  let activeCount = 0;

  for (const [muscle, data] of Object.entries(muscleRecoveryData)) {
    // hours === 0 means never trained (was Infinity, set to 0 in computeDynamicRecovery)
    // Skip muscles that have never been trained or are outside the active window
    if (data.hours === 0 && !data.isManual) continue;
    if (data.hours > activeWindowHours && !data.isManual) continue;

    const canonical = resolveCanonicalGroup(muscle);
    const weight = MUSCLE_WEIGHT[canonical] ?? 0;
    if (weight === 0) continue;

    totalWeight += weight;
    weightedSum += data.pct * weight;
    activeCount++;
  }

  if (totalWeight === 0 || activeCount === 0) {
    return { score: 100, activeCount: 0, status: "fully_recovered" };
  }

  const score = Math.round(weightedSum / totalWeight);
  return {
    score,
    activeCount,
    status: getStatusFromPct(score),
  };
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
    sleepStages = null,
    todayHRV = null,
    avg14DayHRV = null,
    meanLnHRV = null,
    stdDevLnHRV = null,
    todayRHR = null,
    avg14DayRHR = null,
    meanRHR = null,
    stdDevRHR = null,
    hoursSinceLastWorkout = 0,
    muscleReadinessScore = null
  } = data;

  let totalWeight = 0;
  let weightedSum = 0;

  // 1. Workout Interval Score Calculation (replaced by muscle readiness if provided)
  let workoutIntervalScore = 100;
  if (muscleReadinessScore !== null && muscleReadinessScore !== undefined) {
    workoutIntervalScore = muscleReadinessScore;
  } else {
    if (hoursSinceLastWorkout < 12) {
      workoutIntervalScore = 25;
    } else if (hoursSinceLastWorkout < 18) {
      workoutIntervalScore = 50;
    } else if (hoursSinceLastWorkout < 24) {
      workoutIntervalScore = 75;
    }
  }
  weightedSum += workoutIntervalScore * 0.15;
  totalWeight += 0.15;

  // 2. Sleep Quality Score (if sleepStages is present)
  let sleepQualityScore = null;
  let durationScore = null;
  let deepComponent = null;
  let remComponent = null;
  if (sleepStages !== null && sleepStages !== undefined) {
    const {
      deepMinutes = 0,
      coreMinutes = 0,
      remMinutes = 0
    } = sleepStages;
    const totalSleepTime = deepMinutes + coreMinutes + remMinutes;
    durationScore = Math.min(100, (totalSleepTime / 480) * 100);
    deepComponent = totalSleepTime > 0
      ? Math.min(100, (deepMinutes / (totalSleepTime * 0.15)) * 100)
      : 0;
    remComponent = totalSleepTime > 0
      ? Math.min(100, (remMinutes / (totalSleepTime * 0.20)) * 100)
      : 0;
    sleepQualityScore = (durationScore * 0.5) + (((deepComponent + remComponent) / 2) * 0.5);

    weightedSum += sleepQualityScore * 0.50;
    totalWeight += 0.50;
  }

  // 3. HRV Score using sports science z-score (if todayHRV is present)
  let hrvScore = null;
  let zHRV = null;
  if (todayHRV !== null && todayHRV !== undefined) {
    const rmssdToday = todayHRV > 0 ? todayHRV : 1;
    const lnRMSSD = Math.log(rmssdToday);
    const mu_LnHRV = (meanLnHRV !== null && meanLnHRV !== undefined)
      ? meanLnHRV
      : ((avg14DayHRV && avg14DayHRV > 0) ? Math.log(avg14DayHRV) : Math.log(50));
    const sigma_LnHRV = (stdDevLnHRV && stdDevLnHRV !== 0) ? stdDevLnHRV : 0.30;
    
    zHRV = (lnRMSSD - mu_LnHRV) / sigma_LnHRV;
    hrvScore = 75 + 15 * zHRV;
  }

  // 4. RHR Score using inverted z-score (if todayRHR is present)
  let rhrScore = null;
  let zRHR = null;
  if (todayRHR !== null && todayRHR !== undefined) {
    const mu_RHR = (meanRHR !== null && meanRHR !== undefined)
      ? meanRHR
      : (avg14DayRHR || 60);
    const sigma_RHR = (stdDevRHR && stdDevRHR !== 0) ? stdDevRHR : 3.0;

    zRHR = (todayRHR - mu_RHR) / sigma_RHR;
    rhrScore = Math.min(100, Math.max(0, 75 - 15 * zRHR));
  }

  // Parasympathetic Saturation Guard: If zHRV > +2.5 and zRHR < -1.5, cap S_HRV = 85
  if (hrvScore !== null) {
    if (zHRV > 2.5 && zRHR !== null && zRHR < -1.5) {
      hrvScore = 85;
    } else {
      hrvScore = Math.min(100, Math.max(0, hrvScore));
    }
    weightedSum += hrvScore * 0.20;
    totalWeight += 0.20;
  }

  if (rhrScore !== null) {
    weightedSum += rhrScore * 0.15;
    totalWeight += 0.15;
  }

  const compositeReadiness = totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 100;

  return {
    compositeReadiness: Math.round(compositeReadiness),
    sleepQualityScore,
    durationScore,
    deepComponent,
    remComponent,
    hrvScore,
    rhrScore,
    workoutIntervalScore,
    zHRV,
    zRHR
  };
}
