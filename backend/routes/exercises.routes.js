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

        // 2. Fallback to API Ninjas if no results are found in DB
        if (exercises.length === 0) {
            const apiKey = process.env.API_NINJAS_KEY;
            
            if (!apiKey || apiKey === "your_api_key_here") {
                console.warn("API_NINJAS_KEY is missing or invalid in environment variables.");
                return res.status(500).json({ error: "Server configuration error - missing API key" });
            }

            const response = await axios.get(`https://api.api-ninjas.com/v1/exercises?name=${name}`, {
                headers: { 'X-Api-Key': apiKey }
            });

            const apiData = response.data;

            if (apiData && apiData.length > 0) {
                // 3. Save new exercises to the database
                const inserted = await insertExercises(apiData);
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
