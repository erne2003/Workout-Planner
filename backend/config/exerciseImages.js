// free-exercise-db (Unlicense/public domain) served via jsDelivr, pinned to a commit
// so image paths never shift under us. See backend/scratch/backfill_exercise_images.js.
const EXERCISE_IMAGE_CDN_BASE =
    "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@a859101d633a01c4a1a920d6a8ce41dabba0705f/exercises/";

// Squat, bench, and deadlift already have their own tested-1RM tracking via the
// Strength tab's PR flow (see apps/mobile/app/(tabs)/strength.tsx), so the exercise
// list should not also show a set-derived estimate for them.
const EXCLUDED_FROM_COMPUTED_STATS = new Set([
    "bench press", "bench", "chest press",
    "squat", "barbell squat", "back squat",
    "deadlift", "barbell deadlift", "rdl",
]);

function buildImageUrl(demoImagePath) {
    return demoImagePath ? `${EXERCISE_IMAGE_CDN_BASE}${demoImagePath}` : null;
}

module.exports = { EXERCISE_IMAGE_CDN_BASE, EXCLUDED_FROM_COMPUTED_STATS, buildImageUrl };
