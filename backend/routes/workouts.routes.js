const express = require("express");
const router = express.Router();
const {
    createWorkout,
    getWorkoutsByUser,
    getWorkoutById,
    deleteWorkout,
    deleteWorkoutSetsByWorkoutId,
    createWorkoutSet,
    deleteWorkoutSet,
    getWorkoutSets
} = require("../queries/workouts.queries");

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

// DELETE /workouts/:id  →  delete a workout and its sets
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        // First delete all dependent sets to satisfy foreign key constraints
        await deleteWorkoutSetsByWorkoutId(id);
        
        const deletedWorkout = await deleteWorkout(id);
        if (!deletedWorkout) {
            return res.status(404).json({ error: "Workout not found" });
        }
        
        res.json({ message: "Workout and associated sets deleted successfully", workout: deletedWorkout });
    } catch (error) {
        console.error("DELETE /workouts/:id error:", error.message);
        res.status(500).json({ error: "Failed to delete workout" });
    }
});

// POST /workouts/:id/sets  →  add a set to a workout
router.post("/:id/sets", async (req, res) => {
    const { id } = req.params;
    const { exerciseId, setOrder, reps, weight, rir } = req.body;

    if (!exerciseId || !setOrder || !reps || weight === undefined) {
        return res.status(400).json({ error: "exerciseId, setOrder, reps, and weight are required" });
    }

    try {
        const newSet = await createWorkoutSet({
            workoutId: id,
            exerciseId,
            setOrder,
            reps,
            weight,
            rir: rir || null // rir is optional
        });
        res.status(201).json(newSet);
    } catch (error) {
        console.error("POST /workouts/:id/sets error:", error.message);
        res.status(500).json({ error: "Failed to create workout set" });
    }
});

// DELETE /workouts/:id/sets/:setId  →  remove a single set
router.delete("/:id/sets/:setId", async (req, res) => {
    const { setId } = req.params;

    try {
        const deletedSet = await deleteWorkoutSet(setId);
        if (!deletedSet) {
            return res.status(404).json({ error: "Workout set not found" });
        }
        res.json({ message: "Set deleted successfully", set: deletedSet });
    } catch (error) {
        console.error("DELETE /workouts/:id/sets/:setId error:", error.message);
        res.status(500).json({ error: "Failed to delete workout set" });
    }
});

// GET /workouts/:id/sets  →  get all sets for a workout
router.get("/:id/sets", async (req, res) => {
    const { id } = req.params;

    try {
        const sets = await getWorkoutSets(id);
        res.json(sets);
    } catch (error) {
        console.error("GET /workouts/:id/sets error:", error.message);
        res.status(500).json({ error: "Failed to fetch workout sets" });
    }
});

module.exports = router;