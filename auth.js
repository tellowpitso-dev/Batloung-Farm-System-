const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'BatloungFarm_Secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired session token.' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Administrator privilege required.' });
    }
    next();
}

module.exports = {
    verifyToken,
    requireAdmin
};
