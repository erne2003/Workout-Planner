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
  fresh:    "#30D158",
  moderate: "#FF9F0A",
  sore:     "#FF2D55",
};

export const RECOVERY_LABEL = {
  fresh:    "Fresh",
  moderate: "Moderate",
  sore:     "Sore",
};

/** Derive status from hours elapsed since the last workout. */
export function statusFromHours(hours) {
  if (hours >= 24) return "fresh";
  if (hours >= 12) return "moderate";
  return "sore";
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
      if (manual === "fresh") pct = 100;
      else if (manual === "moderate") pct = 60;
      else if (manual === "sore") pct = 20;
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
