'use strict';

const jwt    = require('jsonwebtoken');
const { User } = require('../database');

/**
 * Verify JWT token on every protected request.
 * Attaches req.user = { id, username, role, institution_id }
 */
async function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token      = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            message: 'Authentication required.'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check user still exists and is active
        const user = await User.findByPk(decoded.id);
        if (!user || !user.is_active) {
            return res.status(401).json({
                message: 'Account is inactive or no longer exists.'
            });
        }

        req.user = {
            id:             decoded.id,
            username:       decoded.username,
            role:           decoded.role,
            institution_id: decoded.institution_id,
        };

        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please log in again.' });
        }
        return res.status(401).json({ message: 'Invalid token.' });
    }
}

module.exports = { verifyToken };