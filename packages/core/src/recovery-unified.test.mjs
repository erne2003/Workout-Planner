import {
  MUSCLE_GROUPS,
  normalizeSorenessOverrides,
  getMuscleSoreness,
  setMuscleSoreness,
  computeDynamicRecovery,
  computeMuscleReadiness,
  computeOverallReadiness,
} from "./recovery.js";
import { registerStorage } from "./storage.js";
import { ANTERIOR_PATHS, POSTERIOR_PATHS } from "./muscle-paths.js";
import assert from "assert";

console.log("Running unified readiness tests...\n");

// Same list the Recovery tab body map uses.
const PATH_IDS = [...new Set([...ANTERIOR_PATHS, ...POSTERIOR_PATHS].map((p) => p.id))];

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();
const workout = (h, ...groups) => ({
  created_at: hoursAgo(h),
  sets: groups.map((g) => ({ muscle_group: g })),
});

// ─── Test 1: sub-muscles collapse to one weighted entry per group ─────────
{
  const data = {
    chest:      { pct: 50,  hours: 24, status: "partially_recovered", isManual: false },
    upperChest: { pct: 50,  hours: 24, status: "partially_recovered", isManual: false },
    lowerChest: { pct: 50,  hours: 24, status: "partially_recovered", isManual: false },
    back:       { pct: 100, hours: 50, status: "fully_recovered", isManual: false },
  };
  const result = computeMuscleReadiness(data, 7);
  // chest counted once: (50*0.10 + 100*0.14) / 0.24 = 79.17 → 79
  assert.strictEqual(result.score, 79);
  assert.strictEqual(result.activeCount, 2);
  console.log("✅ Sub-muscles are weighted once per canonical group");
}

// ─── Test 2: a group is as recovered as its least recovered entry ─────────
{
  const data = {
    upperBack: { pct: 30, hours: 14, status: "not_recovered", isManual: false },
    lowerBack: { pct: 90, hours: 43, status: "fully_recovered", isManual: false },
  };
  assert.strictEqual(computeMuscleReadiness(data, 7).score, 30);
  console.log("✅ Group readiness uses its least recovered sub-muscle");
}

// ─── Test 3: legacy path-ID override keys normalize to canonical groups ───
{
  assert.deepStrictEqual(
    normalizeSorenessOverrides({ deltoids: "not_recovered", upperChest: "mostly_recovered" }),
    { shoulders: "not_recovered", chest: "mostly_recovered" }
  );
  // A key already naming the group wins regardless of order
  assert.deepStrictEqual(
    normalizeSorenessOverrides({ chest: "fully_recovered", upperChest: "not_recovered" }),
    { chest: "fully_recovered" }
  );
  assert.deepStrictEqual(
    normalizeSorenessOverrides({ upperChest: "not_recovered", chest: "fully_recovered" }),
    { chest: "fully_recovered" }
  );
  assert.deepStrictEqual(normalizeSorenessOverrides(null), {});
  console.log("✅ Override keys normalize to canonical groups");
}

// ─── Test 4: an override applies to every sub-muscle in its group ─────────
{
  const workouts = [workout(100, "Shoulders")];
  const data = computeDynamicRecovery(
    ["deltoids", "frontDeltoid", "rearDeltoids", "shoulders", "chest"],
    workouts,
    { shoulders: "not_recovered" }
  );
  for (const m of ["deltoids", "frontDeltoid", "rearDeltoids", "shoulders"]) {
    assert.strictEqual(data[m].pct, 20, `${m} should take the shoulders override`);
    assert.strictEqual(data[m].isManual, true);
  }
  assert.strictEqual(data.chest.isManual, false);
  // Legacy key set on a sub-muscle still reaches the canonical group
  const legacy = computeDynamicRecovery(["shoulders"], workouts, { deltoids: "not_recovered" });
  assert.strictEqual(legacy.shoulders.pct, 20);
  console.log("✅ Overrides apply across the whole muscle group");
}

// ─── Test 5: sets logged as "Abs" count toward abdominals ─────────────────
{
  const data = computeDynamicRecovery(["abdominals", "upperAbs", "obliques"], [workout(12, "Abs")], {});
  for (const m of ["abdominals", "upperAbs", "obliques"]) {
    assert.ok(Math.abs(data[m].hours - 12) < 0.01, `${m} should be hit 12h ago`);
    assert.strictEqual(data[m].pct, 50); // 12h of a 24h window
  }
  console.log("✅ Logged group names resolve to their canonical group");
}

// ─── Test 6: body-map IDs and canonical groups yield the same score ───────
{
  const workouts = [
    workout(10, "Chest", "Triceps", "Shoulders"),
    workout(30, "Back", "Biceps", "Abs"),
    workout(50, "Quadriceps", "Hamstrings", "Glutes", "Calves"),
  ];
  const overrides = { deltoids: "partially_recovered" }; // legacy sub-muscle key
  const byPath = computeMuscleReadiness(computeDynamicRecovery(PATH_IDS, workouts, overrides));
  const byGroup = computeMuscleReadiness(computeDynamicRecovery(MUSCLE_GROUPS, workouts, overrides));
  assert.strictEqual(byPath.score, byGroup.score);
  assert.strictEqual(byPath.activeCount, byGroup.activeCount);
  console.log(`✅ Recovery body map and Home agree on muscle readiness (${byGroup.score})`);
}

// ─── Test 7: overrides change the readiness score ─────────────────────────
{
  const workouts = [workout(48, "Chest"), workout(60, "Quadriceps")];
  const before = computeOverallReadiness({ workouts }).score;
  const after = computeOverallReadiness({ workouts, overrides: { upperChest: "not_recovered" } }).score;
  assert.strictEqual(before, 100);
  // chest 20 (0.10) + quads 100 (0.16) → (2 + 16) / 0.26 = 69.2 → 69
  assert.strictEqual(after, 69);
  console.log("✅ A sub-muscle override moves the overall readiness score");
}

// ─── Test 8: setMuscleSoreness stores by group and migrates legacy keys ───
{
  const mem = {};
  registerStorage({
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = v; },
    removeItem: (k) => { delete mem[k]; },
  });
  mem.muscleSoreness = JSON.stringify({ deltoids: "not_recovered", frontDeltoid: "mostly_recovered" });
  assert.deepStrictEqual(Object.keys(getMuscleSoreness()), ["shoulders"]);

  setMuscleSoreness("upperChest", "partially_recovered");
  assert.deepStrictEqual(JSON.parse(mem.muscleSoreness).chest, "partially_recovered");
  assert.strictEqual(JSON.parse(mem.muscleSoreness).upperChest, undefined);

  // Clearing the group removes every legacy sub-muscle key with it
  setMuscleSoreness("shoulders", null);
  assert.deepStrictEqual(JSON.parse(mem.muscleSoreness), { chest: "partially_recovered" });
  console.log("✅ Overrides persist per group and clearing removes legacy keys");
}

// ─── Test 9: composite is used only with HealthKit permission + data ──────
{
  const workouts = [workout(12, "Chest")]; // chest 25%
  const healthData = { sleepStages: { deepMinutes: 90, coreMinutes: 300, remMinutes: 90 }, todayHRV: null, todayRHR: null };

  const muscleOnly = computeOverallReadiness({ workouts });
  assert.strictEqual(muscleOnly.score, 25);
  assert.strictEqual(muscleOnly.muscleScore, 25);

  const noPermission = computeOverallReadiness({ workouts, healthData, hasHealthPermission: false });
  assert.strictEqual(noPermission.score, 25);

  const composite = computeOverallReadiness({ workouts, healthData, hasHealthPermission: true });
  assert.strictEqual(composite.hasHealthData, true);
  assert.strictEqual(composite.score, composite.scoreData.compositeReadiness);
  assert.strictEqual(composite.scoreData.workoutIntervalScore, 25);
  assert.notStrictEqual(composite.score, 25);
  console.log(`✅ Composite (${composite.score}) replaces muscle-only score only with HealthKit data`);
}

console.log("\n🎉 All unified readiness tests passed!");
