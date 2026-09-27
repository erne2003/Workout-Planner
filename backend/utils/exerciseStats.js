// Shared by exercises.routes.js and workouts.routes.js so an exercise's demo
// image / computed 1RM look the same everywhere it's shown (search list, swap
// list, and the active-workout exercise card).
const { EXCLUDED_FROM_COMPUTED_STATS, buildImageUrl } = require("../config/exerciseImages");

// Estimated 1RM via the Epley formula. At 1 rep the "estimate" is already the max.
function estimateOneRepMax(weight, reps) {
    if (reps <= 1) return Math.round(weight);
    return Math.round(weight * (1 + reps / 30));
}

// Adds demo_image_url to every exercise, plus best1RM/bestSetLabel for anything
// that isn't squat/bench/deadlift (those already have their own tested-1RM
// tracking in the Strength tab) and that the user has actually logged a set for.
function attachComputedFields(exercise) {
    const { best_weight, best_reps, demo_image_path, ...rest } = exercise;
    const result = { ...rest, demo_image_path, demo_image_url: buildImageUrl(demo_image_path) };

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
