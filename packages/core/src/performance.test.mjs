import assert from "assert";
import { getRepRange, estimateOneRepMax, analyzeExercise, summarizeWorkout, toMuscleGroup } from "./performance.js";

const S = (pairs) => pairs.map(([weight, reps]) => ({ weight, reps }));

console.log("Running performance tests...");

// Rep ranges: 6–10 only for heavy barbell compounds
for (const name of ["Squat", "Barbell Back Squat", "Front Squat", "Deadlift", "Romanian Deadlift", "Bench Press", "Incline Bench Press", "Barbell Chest Press"]) {
  assert.deepStrictEqual([getRepRange(name).min, getRepRange(name).max], [6, 10], name);
}
for (const name of ["Chest Press", "Dumbbell Bench Press", "Goblet Squat", "Bulgarian Split Squat", "Hack Squat", "Leg Press", "Lateral Raise", "Bicep Curl", "Single-Leg Dumbbell Deadlift"]) {
  assert.deepStrictEqual([getRepRange(name).min, getRepRange(name).max], [8, 12], name);
}

// 1RM counts the rep in reserve
assert.strictEqual(estimateOneRepMax(45, 10), 45 * (1 + 11 / 30));

// The user's example: same weight, 2 fewer reps on every set → declined, drop weight
const chest = analyzeExercise({ name: "Chest Press", prev: S([[45, 10], [45, 9], [45, 8]]), cur: S([[45, 8], [45, 7], [45, 6]]), increment: 5 });
assert.strictEqual(chest.status, "declined");
assert.strictEqual(chest.changePct, -5);
assert.strictEqual(chest.recommendation.action, "drop_weight");
assert.strictEqual(chest.recommendation.weight, 40);
assert.deepStrictEqual(chest.recommendation.reps, [12, 11, 10]);
assert.deepStrictEqual(chest.sets.map((s) => s.repsDelta), [-2, -2, -2]);

// Same drop on a heavy compound targets the 6–10 range instead
const bench = analyzeExercise({ name: "Bench Press", prev: S([[185, 8], [185, 7], [185, 6]]), cur: S([[185, 6], [185, 5], [185, 4]]), increment: 5 });
assert.strictEqual(bench.status, "declined");
assert.strictEqual(bench.recommendation.action, "drop_weight");
assert.ok(bench.recommendation.weight < 185);
assert.ok(bench.recommendation.reps[0] >= 6 && bench.recommendation.reps[0] <= 10);

// Topped out the range → increase weight, fewer reps predicted
const press = analyzeExercise({ name: "Shoulder Press Machine", prev: S([[60, 11], [60, 10], [60, 10]]), cur: S([[60, 12], [60, 12], [60, 11]]), increment: 5 });
assert.strictEqual(press.status, "improved");
assert.strictEqual(press.recommendation.action, "increase_weight");
assert.strictEqual(press.recommendation.weight, 65);
assert.deepStrictEqual(press.recommendation.reps, [9, 9, 8]);

// Heavy compound tops out at 10, not 12
const squat = analyzeExercise({ name: "Squat", prev: S([[225, 9], [225, 9], [225, 8]]), cur: S([[225, 10], [225, 10], [225, 9]]), increment: 5 });
assert.strictEqual(squat.recommendation.action, "increase_weight");
assert.strictEqual(squat.recommendation.weight, 230);

// Odd weights (e.g. kg converted from lb) step up onto the plate increment
const kg = analyzeExercise({ name: "Cable Row", prev: S([[20.41, 11]]), cur: S([[20.41, 12]]), increment: 2.5 });
assert.strictEqual(kg.recommendation.weight, 22.5);

// Increment too large for the load → add a set instead
const raise = analyzeExercise({ name: "Lateral Raise", prev: S([[15, 12], [15, 12], [15, 11]]), cur: S([[15, 12], [15, 12], [15, 12]]), increment: 5 });
assert.strictEqual(raise.recommendation.action, "add_set");
assert.strictEqual(raise.recommendation.reps.length, 4);

// Small dip → hold and match last time; a second dip in a row → declined
const prevOhp = S([[65, 8], [65, 8], [65, 7]]);
const curOhp = S([[65, 8], [65, 7], [65, 6]]);
const ohp = analyzeExercise({ name: "Overhead Press", prev: prevOhp, cur: curOhp, increment: 5 });
assert.strictEqual(ohp.status, "dipped");
assert.strictEqual(ohp.recommendation.action, "hold");
assert.deepStrictEqual(ohp.recommendation.reps, [8, 8, 7]);
const ohpAgain = analyzeExercise({ name: "Overhead Press", prevPrev: S([[65, 9], [65, 8], [65, 8]]), prev: prevOhp, cur: curOhp, increment: 5 });
assert.strictEqual(ohpAgain.status, "declined");
assert.strictEqual(ohpAgain.recommendation.action, "drop_weight");

// Improved inside range → keep weight, add reps
const incline = analyzeExercise({ name: "Incline Dumbbell Press", prev: S([[30, 9], [30, 8], [30, 8]]), cur: S([[30, 10], [30, 9], [30, 8]]), increment: 5 });
assert.strictEqual(incline.status, "improved");
assert.strictEqual(incline.recommendation.action, "add_reps");
assert.deepStrictEqual(incline.recommendation.reps, [11, 10, 9]);

// Sets compared in order; extra and missing sets are flagged
const extra = analyzeExercise({ name: "Cable Fly", prev: S([[20, 12], [20, 12]]), cur: S([[25, 10], [25, 9], [25, 8]]), increment: 5 });
assert.deepStrictEqual(extra.sets.map((s) => s.kind), ["compare", "compare", "added"]);
assert.deepStrictEqual([extra.sets[0].weightDelta, extra.sets[0].repsDelta], [5, -2]);
const fewer = analyzeExercise({ name: "Cable Fly", prev: S([[20, 12], [20, 12], [20, 11]]), cur: S([[20, 12]]), increment: 5 });
assert.deepStrictEqual(fewer.sets.map((s) => s.kind), ["compare", "skipped", "skipped"]);

// No history → new
const fresh = analyzeExercise({ name: "Pec Deck", cur: S([[80, 10]]), increment: 5 });
assert.strictEqual(fresh.status, "new");

// Workout summary: totals only compare lifts with history
const summary = summarizeWorkout({
  increment: 5,
  exercises: [
    { id: 1, name: "Chest Press", muscleGroup: "chest", prev: S([[45, 10]]), cur: S([[60, 7]]) },
    { id: 2, name: "Pec Deck", muscleGroup: "chest", cur: S([[80, 10]]) },
    { id: 3, name: "Tricep Pushdown", muscleGroup: "triceps", prev: S([[50, 12]]), cur: [] },
  ],
});
assert.strictEqual(summary.exercises.length, 2);
assert.strictEqual(summary.totalVolume, 420 + 800);
assert.strictEqual(summary.comparableVolume, 420);
assert.strictEqual(summary.prevVolume, 450);
assert.strictEqual(summary.counts.new, 1);
assert.strictEqual(summary.heavierCount, 1);
assert.deepStrictEqual(summary.muscles.map((m) => m.name), ["Chest"]);
assert.strictEqual(toMuscleGroup("quadriceps"), "Legs");

console.log("All performance tests passed.");
