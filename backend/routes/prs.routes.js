const express = require("express");
const router = express.Router();
const prsQueries = require("../queries/prs.queries");

// POST /prs
router.post("/", async (req, res) => {
  const { userId, exerciseName, weight } = req.body;
  try {
    const newPr = await prsQueries.logPR(userId || 1, exerciseName, weight);
    res.status(201).json(newPr);
  } catch (err) {
    console.error("Failed to log PR:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET /prs?userId=1
router.get("/", async (req, res) => {
  const { userId } = req.query;
  try {
    const history = await prsQueries.getHistoricalPRs(userId || 1);
    res.json(history);
  } catch (err) {
    console.error("Failed to fetch PR history:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
