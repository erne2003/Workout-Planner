const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { searchExercises, insertExercises, getUniqueMuscles, getAllExercises, updateMuscleGroup } = require("../queries/exercises.queries");
const { findConfidentImageMatch } = require("../utils/exerciseImageMatch");
const { EXCLUDED_FROM_COMPUTED_STATS, buildImageUrl } = require("../config/exerciseImages");

const exerciseSearchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Max 50 searches per 15 minutes per IP
    message: { error: "Too many exercise search attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Estimated 1RM via the Epley formula. At 1 rep the "estimate" is already the max.
function estimateOneRepMax(weight, reps) {
    if (reps <= 1) return Math.round(weight);
    return Math.round(weight * (1 + reps / 30));
}

// Adds demo_image_url to every exercise, plus best1RM/bestSet for anything that
// isn't squat/bench/deadlift (those already have their own tested-1RM tracking
// in the Strength tab) and that the user has actually logged a set for.
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

router.get("/search", exerciseSearchLimiter, async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ error: "name query parameter is required" });
    }

    try {
        // 1. Search database first
        let exercises = await searchExercises(name, req.userId);

        // 2. Fallback to API Ninjas if no results in DB
        if (exercises.length === 0) {
            const apiKey = process.env.API_NINJAS_KEY;

            if (!apiKey) {
                console.warn("API_NINJAS_KEY is missing in environment variables.");
                return res.status(500).json({ error: "Server configuration error - missing API Ninjas key" });
            }

            const response = await axios.get(`https://api.api-ninjas.com/v1/exercises`, {
                params: { name },
                headers: { 'X-Api-Key': apiKey }
            });

            const apiData = response.data;

            if (apiData && apiData.length > 0) {
                const mappedData = apiData.map(ex => {
                    const match = findConfidentImageMatch(ex.name);
                    return {
                        name: ex.name,
                        muscle: ex.muscle,
                        demo_image_path: match?.imagePath,
                        demo_image_fed_id: match?.fedId,
                    };
                });
                // 3. Save new exercises to the database
                const inserted = await insertExercises(mappedData);
                exercises = inserted.map((ex) => ({ ...ex, best_weight: null, best_reps: null }));
            }
        }

        res.json(exercises.map(attachComputedFields));
    } catch (error) {
        console.error("GET /exercises/search error:", error.message);
        res.status(500).json({ error: "Failed to search exercises" });
    }
});

router.get("/muscles", async (req, res) => {
    try {
        const muscles = await getUniqueMuscles();
        res.json(muscles);
    } catch (error) {
        console.error("GET /exercises/muscles error:", error.message);
        res.status(500).json({ error: "Failed to fetch muscles" });
    }
});

router.get("/", async (req, res) => {
    try {
        const { muscle } = req.query;
        const exercises = await getAllExercises(muscle || null, req.userId);
        res.json(exercises.map(attachComputedFields));
    } catch (err) {
        console.error("GET /exercises error:", err.message);
        res.status(500).json({ error: "Failed to fetch exercises" });
    }
});

router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { muscle_group } = req.body;
        if (!muscle_group) return res.status(400).json({ error: "muscle_group is required" });
        const updated = await updateMuscleGroup(id, muscle_group);
        if (!updated) return res.status(404).json({ error: "Exercise not found" });
        res.json(updated);
    } catch (err) {
        console.error("PATCH /exercises/:id error:", err.message);
        res.status(500).json({ error: "Failed to update exercise" });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, muscle } = req.body;
        if (!name || !muscle) return res.status(400).json({ error: "name and muscle are required" });
        const match = findConfidentImageMatch(name);
        const inserted = await insertExercises([{ name, muscle, demo_image_path: match?.imagePath, demo_image_fed_id: match?.fedId }]);
        res.status(201).json(attachComputedFields({ ...inserted[0], best_weight: null, best_reps: null }));
    } catch (err) {
        console.error("POST /exercises error:", err.message);
        res.status(500).json({ error: "Failed to create exercise" });
    }
});

module.exports = router;
