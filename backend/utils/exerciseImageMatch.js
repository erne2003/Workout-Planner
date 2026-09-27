// Shared by backend/scratch/backfill_exercise_images.js and the live exercise-insert
// path, so a newly-added exercise (e.g. from the API Ninjas fallback search) gets a
// demo image match the same way the one-off backfill does.
const fs = require("fs");
const path = require("path");

const FED_PATH = path.resolve(__dirname, "../data/free-exercise-db.json");
const HIGH_CONFIDENCE = 0.75;
const STOP = new Set(["gethin", "variation", "with", "the", "a", "an", "and", "or", "to", "-", "fyr", "fyr2", "un", "uns", "am", "tbs", "acft"]);

let fedNormCache = null;

function normalize(name) {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t))
        .sort();
}

function jaccard(a, b) {
    const sa = new Set(a), sb = new Set(b);
    if (sa.size === 0 || sb.size === 0) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    return inter / new Set([...sa, ...sb]).size;
}

function loadFedDataset() {
    if (!fedNormCache) {
        const fed = JSON.parse(fs.readFileSync(FED_PATH, "utf8"));
        fedNormCache = fed.map((e) => ({ ...e, _norm: normalize(e.name) }));
    }
    return fedNormCache;
}

// Top N candidates for a name, ranked by token-overlap score, for manual review.
function rankCandidates(exerciseName, n = 3) {
    const norm = normalize(exerciseName);
    const fedNorm = loadFedDataset();
    return fedNorm
        .map((f) => ({ entry: f, score: jaccard(norm, f._norm) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
}

// Returns { fedId, imagePath } for a confident match, or null if nothing scored
// high enough to trust automatically.
function findConfidentImageMatch(exerciseName) {
    const top = rankCandidates(exerciseName, 1)[0];
    if (!top || top.score < HIGH_CONFIDENCE) return null;
    return { fedId: top.entry.id, imagePath: top.entry.images[0] };
}

module.exports = { normalize, jaccard, loadFedDataset, rankCandidates, findConfidentImageMatch, HIGH_CONFIDENCE };
