const jwt = require("jsonwebtoken");

/**
 * requireAdmin — validates the admin JWT sent in Authorization: Bearer <token>.
 * The admin JWT is signed with ADMIN_JWT_SECRET (separate from user JWT_SECRET).
 * Algorithm is pinned to HS256 to prevent algorithm-confusion attacks.
 */
module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid admin token", code: "MISSING_ADMIN_TOKEN" });
    }

    const token = authHeader.split(" ")[1];

    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
        console.error("[Admin] FATAL: ADMIN_JWT_SECRET environment variable is missing!");
        return res.status(500).json({ error: "Server admin configuration error" });
    }

    try {
        const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });

        // Ensure this is actually an admin token (not a user token sent to an admin endpoint)
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Forbidden: not an admin token", code: "NOT_ADMIN" });
        }

        req.adminId = decoded.adminId;
        next();
    } catch (err) {
        const code = err.name === "TokenExpiredError" ? "ADMIN_TOKEN_EXPIRED" : "INVALID_ADMIN_TOKEN";
        return res.status(401).json({ error: "Unauthorized", code });
    }
};
