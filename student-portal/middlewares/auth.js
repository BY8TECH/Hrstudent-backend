const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token, authorization denied" });
    }
    const token = authHeader.split(" ")[1];

    try {
        // Use the unified secret for all tokens
        const secret = process.env.JWT_SECRET || process.env.SP_JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        
        // Normalize payload: HR tokens use { id }, Student tokens use { id, role }
        // Ensure req.user has an 'id' property regardless of the source
        req.user = {
            id: decoded.id || decoded._id,
            role: decoded.role || 'user'
        };
        
        next();
    } catch (err) {
        console.log('--- Auth Failure ---');
        console.log('Error:', err.message);
        console.log('Secret used for check:', process.env.JWT_SECRET);
        return res.status(401).json({ success: false, message: "Token is not valid" });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        // If the token already specifies 'HR' or 'admin' role, allow it
        if (req.user.role === "admin" || req.user.role === "HR") {
            return next();
        }

        const user = await User.findById(req.user.id).select("role");
        if (!user || (user.role !== "admin" && user.role !== "HR"))
            return res.status(403).json({ success: false, message: "Admin access required" });
        
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { protect, isAdmin };
