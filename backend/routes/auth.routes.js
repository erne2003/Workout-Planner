const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// POST /auth/register — create new user by name + email + password
router.post("/register", [
    body("email").isEmail().withMessage("Invalid email format").isLength({ max: 255 }),
    body("name").isLength({ min: 1, max: 100 }).withMessage("Name must be between 1 and 100 characters"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    validate
], async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Check if email already exists
        const existing = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        const user = result.rows[0];
        
        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error("POST /auth/register error:", err.message);
        res.status(500).json({ error: "Failed to register" });
    }
});

// POST /auth/login — find user by email and verify password
router.post("/login", [
    body("email").isEmail().withMessage("Invalid email format"),
    body("password").notEmpty().withMessage("Password is required"),
    validate
], async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error("POST /auth/login error:", err.message);
        res.status(500).json({ error: "Failed to log in" });
    }
});

module.exports = router;