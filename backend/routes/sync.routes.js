const express = require("express");
const router = express.Router();
const { pullChanges, pushChanges, ChangeError } = require("../queries/sync.queries");

const PULL_DEFAULT_LIMIT = 500;
const PULL_MAX_LIMIT = 1000;
const PUSH_MAX_CHANGES = 100;

// GET /sync/pull?since=<ts>&limit=500   — first page of a sync
// GET /sync/pull?after=<next_cursor>     — following pages while has_more
// Returns every synced row changed since then (tombstones included), grouped
// by table, with exercise names joined in.
router.get("/pull", async (req, res) => {
    const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || PULL_DEFAULT_LIMIT, 1),
        PULL_MAX_LIMIT
    );
    try {
        const page = await pullChanges(req.userId, {
            since: req.query.since,
            after: req.query.after,
            limit,
        });
        res.json({ ...page, server_time: new Date().toISOString() });
    } catch (err) {
        if (err instanceof ChangeError) return res.status(400).json({ error: err.message });
        console.error("GET /sync/pull error:", err.message);
        res.status(500).json({ error: "Failed to pull changes" });
    }
});

// POST /sync/push  { changes: [{ tbl, op, uuid, parent_uuid?, payload }] }
// Applies up to 100 changes in order and answers with one result per change:
// { uuid, status: "ok" } or { uuid, status: "error", error }.
router.post("/push", async (req, res) => {
    const changes = req.body?.changes;
    if (!Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({ error: "changes must be a non-empty array" });
    }
    if (changes.length > PUSH_MAX_CHANGES) {
        return res.status(400).json({ error: `At most ${PUSH_MAX_CHANGES} changes per request` });
    }
    try {
        const results = await pushChanges(req.userId, changes);
        res.json({ results });
    } catch (err) {
        console.error("POST /sync/push error:", err.message);
        res.status(500).json({ error: "Failed to push changes" });
    }
});

module.exports = router;
