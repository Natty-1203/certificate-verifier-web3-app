'use strict';

const { Router } = require('express');
const rateLimit  = require('express-rate-limit');
const fabricGateway         = require('../fabric/gateway');
const { Certificate, VerificationLog } = require('../database');
const { asyncHandler }      = require('../middleware/errorHandler');

const router = Router();

const verifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:      30,
    message:  { error: 'Too many requests. Please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders:   false,
});

router.get('/stats', async (_req, res) => {
    try {
        const totalIssued = await Certificate.count();
        const totalRevoked = await Certificate.count({ where: { status: 'Revoked' } });
        res.json({ totalIssued, totalRevoked });
    } catch {
        res.json({ totalIssued: 0, totalRevoked: 0 });
    }
});

// ── POST /api/public/verify ──────────────────────────────────────────────────
// Rate-limited public verification for third-party integrators (employers, etc.)
// Accepts: { certificateId } or { studentId } or { hash }
// Returns structured JSON for programmatic consumption
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', verifyLimiter, asyncHandler(async (req, res) => {
    const { certificateId, studentId, hash } = req.body;

    if (!certificateId && !studentId && !hash) {
        return res.status(400).json({
            success: false,
            error: 'Provide one of: certificateId, studentId, or hash',
        });
    }

    let blockchainResult = null;
    let method = 'CertificateID';

    if (hash) {
        method = 'Hash';
        blockchainResult = await fabricGateway.verifyByHash(hash);
    } else if (certificateId) {
        blockchainResult = await fabricGateway.verifyCertificate(certificateId);
    } else if (studentId) {
        method = 'CertificateID';
        const dbCert = await Certificate.findOne({ where: { student_id: studentId } });
        if (dbCert) {
            blockchainResult = await fabricGateway.verifyCertificate(dbCert.certificate_id);
        } else {
            blockchainResult = { exists: false };
        }
    }

    const exists = blockchainResult && blockchainResult.exists;
    const isRevoked = blockchainResult && blockchainResult.isRevoked;

    await VerificationLog.create({
        certificate_id: blockchainResult?.certificate?.certificateID || certificateId || studentId || 'unknown',
        verification_method: method,
        result: exists ? (isRevoked ? 'Revoked' : 'Valid') : 'NotFound',
        verifier_ip: req.ip,
        details: `Public API verification via ${method}`,
    }).catch(() => {});

    if (!exists) {
        return res.status(404).json({
            success: false,
            verified: false,
            error: 'No certificate found matching the provided identifier.',
        });
    }

    const cert = blockchainResult.certificate;

    res.json({
        success: true,
        verified: !isRevoked,
        revoked: !!isRevoked,
        certificate: {
            id: cert.certificateID,
            studentName: cert.studentName,
            studentId: cert.studentID,
            department: cert.department,
            cgpa: parseFloat(cert.cgpa),
            graduationYear: cert.graduationYear,
            issuedAt: cert.issuedAt,
            status: isRevoked ? 'Revoked' : 'Active',
            revocationReason: cert.revocationReason || null,
        },
        timestamp: new Date().toISOString(),
    });
}));

module.exports = router;
