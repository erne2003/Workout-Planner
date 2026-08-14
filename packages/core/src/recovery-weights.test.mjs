import * as recoveryModule from "./recovery.js";
const {
  RECOVERY_WINDOW_HOURS,
  MUSCLE_WEIGHT,
  INHERITANCE_MAP,
  resolveCanonicalGroup,
  recoveryPct,
  statusFromHours,
  getStatusFromPct,
  computeMuscleReadiness,
} = recoveryModule;
import assert from "assert";

console.log("Running recovery weighting tests...\n");

// ─── Test 1: MUSCLE_WEIGHT values sum to 1.0 ─────────────────────────────
{
  const sum = Object.values(MUSCLE_WEIGHT).reduce((a, b) => a + b, 0);
  const roundedSum = Math.round(sum * 100) / 100;
  assert.strictEqual(roundedSum, 1.0, `MUSCLE_WEIGHT sum should be 1.0, got ${roundedSum}`);
  console.log("✅ MUSCLE_WEIGHT values sum to 1.0");
}

// ─── Test 2: RECOVERY_WINDOW_HOURS returns correct window per muscle ──────
{
  assert.strictEqual(RECOVERY_WINDOW_HOURS["quadriceps"], 60);
  assert.strictEqual(RECOVERY_WINDOW_HOURS["chest"], 48);
  assert.strictEqual(RECOVERY_WINDOW_HOURS["biceps"], 30);
  assert.strictEqual(RECOVERY_WINDOW_HOURS["forearms"], 24);
  assert.strictEqual(RECOVERY_WINDOW_HOURS["abdominals"], 24);
  // Unmapped muscle falls back to undefined (callers use ?? 24)
  assert.strictEqual(RECOVERY_WINDOW_HOURS["neck"], undefined);
  console.log("✅ RECOVERY_WINDOW_HOURS returns correct windows per muscle");
}

// ─── Test 3: resolveCanonicalGroup + INHERITANCE_MAP ──────────────────────
{
  // Anterior sub-muscles
  assert.strictEqual(resolveCanonicalGroup("upperChest"), "chest");
  assert.strictEqual(resolveCanonicalGroup("lowerChest"), "chest");
  assert.strictEqual(resolveCanonicalGroup("serratus"), "chest");
  assert.strictEqual(resolveCanonicalGroup("frontDeltoid"), "shoulders");
  assert.strictEqual(resolveCanonicalGroup("rearDeltoid"), "shoulders");
  assert.strictEqual(resolveCanonicalGroup("rearDeltoids"), "shoulders");
  assert.strictEqual(resolveCanonicalGroup("deltoids"), "shoulders");
  assert.strictEqual(resolveCanonicalGroup("innerQuad"), "quadriceps");
  assert.strictEqual(resolveCanonicalGroup("outerQuad"), "quadriceps");
  assert.strictEqual(resolveCanonicalGroup("hipFlexors"), "quadriceps");
  assert.strictEqual(resolveCanonicalGroup("adductors"), "quadriceps");
  assert.strictEqual(resolveCanonicalGroup("upperAbs"), "abdominals");
  assert.strictEqual(resolveCanonicalGroup("lowerAbs"), "abdominals");
  assert.strictEqual(resolveCanonicalGroup("abs"), "abdominals");
  assert.strictEqual(resolveCanonicalGroup("obliques"), "abdominals");
  assert.strictEqual(resolveCanonicalGroup("trapezius"), "traps");
  // Posterior sub-muscles
  assert.strictEqual(resolveCanonicalGroup("upperBack"), "back");
  assert.strictEqual(resolveCanonicalGroup("lowerBack"), "back");
  assert.strictEqual(resolveCanonicalGroup("gluteal"), "glutes");
  assert.strictEqual(resolveCanonicalGroup("hamstring"), "hamstrings");
  assert.strictEqual(resolveCanonicalGroup("forearm"), "forearms");
  // Top-level muscles resolve to themselves
  assert.strictEqual(resolveCanonicalGroup("chest"), "chest");
  assert.strictEqual(resolveCanonicalGroup("back"), "back");
  assert.strictEqual(resolveCanonicalGroup("quadriceps"), "quadriceps");
  // Unmapped muscle returns itself
  assert.strictEqual(resolveCanonicalGroup("neck"), "neck");
  assert.strictEqual(resolveCanonicalGroup("tibialis"), "tibialis");
  console.log("✅ Sub-muscle inheritance resolves to correct parent groups");
}

// ─── Test 4: recoveryPct uses per-muscle window correctly ─────────────────
{
  // Default 24h window (backward compat)
  assert.strictEqual(recoveryPct(12), 50);
  assert.strictEqual(recoveryPct(24), 100);
  assert.strictEqual(recoveryPct(48), 100); // capped

  // 48h window (chest)
  assert.strictEqual(recoveryPct(24, 48), 50);
  assert.strictEqual(recoveryPct(48, 48), 100);
  assert.strictEqual(recoveryPct(12, 48), 25);

  // 60h window (quads)
  assert.strictEqual(recoveryPct(30, 60), 50);
  assert.strictEqual(recoveryPct(60, 60), 100);
  assert.strictEqual(recoveryPct(15, 60), 25);

  // 30h window (biceps)
  assert.strictEqual(recoveryPct(15, 30), 50);
  assert.strictEqual(recoveryPct(30, 30), 100);
  console.log("✅ recoveryPct uses per-muscle window correctly");
}

// ─── Test 5: statusFromHours uses per-muscle window correctly ─────────────
{
  // 48h window: at 24h = 50%, should be "partially_recovered"
  assert.strictEqual(statusFromHours(24, 48), "partially_recovered");
  // 48h window: at 48h = 100%, should be "fully_recovered"
  assert.strictEqual(statusFromHours(48, 48), "fully_recovered");
  // 48h window: at 38.4h = 80%, should be "fully_recovered"
  assert.strictEqual(statusFromHours(38.4, 48), "fully_recovered");
  // 60h window: at 24h = 40%, should be "partially_recovered"
  assert.strictEqual(statusFromHours(24, 60), "partially_recovered");
  // 30h window: at 24h = 80%, should be "fully_recovered"
  assert.strictEqual(statusFromHours(24, 30), "fully_recovered");
  console.log("✅ statusFromHours uses per-muscle window correctly");
}

// ─── Test 6: computeMuscleReadiness excludes outside active window ────────
{
  const data = {
    chest:      { pct: 50, hours: 24, status: "partially_recovered", isManual: false },
    quadriceps: { pct: 30, hours: 200, status: "not_recovered", isManual: false }, // >7 days
  };
  const result = computeMuscleReadiness(data, 7);
  // Only chest should be active (quads outside 168h window)
  assert.strictEqual(result.activeCount, 1);
  assert.strictEqual(result.score, 50);
  console.log("✅ computeMuscleReadiness excludes muscles outside active window");
}

// ─── Test 7: computeMuscleReadiness returns 100 when no muscles are active ─
{
  const data = {};
  const result = computeMuscleReadiness(data, 7);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.activeCount, 0);
  assert.strictEqual(result.status, "fully_recovered");
  console.log("✅ computeMuscleReadiness returns 100 when no muscles are active");
}

// ─── Test 8: computeMuscleReadiness returns 100 for never-trained muscles ──
{
  // hours === 0 means never trained (computeDynamicRecovery sets Infinity → 0)
  const data = {
    chest:      { pct: 100, hours: 0, status: "fully_recovered", isManual: false },
    quadriceps: { pct: 100, hours: 0, status: "fully_recovered", isManual: false },
  };
  const result = computeMuscleReadiness(data, 7);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.activeCount, 0);
  console.log("✅ computeMuscleReadiness excludes never-trained muscles (hours=0)");
}

// ─── Test 9: computeMuscleReadiness weighted average is correct ────────────
{
  // chest weight = 0.10, back weight = 0.14
  const data = {
    chest: { pct: 100, hours: 48, status: "fully_recovered", isManual: false },
    back:  { pct: 0,   hours: 1,  status: "not_recovered", isManual: false },
  };
  const result = computeMuscleReadiness(data, 7);
  // weighted avg = (100*0.10 + 0*0.14) / (0.10+0.14) = 10/0.24 ≈ 41.67 → 42
  assert.strictEqual(result.score, 42);
  assert.strictEqual(result.activeCount, 2);
  assert.strictEqual(result.status, "partially_recovered");
  console.log("✅ computeMuscleReadiness weighted average is correct");
}

// ─── Test 10: Manual overrides flow through to computeMuscleReadiness ──────
{
  // Manual override with hours=0 (never trained) should still be included
  const data = {
    chest: { pct: 20, hours: 0, status: "not_recovered", isManual: true },
  };
  const result = computeMuscleReadiness(data, 7);
  assert.strictEqual(result.activeCount, 1);
  assert.strictEqual(result.score, 20);
  assert.strictEqual(result.status, "not_recovered");
  console.log("✅ Manual overrides flow through correctly into composite score");
}

// ─── Test 11: Leg day pulls composite down more than arms day ──────────────
{
  // Simulate leg day: quads (0.16) + hamstrings (0.12) + glutes (0.10) at 30%
  const legDay = {
    quadriceps: { pct: 30, hours: 12, status: "not_recovered", isManual: false },
    hamstrings: { pct: 30, hours: 12, status: "not_recovered", isManual: false },
    glutes:     { pct: 30, hours: 12, status: "not_recovered", isManual: false },
  };
  const legResult = computeMuscleReadiness(legDay, 7);

  // Simulate arms day: biceps (0.06) + triceps (0.06) + forearms (0.02) at 30%
  const armsDay = {
    biceps:   { pct: 30, hours: 12, status: "not_recovered", isManual: false },
    triceps:  { pct: 30, hours: 12, status: "not_recovered", isManual: false },
    forearms: { pct: 30, hours: 12, status: "not_recovered", isManual: false },
  };
  const armsResult = computeMuscleReadiness(armsDay, 7);

  // Both should be 30 since all active muscles have the same pct,
  // but if we had mixed pcts, leg muscles would pull harder due to higher weights
  assert.strictEqual(legResult.score, 30);
  assert.strictEqual(armsResult.score, 30);
  // The key check: leg day has more active weight
  assert.ok(
    (MUSCLE_WEIGHT.quadriceps + MUSCLE_WEIGHT.hamstrings + MUSCLE_WEIGHT.glutes) >
    (MUSCLE_WEIGHT.biceps + MUSCLE_WEIGHT.triceps + MUSCLE_WEIGHT.forearms),
    "Leg muscles should have more aggregate weight than arm muscles"
  );
  console.log("✅ Leg muscles have higher aggregate weight than arm muscles (0.38 vs 0.14)");
}

// ─── Test 12: status label thresholds unchanged ───────────────────────────
{
  assert.strictEqual(getStatusFromPct(100), "fully_recovered");
  assert.strictEqual(getStatusFromPct(80),  "fully_recovered");
  assert.strictEqual(getStatusFromPct(79),  "mostly_recovered");
  assert.strictEqual(getStatusFromPct(60),  "mostly_recovered");
  assert.strictEqual(getStatusFromPct(59),  "partially_recovered");
  assert.strictEqual(getStatusFromPct(40),  "partially_recovered");
  assert.strictEqual(getStatusFromPct(39),  "not_recovered");
  assert.strictEqual(getStatusFromPct(0),   "not_recovered");
  console.log("✅ Status label thresholds are unchanged (80/60/40%)");
}

console.log("\n🎉 All recovery weighting tests passed!");
