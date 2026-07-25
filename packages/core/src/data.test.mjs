import { getLoggedExercises, getExerciseProgressPoints } from "./data.js";
import assert from "assert";

console.log("Running data progress helper tests...");

const mockWorkouts = [
  {
    id: 1,
    created_at: "2026-01-01T10:00:00.000Z",
    sets: [
      { exercise_name: "Bench Press", weight: 135, reps: 10 },
      { exercise_name: "Bench Press", weight: 185, reps: 5 },
      { exercise_name: "Squat", weight: 225, reps: 5 },
    ],
  },
  {
    id: 2,
    created_at: "2026-01-08T10:00:00.000Z",
    sets: [
      { exercise_name: "Bench Press", weight: 195, reps: 5 },
      { exercise_name: "Deadlift", weight: 315, reps: 3 },
    ],
  },
];

// Test 1: getLoggedExercises
const logged = getLoggedExercises(mockWorkouts);
console.log("Logged exercises:", logged);
assert.strictEqual(logged.length, 3);
assert.deepStrictEqual(logged.map((e) => e.name), ["Bench Press", "Deadlift", "Squat"]);

// Test 2: getExerciseProgressPoints for Bench Press
const benchPoints = getExerciseProgressPoints(mockWorkouts, "Bench Press", "ALL");
console.log("Bench points:", benchPoints);
assert.strictEqual(benchPoints.length, 2);
assert.strictEqual(benchPoints[0].topSetWeight, 185);
assert.strictEqual(benchPoints[0].topSetReps, 5);
assert.strictEqual(benchPoints[0].sessionVolume, 135 * 10 + 185 * 5); // 2275
assert.strictEqual(benchPoints[1].topSetWeight, 195);
assert.strictEqual(benchPoints[1].topSetReps, 5);

console.log("All data progress helper tests passed successfully!");
