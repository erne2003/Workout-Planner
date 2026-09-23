// Workout-to-workout performance analysis and next-session recommendations.
// Every logged set is assumed to stop 1 rep short of failure (RIR 1), whatever RIR was logged.

export const ASSUMED_RIR = 1;
const HELD_BAND_PCT = 1;
const DECLINE_PCT = 5;

const HEAVY_COMPOUND = /deadlift|squat|bench press|barbell (chest|bench) press/;
const NOT_HEAVY = /dumbbell|\bdb\b|kettlebell|machine|cable|smith|band|single[- ]leg|one[- ]leg|goblet|split|bulgarian|jump|sissy|pistol|wall|\bair\b|bodyweight|hack/;

// 6–10 only for heavy barbell compounds (squats, deadlifts, barbell chest/bench press); everything else 8–12.
export function getRepRange(exerciseName) {
  const n = String(exerciseName || "").toLowerCase();
  if (HEAVY_COMPOUND.test(n) && !NOT_HEAVY.test(n)) return { min: 6, max: 10, heavyCompound: true };
  return { min: 8, max: 12, heavyCompound: false };
}

export function estimateOneRepMax(weight, reps) {
  return weight * (1 + (reps + ASSUMED_RIR) / 30);
}

export function predictReps(oneRepMax, weight) {
  if (!(weight > 0)) return 0;
  return Math.round(30 * (oneRepMax / weight - 1) - ASSUMED_RIR);
}

const MUSCLE_GROUPS = {
  chest: "Chest",
  lats: "Back", back: "Back", traps: "Back",
  quadriceps: "Legs", hamstrings: "Legs", glutes: "Legs", calves: "Legs", legs: "Legs", adductors: "Legs", abductors: "Legs",
  shoulders: "Shoulders", delts: "Shoulders",
  biceps: "Arms", triceps: "Arms", forearms: "Arms", arms: "Arms",
  core: "Core", abs: "Core", abdominals: "Core", obliques: "Core",
};

export function toMuscleGroup(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "Other";
  return MUSCLE_GROUPS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function pctChange(now, before) {
  if (!before) return 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}

const sum = (xs) => xs.reduce((t, x) => t + x, 0);
const mean = (xs) => (xs.length ? sum(xs) / xs.length : 0);
const volumeOf = (sets) => sum(sets.map((s) => s.weight * s.reps));
const isWeighted = (sets) => sets.some((s) => s.weight > 0);

function sessionStrength(sets, count) {
  const matched = sets.slice(0, count);
  return isWeighted(matched)
    ? mean(matched.map((s) => estimateOneRepMax(s.weight, s.reps)))
    : sum(matched.map((s) => s.reps));
}

function classify(changePct, dippedLastTime) {
  if (changePct >= HELD_BAND_PCT) return "improved";
  if (changePct > -HELD_BAND_PCT) return "held";
  if (changePct > -DECLINE_PCT && !dippedLastTime) return "dipped";
  return "declined";
}

function compareSessions(prev, cur) {
  const n = Math.min(prev.length, cur.length);
  if (!n) return null;
  const before = sessionStrength(prev, n);
  const now = sessionStrength(cur, n);
  return { before, now, changePct: pctChange(now, before) };
}

function compareSets(prev, cur) {
  const rows = [];
  for (let i = 0; i < Math.max(prev.length, cur.length); i++) {
    const a = prev[i];
    const b = cur[i];
    if (a && b) {
      rows.push({
        kind: "compare", index: i, prev: a, cur: b,
        weightDelta: b.weight - a.weight,
        repsDelta: b.reps - a.reps,
        strengthDelta: estimateOneRepMax(b.weight, b.reps) - estimateOneRepMax(a.weight, a.reps),
        prevOneRepMax: estimateOneRepMax(a.weight, a.reps),
        curOneRepMax: estimateOneRepMax(b.weight, b.reps),
      });
    } else if (b) {
      rows.push({ kind: "added", index: i, prev: null, cur: b });
    } else {
      rows.push({ kind: "skipped", index: i, prev: a, cur: null });
    }
  }
  return rows;
}

function floorTo(x, step) {
  return Math.floor(x / step + 1e-9) * step;
}

function roundWeight(x) {
  return Math.round(x * 100) / 100;
}

function recommend({ cur, prev, status, changePct, range, increment }) {
  const { min, max } = range;
  const reps = cur.map((s) => s.reps);
  const first = reps[0];
  const offsets = reps.map((r) => r - first);
  const weight = cur[0].weight;
  const belowRange = reps.filter((r) => r < min).length;
  const drop = Math.abs(changePct).toFixed(1);

  if (!(weight > 0)) {
    if (first >= max) {
      return { action: "progress_variation", weight, reps, reason: `You reached ${max} reps. Add load or move to a harder variation.` };
    }
    return { action: "add_reps", weight, reps: reps.map((r) => r + 1), reason: "Add one rep per set next time." };
  }

  const oneRepMax = estimateOneRepMax(weight, first);

  if (status === "declined" || first < min) {
    const ideal = oneRepMax / (1 + ((min + max) / 2 + ASSUMED_RIR) / 30);
    let target = floorTo(ideal, increment);
    if (target >= weight) target = weight - increment;
    if (target <= 0) {
      return { action: "hold", weight, reps: prev.length ? prev.map((s) => s.reps) : reps, reason: "Keep this weight and aim to match your previous session." };
    }
    target = roundWeight(target);
    const p = Math.max(min, Math.min(max, predictReps(oneRepMax, target)));
    const why = status === "declined"
      ? `Strength is down ${drop}%${belowRange ? `, and ${belowRange} of ${reps.length} sets fell below your ${min}–${max} range` : ""}.`
      : `Set 1 landed below your ${min}–${max} range.`;
    return {
      action: "drop_weight",
      weight: target,
      reps: offsets.map((o) => Math.max(min, p + o)),
      reason: `${why} At ${target} every set lands back in range, which rebuilds volume before you climb again.`,
    };
  }

  if (first >= max && mean(reps) >= max - 1) {
    const snapped = floorTo(weight + increment, increment);
    const up = roundWeight(snapped > weight ? snapped : weight + increment);
    const p = predictReps(oneRepMax, up);
    if (p >= min) {
      return {
        action: "increase_weight",
        weight: up,
        reps: offsets.map((o) => Math.max(1, p + o)),
        reason: `You topped out your ${min}–${max} range. At ${up} expect about ${p} reps on set 1. Fewer reps at a heavier weight is progress.`,
      };
    }
    return {
      action: "add_set",
      weight,
      reps: [...reps, reps[reps.length - 1]],
      reason: `You topped out the range, but the next step (${up}) would cut set 1 to about ${Math.max(p, 1)} reps. Add a set at ${weight}, or take reps to ${max + 3} before moving up.`,
    };
  }

  if (status === "dipped") {
    return {
      action: "hold",
      weight,
      reps: prev.map((s) => s.reps),
      reason: `Down ${drop}%, within a normal off day. Keep ${weight} and aim to match last session. A second dip in a row will call for a lighter weight.`,
    };
  }

  return {
    action: "add_reps",
    weight,
    reps: reps.map((r) => Math.min(max, r + 1)),
    reason: status === "improved"
      ? `Up ${changePct.toFixed(1)}% and still inside your ${min}–${max} range. Add a rep per set; add weight once set 1 reaches ${max}.`
      : `Inside your ${min}–${max} range. Add a rep per set; add weight once set 1 reaches ${max}.`,
  };
}

/**
 * @param {{ name: string, cur: {weight:number,reps:number}[], prev?: {weight:number,reps:number}[],
 *           prevPrev?: {weight:number,reps:number}[], increment: number }} input
 *   Sets in the same unit and in the order they were performed.
 */
export function analyzeExercise({ name, cur, prev = [], prevPrev = [], increment }) {
  const range = getRepRange(name);
  const comparison = compareSessions(prev, cur);
  const earlier = compareSessions(prevPrev, prev);
  const dippedLastTime = !!earlier && earlier.changePct <= -HELD_BAND_PCT;
  const status = comparison ? classify(comparison.changePct, dippedLastTime) : "new";
  const changePct = comparison ? comparison.changePct : 0;

  const bestOf = (sets) => sets.reduce((m, s) => Math.max(m, estimateOneRepMax(s.weight, s.reps)), 0);
  const topSet = (sets) => sets.reduce((t, s) => (!t || s.weight > t.weight || (s.weight === t.weight && s.reps > t.reps) ? s : t), null);

  return {
    name,
    range,
    status,
    changePct,
    strengthBefore: comparison ? comparison.before : null,
    strengthNow: comparison ? comparison.now : null,
    weighted: isWeighted(cur),
    sets: compareSets(prev, cur),
    volume: volumeOf(cur),
    prevVolume: volumeOf(prev),
    totalReps: sum(cur.map((s) => s.reps)),
    prevTotalReps: sum(prev.map((s) => s.reps)),
    bestOneRepMax: bestOf(cur),
    prevBestOneRepMax: bestOf(prev),
    topSet: topSet(cur),
    prevTopSet: topSet(prev),
    recommendation: recommend({ cur, prev, status: status === "new" ? "held" : status, changePct, range, increment }),
  };
}

/**
 * @param {{ exercises: { id: any, name: string, muscleGroup: string, cur: any[], prev?: any[], prevPrev?: any[] }[],
 *           increment: number }} input
 */
export function summarizeWorkout({ exercises, increment }) {
  const analyzed = exercises
    .filter((ex) => ex.cur.length > 0)
    .map((ex) => ({ id: ex.id, muscleGroup: toMuscleGroup(ex.muscleGroup), ...analyzeExercise({ ...ex, increment }) }));

  const compared = analyzed.filter((a) => a.status !== "new");
  const counts = { improved: 0, held: 0, dipped: 0, declined: 0, new: 0 };
  analyzed.forEach((a) => { counts[a.status]++; });

  const muscles = [];
  analyzed.forEach((a) => {
    let m = muscles.find((x) => x.name === a.muscleGroup);
    if (!m) { m = { name: a.muscleGroup, volume: 0, prevVolume: 0, hasHistory: false }; muscles.push(m); }
    m.volume += a.volume;
    if (a.status !== "new") { m.prevVolume += a.prevVolume; m.hasHistory = true; }
  });

  const comparableVolume = sum(compared.map((a) => a.volume));
  const prevVolume = sum(compared.map((a) => a.prevVolume));

  return {
    exercises: analyzed,
    counts,
    muscles,
    totalVolume: sum(analyzed.map((a) => a.volume)),
    comparableVolume,
    prevVolume,
    volumeChangePct: pctChange(comparableVolume, prevVolume),
    comparedCount: compared.length,
    sets: sum(analyzed.map((a) => a.sets.filter((s) => s.cur).length)),
    prevSets: sum(compared.map((a) => a.sets.filter((s) => s.prev).length)),
    heavierCount: compared.filter((a) => a.topSet && a.prevTopSet && a.topSet.weight > a.prevTopSet.weight).length,
  };
}
