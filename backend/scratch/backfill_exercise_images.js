/**
 * Matches exercises in the `exercises` table against the vendored free-exercise-db
 * dataset (backend/data/free-exercise-db.json, Unlicense/public domain) by normalized
 * name, and backfills demo_image_path / demo_image_fed_id for confident matches.
 *
 * Exact and high-confidence (>=0.75 token-overlap) matches are applied directly.
 * Everything else is written to backend/scratch/exercise-image-review.csv with the
 * top 3 candidates for manual review — fill in `chosen_fed_id` and re-run with
 * --apply-review to ingest corrections.
 *
 * Usage:
 *   node scratch/backfill_exercise_images.js            # dry run, prints stats only
 *   node scratch/backfill_exercise_images.js --apply     # writes confident matches to DB + CSV
 *   node scratch/backfill_exercise_images.js --apply-review  # ingests reviewed CSV
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");
const { loadFedDataset, rankCandidates, HIGH_CONFIDENCE } = require("../utils/exerciseImageMatch");

const REVIEW_CSV = path.resolve(__dirname, "exercise-image-review.csv");

function csvEscape(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsvLine(line) {
    const fields = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else { cur += c; }
        } else if (c === '"') { inQuotes = true; }
        else if (c === ",") { fields.push(cur); cur = ""; }
        else { cur += c; }
    }
    fields.push(cur);
    return fields;
}

async function run() {
    const applyConfident = process.argv.includes("--apply");
    const applyReview = process.argv.includes("--apply-review");

    if (applyReview) {
        return applyReviewCsv();
    }

    loadFedDataset(); // warm the cache once up front
    const { rows: ours } = await pool.query("SELECT id, name, demo_image_path FROM exercises ORDER BY name ASC");

    let exact = 0, high = 0, needsReview = 0;
    const toApply = [];
    const reviewRows = [];

    for (const ex of ours) {
        const ranked = rankCandidates(ex.name);
        const top = ranked[0];
        const isExact = top && top.score === 1;

        if (isExact || (top && top.score >= HIGH_CONFIDENCE)) {
            isExact ? exact++ : high++;
            toApply.push({ id: ex.id, fedId: top.entry.id, imagePath: top.entry.images[0] });
        } else {
            needsReview++;
            reviewRows.push({
                our_id: ex.id,
                our_name: ex.name,
                chosen_fed_id: "",
                candidate_1: ranked[0] ? `${ranked[0].entry.id} (${ranked[0].score.toFixed(2)})` : "",
                candidate_2: ranked[1] ? `${ranked[1].entry.id} (${ranked[1].score.toFixed(2)})` : "",
                candidate_3: ranked[2] ? `${ranked[2].entry.id} (${ranked[2].score.toFixed(2)})` : "",
            });
        }
    }

    console.log(`Total exercises: ${ours.length}`);
    console.log(`Exact matches: ${exact}`);
    console.log(`High-confidence fuzzy matches (>=${HIGH_CONFIDENCE}): ${high}`);
    console.log(`Needs manual review: ${needsReview}`);

    const header = "our_id,our_name,chosen_fed_id,candidate_1,candidate_2,candidate_3\n";
    const body = reviewRows
        .map((r) => [r.our_id, r.our_name, r.chosen_fed_id, r.candidate_1, r.candidate_2, r.candidate_3].map(csvEscape).join(","))
        .join("\n");
    fs.writeFileSync(REVIEW_CSV, header + body + "\n");
    console.log(`Wrote review sheet: ${REVIEW_CSV}`);
    console.log(`  -> Fill in the "chosen_fed_id" column (copy the id out of whichever candidate is correct,`);
    console.log(`     or leave blank to skip), then run: node scratch/backfill_exercise_images.js --apply-review`);

    if (!applyConfident) {
        console.log("\nDry run only (no DB writes). Re-run with --apply to write the confident matches above.");
        return;
    }

    for (const { id, fedId, imagePath } of toApply) {
        await pool.query("UPDATE exercises SET demo_image_path = $1, demo_image_fed_id = $2 WHERE id = $3", [imagePath, fedId, id]);
    }
    console.log(`Applied ${toApply.length} confident matches to the database.`);
}

async function applyReviewCsv() {
    if (!fs.existsSync(REVIEW_CSV)) {
        console.error(`No review sheet found at ${REVIEW_CSV}`);
        return;
    }
    const fedById = new Map(loadFedDataset().map((e) => [e.id, e]));

    const lines = fs.readFileSync(REVIEW_CSV, "utf8").trim().split("\n").slice(1);
    let applied = 0, skipped = 0, invalid = 0;

    for (const line of lines) {
        if (!line.trim()) continue;
        const [ourId, , chosenFedId] = parseCsvLine(line);
        if (!chosenFedId || !chosenFedId.trim()) { skipped++; continue; }

        const fedEntry = fedById.get(chosenFedId.trim());
        if (!fedEntry) {
            console.warn(`Row ${ourId}: unknown fed_id "${chosenFedId.trim()}", skipping`);
            invalid++;
            continue;
        }

        await pool.query("UPDATE exercises SET demo_image_path = $1, demo_image_fed_id = $2 WHERE id = $3", [
            fedEntry.images[0],
            fedEntry.id,
            Number(ourId),
        ]);
        applied++;
    }

    console.log(`Applied ${applied} manual matches, skipped ${skipped} blanks, ${invalid} invalid ids.`);
}

run()
    .catch((e) => console.error("Backfill failed:", e))
    .finally(() => pool.end());
