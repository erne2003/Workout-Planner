const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/**
 * requireAuth — verifies the user's JWT then does a single indexed DB lookup
 * to validate token_version (force-logout support) and is_disabled (account lock).
 * Algorithm is pinned to HS256 to prevent algorithm-confusion attacks.
 */
module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid token", code: "MISSING_TOKEN" });
    }

    const token = authHeader.split(" ")[1];

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("[Auth] FATAL: JWT_SECRET environment variable is missing!");
        return res.status(500).json({ error: "Server authentication configuration error" });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    } catch (err) {
        console.error(`JWT Verification error [${err.name}]:`, err.message);
        const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
        return res.status(401).json({ error: "Unauthorized", code });
    }

    // Single indexed PK lookup — covers both is_disabled and token_version in one round-trip
    try {
        const { rows } = await pool.query(
            "SELECT is_disabled, token_version FROM users WHERE id = $1",
            [decoded.userId]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "User not found", code: "USER_NOT_FOUND" });
        }

        const user = rows[0];

        if (user.is_disabled) {
            return res.status(403).json({ error: "Account is disabled", code: "ACCOUNT_DISABLED" });
        }

        // Tokens minted before this migration won't have tokenVersion — treat as 0
        const tokenVersion = decoded.tokenVersion ?? 0;
        if (tokenVersion !== user.token_version) {
            return res.status(401).json({ error: "Session invalidated, please log in again", code: "TOKEN_VERSION_MISMATCH" });
        }

        req.userId = decoded.userId;
        req.userName = decoded.name;
        next();
    } catch (err) {
        console.error("[Auth] DB lookup error:", err.message);
        return res.status(500).json({ error: "Authentication check failed" });
    }
};
