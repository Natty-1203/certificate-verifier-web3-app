'use strict';

/**
 * Restrict endpoint to specific roles.
 * Usage: router.post('/route', verifyToken, requireRole('Admin'), handler)
 *        router.post('/route', verifyToken, requireRole(['Admin','Issuer']), handler)
 */
function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access Denied: Requires ${roles.join(' or ')} authority.`
            });
        }

        next();
    };
}

module.exports = { requireRole };