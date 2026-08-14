import { calculateReadinessScore } from "./recovery.js";
import assert from "assert";

console.log("Running recovery readiness score tests...");

// Test Case 1: Baseline / Homeostasis case (z = 0)
const test1Data = {
  sleepStages: {
    deepMinutes: 90,
    coreMinutes: 300,
    remMinutes: 90,
    awakeMinutes: 30
  },
  todayHRV: 70,
  avg14DayHRV: 70, // log(70) - log(70) = 0 -> zHRV = 0
  todayRHR: 60,
  avg14DayRHR: 60, // (60 - 60)/3 = 0 -> zRHR = 0
  hoursSinceLastWorkout: 26
};

const result1 = calculateReadinessScore(test1Data);
console.log("Test Case 1 (Homeostasis) Result:", result1);

assert.strictEqual(result1.compositeReadiness, 90);
assert.strictEqual(result1.workoutIntervalScore, 100);
assert.ok(Math.abs(result1.sleepQualityScore - 98.4375) < 0.001);
assert.strictEqual(result1.hrvScore, 75);
assert.strictEqual(result1.rhrScore, 75);
assert.strictEqual(result1.zHRV, 0);
assert.strictEqual(result1.zRHR, 0);

// Test Case 2: Poor recovery / Severe suppression (todayHRV=40, todayRHR=80)
const test2Data = {
  sleepStages: {
    deepMinutes: 30,
    coreMinutes: 200,
    remMinutes: 40,
    awakeMinutes: 50
  },
  todayHRV: 40,
  avg14DayHRV: 80, // zHRV = (ln(40) - ln(80)) / 0.3 = -0.693147 / 0.3 = -2.31049
                   // hrvScore = 75 + 15 * -2.31049 = 75 - 34.657 = 40.34
  todayRHR: 80,
  avg14DayRHR: 60, // zRHR = (80 - 60) / 3 = 6.67
                   // rhrScore = max(0, 75 - 15 * 6.67) = 0
  hoursSinceLastWorkout: 8
};

const result2 = calculateReadinessScore(test2Data);
console.log("Test Case 2 (Suppression) Result:", result2);

// Sleep quality score: 65.162 (rounded)
// Workout Interval Score: 25
// HRV Score: 40.34
// RHR Score: 0
// Composite: 65.162 * 0.5 + 40.34 * 0.2 + 0 * 0.15 + 25 * 0.15 = 32.581 + 8.068 + 0 + 3.75 = 44.4 -> 44
assert.strictEqual(result2.compositeReadiness, 44);
assert.strictEqual(result2.workoutIntervalScore, 25);
assert.ok(Math.abs(result2.sleepQualityScore - 65.156) < 0.01);
assert.ok(Math.abs(result2.hrvScore - 40.34) < 0.1);
assert.strictEqual(result2.rhrScore, 0);

// Test Case 3: Parasympathetic Saturation Guard (high HRV, low RHR)
const test3Data = {
  sleepStages: { deepMinutes: 90, coreMinutes: 300, remMinutes: 90, awakeMinutes: 30 },
  todayHRV: 160,
  meanLnHRV: Math.log(70),
  stdDevLnHRV: 0.30, // ln(160) - ln(70) = 5.075 - 4.248 = 0.826 -> zHRV = 0.826 / 0.3 = 2.75 (> 2.5)
  todayRHR: 45,
  meanRHR: 60,
  stdDevRHR: 3.0, // (45 - 60) / 3 = -15 / 3 = -5.0 (< -1.5)
  hoursSinceLastWorkout: 26
};

const result3 = calculateReadinessScore(test3Data);
console.log("Test Case 3 (Vagal Saturation Guard) Result:", result3);
// Without guard, hrvScore would be 75 + 15 * 2.75 = 116.3 -> capped to 100
// With guard, hrvScore should be capped at 85
assert.strictEqual(result3.hrvScore, 85);
// RHR score: 75 - 15 * -5.0 = 150 -> capped to 100
assert.strictEqual(result3.rhrScore, 100);

// Test Case 4: Custom standard deviation
const test4Data = {
  sleepStages: { deepMinutes: 90, coreMinutes: 300, remMinutes: 90, awakeMinutes: 30 },
  todayHRV: 90,
  meanLnHRV: Math.log(70),
  stdDevLnHRV: 0.50, // ln(90/70) / 0.5 = 0.251 / 0.5 = 0.502
                     // hrvScore = 75 + 15 * 0.502 = 82.53
  todayRHR: 65,
  meanRHR: 60,
  stdDevRHR: 5.0,  // (65 - 60) / 5 = 1.0
                   // rhrScore = 75 - 15 * 1.0 = 60
  hoursSinceLastWorkout: 26
};

const result4 = calculateReadinessScore(test4Data);
console.log("Test Case 4 (Custom StdDev) Result:", result4);
assert.ok(Math.abs(result4.zHRV - 0.502) < 0.001);
assert.ok(Math.abs(result4.hrvScore - 82.53) < 0.1);
assert.strictEqual(result4.zRHR, 1.0);
assert.strictEqual(result4.rhrScore, 60);

// Test Case 5: Workout Interval Boundaries
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
