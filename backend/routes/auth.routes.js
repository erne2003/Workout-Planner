const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// POST /auth/register — create new user by name + email
router.post("/register", async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "name and email are required" });
    }
    try {
        // Check if email already exists
        const existing = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists. Try logging in." });
        }
        const result = await pool.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email`,
            [name, email, "no-auth"]   // placeholder password — no security needed for now
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("POST /auth/register error:", err.message);
        res.status(500).json({ error: "Failed to register" });
    }
});

// POST /auth/login — find user by email
router.post("/login", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "email is required" });
    }
    try {
        const result = await pool.query(`SELECT id, name, email FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No account found with that email. Try registering." });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("POST /auth/login error:", err.message);
        res.status(500).json({ error: "Failed to log in" });
    }
});

module.exports = router;