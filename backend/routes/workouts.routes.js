const express = require("express");
const router = express.Router();
const {
    createWorkout,
    getWorkoutsByUser,
    getWorkoutById,
    updateWorkout,
    deleteWorkout,
    getWorkoutSets,
    createWorkoutSet,
    updateWorkoutSet,
    deleteWorkoutSet,
    getLastSetsForExercise,
} = require("../queries/workouts.queries");

// ── Workouts ──────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId query param is required" });
    try {
        res.json(await getWorkoutsByUser(userId));
    } catch (err) {
        console.error("GET /workouts error:", err.message);
        res.status(500).json({ error: "Failed to fetch workouts" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const workout = await getWorkoutById(req.params.id);
        if (!workout) return res.status(404).json({ error: "Workout not found" });
        res.json(workout);
    } catch (err) {
        console.error("GET /workouts/:id error:", err.message);
        res.status(500).json({ error: "Failed to fetch workout" });
    }
});

router.post("/", async (req, res) => {
    const { userId, name, notes } = req.body;
    if (!userId || !name) return res.status(400).json({ error: "userId and name are required" });
    try {
        res.status(201).json(await createWorkout({ userId, name, notes }));
    } catch (err) {
        console.error("POST /workouts error:", err.message);
        res.status(500).json({ error: "Failed to create workout" });
    }
});

router.put("/:id", async (req, res) => {
    const { name, notes } = req.body;
    if (!name && notes === undefined) return res.status(400).json({ error: "Provide name or notes to update" });
    try {
        const updated = await updateWorkout(req.params.id, { name, notes });
        if (!updated) return res.status(404).json({ error: "Workout not found" });
        res.json(updated);
    } catch (err) {
        console.error("PUT /workouts/:id error:", err.message);
        res.status(500).json({ error: "Failed to update workout" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const deleted = await deleteWorkout(req.params.id);
        if (!deleted) return res.status(404).json({ error: "Workout not found" });
        res.json({ message: "Workout deleted", workout: deleted });
    } catch (err) {
        console.error("DELETE /workouts/:id error:", err.message);
        res.status(500).json({ error: "Failed to delete workout" });
    }
});

// ── Sets ──────────────────────────────────────────────────────────────────────

router.get("/:id/sets", async (req, res) => {
    try {
        res.json(await getWorkoutSets(req.params.id));
    } catch (err) {
        console.error("GET /workouts/:id/sets error:", err.message);
        res.status(500).json({ error: "Failed to fetch workout sets" });
    }
});

router.post("/:id/sets", async (req, res) => {
    const { exerciseId, setOrder, reps, weight, rir } = req.body;
    if (!exerciseId || !setOrder || !reps || weight === undefined)
        return res.status(400).json({ error: "exerciseId, setOrder, reps, and weight are required" });
    try {
        res.status(201).json(await createWorkoutSet({
            workoutId: req.params.id, exerciseId, setOrder, reps, weight, rir: rir ?? null,
        }));
    } catch (err) {
        console.error("POST /workouts/:id/sets error:", err.message);
        res.status(500).json({ error: "Failed to create workout set" });
    }
});

router.put("/:id/sets/:setId", async (req, res) => {
    const { reps, weight, rir, setOrder } = req.body;
    if ([reps, weight, rir, setOrder].every(v => v === undefined))
        return res.status(400).json({ error: "Provide at least one field: reps, weight, rir, setOrder" });
    try {
        const updated = await updateWorkoutSet(req.params.setId, { reps, weight, rir, setOrder });
        if (!updated) return res.status(404).json({ error: "Set not found" });
        res.json(updated);
    } catch (err) {
        console.error("PUT /workouts/:id/sets/:setId error:", err.message);
        res.status(500).json({ error: "Failed to update set" });
    }
});

router.delete("/:id/sets/:setId", async (req, res) => {
    try {
        const deleted = await deleteWorkoutSet(req.params.setId);
        if (!deleted) return res.status(404).json({ error: "Set not found" });
        res.json({ message: "Set deleted", set: deleted });
    } catch (err) {
        console.error("DELETE /workouts/:id/sets/:setId error:", err.message);
        res.status(500).json({ error: "Failed to delete set" });
    }
});

// ── NEW: Previous sets for an exercise ───────────────────────────────────────
// GET /workouts/history/:exerciseId?userId=1
// Returns the sets from the last time this user did this exercise.

router.get("/history/:exerciseId", async (req, res) => {
    const { userId } = req.query;
    const { exerciseId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId query param is required" });
    try {
        res.json(await getLastSetsForExercise(userId, exerciseId));
    } catch (err) {
        console.error("GET /workouts/history/:exerciseId error:", err.message);
        res.status(500).json({ error: "Failed to fetch exercise history" });
    }
});

module.exports = router;