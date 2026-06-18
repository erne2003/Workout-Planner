import { calculateReadinessScore } from "./recovery.js";
import assert from "assert";

console.log("Running recovery readiness score tests...");

// Test Case 1: Ideal case
const test1Data = {
  sleepStages: {
    deepMinutes: 90,
    coreMinutes: 300,
    remMinutes: 90,
    awakeMinutes: 30
  },
  todayHRV: 70,
  avg14DayHRV: 70,
  todayRHR: 60,
  avg14DayRHR: 60,
  hoursSinceLastWorkout: 26
};

const result1 = calculateReadinessScore(test1Data);
console.log("Test Case 1 Result:", result1);

assert.strictEqual(result1.compositeReadiness, 99);
assert.strictEqual(result1.workoutIntervalScore, 100);
assert.ok(Math.abs(result1.sleepQualityScore - 98.4375) < 0.001);
assert.strictEqual(result1.hrvScore, 100);
assert.strictEqual(result1.rhrScore, 100);

// Test Case 2: Poor recovery / Sore / High activity
const test2Data = {
  sleepStages: {
    deepMinutes: 30,
    coreMinutes: 200,
    remMinutes: 40,
    awakeMinutes: 50
  },
  todayHRV: 40,
  avg14DayHRV: 80,
  todayRHR: 80,
  avg14DayRHR: 60,
  hoursSinceLastWorkout: 8
};

const result2 = calculateReadinessScore(test2Data);
console.log("Test Case 2 Result:", result2);

assert.strictEqual(result2.compositeReadiness, 58);
assert.strictEqual(result2.workoutIntervalScore, 25);
assert.ok(Math.abs(result2.sleepQualityScore - 65.162) < 0.01);
assert.strictEqual(result2.hrvScore, 50);
assert.strictEqual(result2.rhrScore, 75);

// Test Case 3: Workout Interval Boundaries
// hours = 12
assert.strictEqual(calculateReadinessScore({ ...test1Data, hoursSinceLastWorkout: 12 }).workoutIntervalScore, 50);
// hours = 17.9
assert.strictEqual(calculateReadinessScore({ ...test1Data, hoursSinceLastWorkout: 17.9 }).workoutIntervalScore, 50);
// hours = 18
assert.strictEqual(calculateReadinessScore({ ...test1Data, hoursSinceLastWorkout: 18 }).workoutIntervalScore, 75);
// hours = 23.9
assert.strictEqual(calculateReadinessScore({ ...test1Data, hoursSinceLastWorkout: 23.9 }).workoutIntervalScore, 75);
// hours = 24
assert.strictEqual(calculateReadinessScore({ ...test1Data, hoursSinceLastWorkout: 24 }).workoutIntervalScore, 100);

console.log("All recovery readiness score tests passed successfully!");
