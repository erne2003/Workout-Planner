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

/** Read the last workout timestamp from localStorage (safe for SSR). */
export function getLastWorkoutTime() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("lastWorkoutTime");
  return raw ? new Date(raw) : null;
}

/** Persist the last workout completion time. */
export function setLastWorkoutTime(date = new Date()) {
  localStorage.setItem("lastWorkoutTime", date.toISOString());
}

/** Read all manual override soreness levels { muscleName: "fresh"|"moderate"|"sore" }. */
export function getMuscleSoreness() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("muscleSoreness") || "{}");
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
  localStorage.setItem("muscleSoreness", JSON.stringify(current));
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
    const wDate = new Date(w.created_at).getTime();
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
    const manual = manualOverrides[mKey] ?? null;

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
