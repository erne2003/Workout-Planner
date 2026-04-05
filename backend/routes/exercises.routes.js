const express = require("express");
const axios = require("axios");
const router = express.Router();
const { searchExercises, insertExercises } = require("../queries/exercises.queries");

router.get("/search", async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({ error: "name query parameter is required" });
    }

    try {
        // 1. Search database first
        let exercises = await searchExercises(name);

        // 2. Fallback to ExerciseDB (via RapidAPI) if no results in DB
        if (exercises.length === 0) {
            const apiKey = process.env.EXERCISE_DB_KEY;
            
            if (!apiKey || apiKey === "your_api_key_here") {
                console.warn("EXERCISE_DB_KEY is missing or invalid in environment variables.");
                return res.status(500).json({ error: "Server configuration error - missing ExerciseDB key" });
            }

            const response = await axios.get(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}`, {
                headers: { 
                  'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
                  'x-rapidapi-key': apiKey 
                }
            });

            const apiData = response.data;

            if (apiData && apiData.length > 0) {
                // ExerciseDB uses `target` instead of `muscle`. We map it to our DB schema constraint.
                const mappedData = apiData.map(ex => ({
                    name: ex.name,
                    muscle: ex.target || ex.bodyPart
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

module.exports = router;
