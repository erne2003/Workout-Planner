const express = require("express");
const router = express.Router();
const {
    createWorkout,
    getWorkoutsByUser,
    getWorkoutById,
} = require("../models/workouts.model");

// GET /workouts?userId=1  →  all workouts for a user
router.get("/", async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: "userId query param is required" });
    }

    try {
        const workouts = await getWorkoutsByUser(userId);
        res.json(workouts);
    } catch (error) {
        console.error("GET /workouts error:", error.message);
        res.status(500).json({ error: "Failed to fetch workouts" });
    }
});

// GET /workouts/:id  →  single workout
router.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const workout = await getWorkoutById(id);
        if (!workout) {
            return res.status(404).json({ error: "Workout not found" });
        }
        res.json(workout);
    } catch (error) {
        console.error("GET /workouts/:id error:", error.message);
        res.status(500).json({ error: "Failed to fetch workout" });
    }
});

// POST /workouts  →  create a new workout
router.post("/", async (req, res) => {
    const { userId, name, notes } = req.body;

    if (!userId || !name) {
        return res.status(400).json({ error: "userId and name are required" });
    }

    try {
        const workout = await createWorkout({ userId, name, notes });
        res.status(201).json(workout);
    } catch (error) {
        console.error("POST /workouts error:", error.message);
        res.status(500).json({ error: "Failed to create workout" });
    }
});

module.exports = router;