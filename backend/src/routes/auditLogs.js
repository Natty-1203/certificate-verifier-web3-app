'use strict';

const { Router } = require('express');
const { VerificationLog } = require('../database');
const { verifyToken }     = require('../middleware/auth');
const { asyncHandler }    = require('../middleware/errorHandler');

const router = Router();

// ── GET /api/audit-logs ───────────────────────────────────────────────────────
router.get('/',
    verifyToken,
    asyncHandler(async (req, res) => {
        const { certificate_id, page = 1, limit = 50 } = req.query;

        const where = certificate_id ? { certificate_id } : {};

        const logs = await VerificationLog.findAll({
            where,
            order:  [['timestamp', 'DESC']],
            limit:  parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.json(logs.map(log => ({
            id:              String(log.log_id),
            certificate_id:  log.certificate_id,
            actor:           log.actor || 'Public',
            action:          detectAction(log.details),
            timestamp:       log.timestamp,
            hash:            log.blockchain_tx_id || '',
            details:         log.details || '',
        })));
    })
);

function detectAction(details = '') {
    if (details.toLowerCase().includes('issued'))  return 'Issue';
    if (details.toLowerCase().includes('revoked')) return 'Revoke';
    return 'Verify';
}

module.exports = router;