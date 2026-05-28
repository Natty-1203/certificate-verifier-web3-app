'use strict';

const { Router }   = require('express');
const { Op }       = require('sequelize');
const { Certificate, VerificationLog, User } = require('../database');
const { verifyToken }  = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = Router();

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────
router.get('/stats',
    verifyToken,
    asyncHandler(async (req, res) => {

        // Start of today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
            totalIssued,
            totalRevoked,
            verificationAttemptsToday,
            verificationAttemptsAllTime,
            totalRegisteredUsers,
        ] = await Promise.all([
            Certificate.count(),
            Certificate.count({ where: { status: 'Revoked' } }),
            VerificationLog.count({
                where: {
                    timestamp: { [Op.gte]: todayStart },
                    // Only count verify actions not issue/revoke
                    details:   { [Op.notLike]: '%issued%' }
                }
            }),
            VerificationLog.count({
                where: {
                    details: { [Op.notLike]: '%issued%' }
                }
            }),
            User.count(),
        ]);

        res.json({
            totalIssued,
            totalRevoked,
            verificationAttemptsToday,
            verificationAttemptsAllTime,
            totalRegisteredUsers,
        });
    })
);

module.exports = router;