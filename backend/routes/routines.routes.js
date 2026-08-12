const express = require("express");
const router = express.Router();
const { getRoutinesByUser, createRoutine, deleteRoutine, updateRoutine } = require("../queries/routines.queries");

// GET /routines - Fetch all routines for a user
router.get("/", async (req, res) => {
    try {
        const routines = await getRoutinesByUser(req.userId);
        res.json(routines);
    } catch (e) {
        console.error("GET /routines error:", e.message);
        res.status(500).json({ error: "Failed to fetch routines" });
    }
});

// POST /routines - Create a new routine
router.post("/", async (req, res) => {
    try {
        const { name, exercises } = req.body;
        if (!name || !exercises || !exercises.length) {
            return res.status(400).json({ error: "Missing name or exercises" });
        }
        
        const newRoutine = await createRoutine({ userId: req.userId, name, exercises });
        res.status(201).json(newRoutine);
    } catch (e) {
        console.error("POST /routines error:", e.message);
        res.status(500).json({ error: "Failed to create routine" });
    }
});

// DELETE /routines/:id - Delete a routine
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await deleteRoutine(id, req.userId);
        if (!deleted) {
            return res.status(404).json({ error: "Routine not found" });
        }
        res.json({ message: "Routine deleted successfully", deleted });
    } catch (e) {
        console.error("DELETE /routines/:id error:", e.message);
        res.status(500).json({ error: "Failed to delete routine" });
    }
});

// PUT /routines/:id - Update an existing routine's exercises list
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, exercises } = req.body;
        if (!name || !exercises || !exercises.length) {
            return res.status(400).json({ error: "Missing name or exercises" });
        }

        const updated = await updateRoutine({ userId: req.userId, routineId: id, name, exercises });
        if (!updated) {
            return res.status(404).json({ error: "Routine not found" });
        }
        res.json(updated);
    } catch (e) {
        console.error("PUT /routines/:id error:", e.message);
        res.status(500).json({ error: "Failed to update routine" });
    }
});

module.exports = router;
