const express = require("express");
const router = express.Router();
const { getRoutinesByUser, createRoutine, deleteRoutine } = require("../queries/routines.queries");

// GET /routines - Fetch all routines for a user
router.get("/", async (req, res) => {
    try {
        const userId = req.query.userId || 1; // Default to user 1 for now
        const routines = await getRoutinesByUser(userId);
        res.json(routines);
    } catch (e) {
        console.error("GET /routines error:", e.message);
        res.status(500).json({ error: "Failed to fetch routines" });
    }
});

// POST /routines - Create a new routine
router.post("/", async (req, res) => {
    try {
        const { userId = 1, name, exercises } = req.body;
        if (!name || !exercises || !exercises.length) {
            return res.status(400).json({ error: "Missing name or exercises" });
        }
        
        const newRoutine = await createRoutine({ userId, name, exercises });
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
        const deleted = await deleteRoutine(id);
        if (!deleted) {
            return res.status(404).json({ error: "Routine not found" });
        }
        res.json({ message: "Routine deleted successfully", deleted });
    } catch (e) {
        console.error("DELETE /routines/:id error:", e.message);
        res.status(500).json({ error: "Failed to delete routine" });
    }
});

module.exports = router;
