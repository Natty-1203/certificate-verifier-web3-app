'use strict';

const { Router } = require('express');
const Joi        = require('joi');
const fabricGateway         = require('../fabric/gateway');
const { asyncHandler }      = require('../middleware/errorHandler');
const logger                = require('../utils/logger');

const router = Router();

// ── Validation schemas ───────────────────────────────────────────────────────

const issueSchema = Joi.object({
    certificateID:  Joi.string().regex(/^[a-zA-Z0-9-]+$/).max(64).required().messages({
        'string.pattern.base': '"certificateID" must only contain alpha-numeric characters and hyphens'
    }),
    studentName:    Joi.string().max(128).required(),
    studentID:      Joi.string().max(64).required(),
    department:     Joi.string().max(128).required(),
    cgpa:           Joi.number().min(0).max(4.0).required(),
    graduationYear: Joi.number().integer().min(1900).max(2100).required(),
    sha256Hash:     Joi.string().length(64).hex().required(),
    ipfsCID:        Joi.string().max(128).required(),
});

const revokeSchema = Joi.object({
    reason: Joi.string().max(256).optional(),
});

function validate(schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
        const msg = error.details.map(d => d.message).join('; ');
        throw new Error(`INVALID_INPUT — ${msg}`);
    }
    return value;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/certificates
 * Issue a new certificate.
 * Caller must have ISSUER role on the Fabric network.
 *
 * Body: { certificateID, studentName, studentID, department,
 *         cgpa, graduationYear, sha256Hash, ipfsCID }
 */
router.post('/', asyncHandler(async (req, res) => {
    const data = validate(issueSchema, req.body);

    logger.info(`Issuing certificate: ${data.certificateID}`);
    const result = await fabricGateway.issueCertificate(data);

    res.status(201).json({ success: true, data: result });
}));

/**
 * GET /api/certificates/:certificateID/verify
 * Verify a certificate by its ID. Public endpoint.
 *
 * Response: { status: 'VALID' | 'REVOKED' | 'NOT_FOUND', ... }
 */
router.get('/:certificateID/verify', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    logger.info(`Verifying certificate: ${certificateID}`);
    const result = await fabricGateway.verifyCertificate(certificateID);

    res.json({ success: true, data: result });
}));

/**
 * GET /api/certificates/verify/hash/:sha256Hash
 * Verify a certificate by the SHA-256 hash of the PDF. Public endpoint.
 */
router.get('/verify/hash/:sha256Hash', asyncHandler(async (req, res) => {
    const { sha256Hash } = req.params;

    logger.info(`Verifying by hash: ${sha256Hash.slice(0, 16)}...`);
    const result = await fabricGateway.verifyByHash(sha256Hash);

    res.json({ success: true, data: result });
}));

/**
 * PATCH /api/certificates/:certificateID/revoke
 * Revoke a certificate. Caller must have ADMIN role.
 *
 * Body: { reason? }
 */
router.patch('/:certificateID/revoke', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;
    const { reason }        = validate(revokeSchema, req.body);

    logger.warn(`Revoking certificate: ${certificateID} — reason: ${reason}`);
    const result = await fabricGateway.revokeCertificate(certificateID, reason);

    res.json({ success: true, data: result });
}));

/**
 * GET /api/certificates/:certificateID/history
 * Get the full audit history. Caller must have ADMIN role.
 */
router.get('/:certificateID/history', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    logger.info(`Querying history: ${certificateID}`);
    const result = await fabricGateway.queryCertificateHistory(certificateID);

    res.json({ success: true, data: result });
}));

/**
 * GET /api/certificates/:certificateID
 * Get the full certificate record. Caller must have ADMIN or ISSUER role.
 */
router.get('/:certificateID', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    logger.info(`Getting certificate: ${certificateID}`);
    const result = await fabricGateway.getCertificate(certificateID);

    res.json({ success: true, data: result });
}));

module.exports = router;