const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
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

    try {
        const decoded = jwt.verify(token, secret);
        req.userId = decoded.userId;
        req.userName = decoded.name;
        next();
    } catch (err) {
        console.error(`JWT Verification error [${err.name}]:`, err.message);
        const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
        return res.status(401).json({ error: "Unauthorized", code });
    }
};

