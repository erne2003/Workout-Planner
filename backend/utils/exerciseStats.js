// Shared by exercises.routes.js and workouts.routes.js so an exercise's computed
// 1RM looks the same everywhere it's shown (search list, swap list, and the
// active-workout exercise card).

// Squat, bench, and deadlift already have their own tested-1RM tracking via the
// Strength tab's PR flow (see apps/mobile/app/(tabs)/strength.tsx), so the exercise
// list should not also show a set-derived estimate for them.
const EXCLUDED_FROM_COMPUTED_STATS = new Set([
    "bench press", "bench", "chest press",
    "squat", "barbell squat", "back squat",
    "deadlift", "barbell deadlift", "rdl",
]);

// Estimated 1RM via the Epley formula. At 1 rep the "estimate" is already the max.
function estimateOneRepMax(weight, reps) {
    if (reps <= 1) return Math.round(weight);
    return Math.round(weight * (1 + reps / 30));
}

// Adds best1RM/bestSetLabel for anything that isn't squat/bench/deadlift and
// that the user has actually logged a set for.
function attachComputedFields(exercise) {
    const { best_weight, best_reps, ...rest } = exercise;
    const result = { ...rest };

    const isBigThree = EXCLUDED_FROM_COMPUTED_STATS.has(exercise.name.trim().toLowerCase());
    if (!isBigThree && best_weight != null) {
        const weight = Number(best_weight);
        const reps = Number(best_reps);
        result.best1RM = estimateOneRepMax(weight, reps);
        result.bestSetLabel = `${weight}x${reps}`;
    }

    return result;
}

module.exports = { estimateOneRepMax, attachComputedFields };
