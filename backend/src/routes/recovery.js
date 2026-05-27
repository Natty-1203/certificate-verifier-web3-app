'use strict';

const { Router } = require('express');
const { asyncHandler }    = require('../middleware/errorHandler');
const fabricGateway       = require('../fabric/gateway');
const { getFromIPFS, verifyFileIntegrity, computeSHA256 } = require('../utils/ipfs');
const logger = require('../utils/logger');

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/recovery/:certificateID
 *
 * Recover original certificate PDF by certificate ID.
 * The most direct recovery method.
 *
 * Flow:
 *   1. Fetch cert record from blockchain using certificateID
 *   2. Fetch PDF from IPFS using the CID stored on blockchain
 *   3. Verify PDF hash matches blockchain record
 *   4. Return PDF as download
 */
router.get('/:certificateID', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    logger.info(`Recovery requested for certificate: ${certificateID}`);

    // ── Step 1: Get record from blockchain ────────────────────────────────────
    const verifyResult = await fabricGateway.verifyCertificate(certificateID);

    if (!verifyResult.exists) {
        throw new Error(
            `NOT_FOUND — no certificate found with ID "${certificateID}"`
        );
    }

    if (verifyResult.isRevoked) {
        throw new Error(
            `REVOKED — certificate "${certificateID}" has been revoked.\n` +
            `Reason: ${verifyResult.certificate.revocationReason}\n` +
            `Contact your university for assistance.`
        );
    }

    const cert = verifyResult.certificate;

    // ── Step 2: Verify file integrity on IPFS ─────────────────────────────────
    logger.info(`Verifying integrity: CID=${cert.ipfsCID}`);
    const integrity = await verifyFileIntegrity(cert.ipfsCID, cert.sha256Hash);

    if (!integrity.isAuthentic) {
        throw new Error(
            `INTEGRITY_FAILED — the stored file does not match the blockchain record. ` +
            `Contact your university immediately.`
        );
    }

    // ── Step 3: Fetch PDF from IPFS ───────────────────────────────────────────
    logger.info(`Fetching PDF from IPFS: ${cert.ipfsCID}`);
    const fileBuffer = await getFromIPFS(cert.ipfsCID);

    // ── Step 4: Send PDF ──────────────────────────────────────────────────────
    const filename = `${cert.studentName.replace(/\s+/g, '_')}_${certificateID}.pdf`;

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Certificate-ID',    certificateID);
    res.setHeader('X-Student-Name',      cert.studentName);
    res.setHeader('X-IPFS-CID',          cert.ipfsCID);
    res.setHeader('X-SHA256-Hash',       cert.sha256Hash);
    res.setHeader('X-Blockchain-Verified', 'true');
    res.setHeader('X-Integrity-Check',   'PASSED');

    logger.info(`Sending recovered certificate: ${filename}`);
    res.send(fileBuffer);
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/recovery/student/:studentID
 *
 * Recover by student ID — when student forgets their certificate ID.
 * Requires CouchDB rich queries to be enabled.
 *
 * Returns certificate info (not the PDF) so student can
 * pick the right certificate then download it.
 */
router.get('/student/:studentID', asyncHandler(async (req, res) => {
    const { studentID } = req.params;

    logger.info(`Recovery lookup by studentID: ${studentID}`);

    const result = await fabricGateway.findByStudentID(studentID);

    if (!result || result.length === 0) {
        throw new Error(
            `NOT_FOUND — no certificates found for student ID "${studentID}"`
        );
    }

    // Return list of certificates found
    // Student then picks the one they want and calls /:certificateID
    res.json({
        success: true,
        message: `Found ${result.length} certificate(s) for student ${studentID}`,
        data: result.map(cert => ({
            certificateID:  cert.certificateID,
            studentName:    cert.studentName,
            department:     cert.department,
            graduationYear: cert.graduationYear,
            isRevoked:      cert.isRevoked,
            issuedAt:       cert.issuedAt,
            // Do NOT expose hash or CID in this list response
            downloadURL: `/api/recovery/${cert.certificateID}`,
        })),
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/recovery/info/:certificateID
 *
 * Get certificate info WITHOUT downloading the PDF.
 * Useful to confirm the certificate exists before downloading.
 */
router.get('/info/:certificateID', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    const result = await fabricGateway.verifyCertificate(certificateID);

    if (!result.exists) {
        throw new Error(`NOT_FOUND — certificate "${certificateID}" not found`);
    }

    const cert = result.certificate;

    res.json({
        success: true,
        data: {
            certificateID:  cert.certificateID,
            studentName:    cert.studentName,
            studentID:      cert.studentID,
            department:     cert.department,
            graduationYear: cert.graduationYear,
            cgpa:           cert.cgpa,
            issuedAt:       cert.issuedAt,
            status:         result.status,
            isRevoked:      cert.isRevoked,
            revocationReason: cert.isRevoked ? cert.revocationReason : null,
            ipfsGatewayURL: `${process.env.IPFS_GATEWAY_URL}/${cert.ipfsCID}`,
            downloadURL:    `/api/recovery/${certificateID}`,
        },
    });
}));

module.exports = router;