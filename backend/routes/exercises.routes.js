const express = require("express");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { searchExercises, insertExercises, getUniqueMuscles, getAllExercises, updateMuscleGroup } = require("../queries/exercises.queries");

const exerciseSearchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Max 50 searches per 15 minutes per IP
    message: { error: "Too many exercise search attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

router.get("/search", exerciseSearchLimiter, async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ error: "name query parameter is required" });
    }

    try {
        // 1. Search database first
        let exercises = await searchExercises(name);

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
                const mappedData = apiData.map(ex => ({
                    name: ex.name,
                    muscle: ex.muscle
                }));
                // 3. Save new exercises to the database
                const inserted = await insertExercises(mappedData);
                exercises = inserted;
            }
        }

        res.json(exercises);
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
        const exercises = await getAllExercises(muscle || null);
        res.json(exercises);
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
        const inserted = await insertExercises([{ name, muscle }]);
        res.status(201).json(inserted[0]);
    } catch (err) {
        console.error("POST /exercises error:", err.message);
        res.status(500).json({ error: "Failed to create exercise" });
    }
});

module.exports = router;
