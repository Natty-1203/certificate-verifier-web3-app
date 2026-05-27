'use strict';

const { Router } = require('express');
const multer     = require('multer');
const { asyncHandler } = require('../middleware/errorHandler');
const fabricGateway    = require('../fabric/gateway');
const {
    uploadToIPFS,
    computeSHA256,
    verifyFileIntegrity,
    isIPFSReady,
} = require('../utils/ipfs');
const logger = require('../utils/logger');

const router = Router();

// ── Multer config — accept PDF only, max 10MB ─────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),    // keep file in memory as Buffer
    limits:  { fileSize: 10 * 1024 * 1024 },  // 10MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('INVALID_INPUT — only PDF files are accepted'));
        }
    },
});

// ── IPFS health check ─────────────────────────────────────────────────────────
router.get('/health', asyncHandler(async (_req, res) => {
    const status = await isIPFSReady();
    res.json({ success: true, ipfs: status });
}));

/**
 * POST /api/upload/certificate
 *
 * Full flow in one endpoint:
 *   1. Receive PDF file + certificate metadata
 *   2. Compute SHA-256 hash of PDF
 *   3. Upload PDF to IPFS → get CID
 *   4. Store hash + CID + metadata on blockchain
 */
router.post('/certificate', upload.single('pdf'), asyncHandler(async (req, res) => {
    // ── Validate file was uploaded ────────────────────────────────────────────
    if (!req.file) {
        throw new Error('INVALID_INPUT — PDF file is required');
    }

    const {
        certificateID,
        studentName,
        studentID,
        department,
        cgpa,
        graduationYear,
    } = req.body;

    if (!certificateID || !studentName || !studentID
        || !department || !cgpa || !graduationYear) {
        throw new Error('INVALID_INPUT — all metadata fields are required');
    }

    const fileBuffer = req.file.buffer;
    const filename   = req.file.originalname;

    // ── Step 1: Compute SHA-256 hash of the PDF ───────────────────────────────
    logger.info(`Computing SHA-256 hash for: ${filename}`);
    const sha256Hash = computeSHA256(fileBuffer);
    logger.info(`Hash: ${sha256Hash}`);

    // ── Step 2: Upload PDF to IPFS ────────────────────────────────────────────
    logger.info(`Uploading to IPFS...`);
    const { cid, size, gatewayURL } = await uploadToIPFS(fileBuffer, filename);
    logger.info(`IPFS CID: ${cid}`);

    // ── Step 3: Store on blockchain ───────────────────────────────────────────
    logger.info(`Storing on blockchain...`);
    const blockchainResult = await fabricGateway.issueCertificate({
        certificateID,
        studentName,
        studentID,
        department,
        cgpa:           parseFloat(cgpa),
        graduationYear: parseInt(graduationYear),
        sha256Hash,     // hash of the PDF — tamper detection
        ipfsCID:        cid,    // IPFS address of the PDF
    });

    res.status(201).json({
        success: true,
        data: {
            ...blockchainResult,
            ipfs: {
                cid,
                size,
                gatewayURL,     // direct link to view the PDF
            },
            sha256Hash,         // hash stored on blockchain
            message: 'Certificate issued and PDF stored on IPFS',
        },
    });
}));

/**
 * GET /api/upload/certificate/:certificateID/download
 *
 * Retrieve the original PDF from IPFS and verify it
 * matches the hash stored on the blockchain.
 */
router.get('/certificate/:certificateID/download', asyncHandler(async (req, res) => {
    const { certificateID } = req.params;

    // ── Get certificate record from blockchain ────────────────────────────────
    const cert = await fabricGateway.getCertificate(certificateID);

    if (!cert) {
        throw new Error(`NOT_FOUND — certificate ${certificateID} does not exist`);
    }

    // ── Verify file integrity before sending ──────────────────────────────────
    logger.info(`Verifying integrity of ${certificateID} from IPFS...`);
    const integrity = await verifyFileIntegrity(cert.ipfsCID, cert.sha256Hash);

    if (!integrity.isAuthentic) {
        throw new Error(
            `TAMPERED — file on IPFS does not match blockchain record.\n` +
            `Expected: ${integrity.expectedHash}\n` +
            `Got:      ${integrity.actualHash}`
        );
    }

    // ── Retrieve PDF from IPFS ────────────────────────────────────────────────
    const fileBuffer = await getFromIPFS(cert.ipfsCID);

    // ── Send PDF as download ──────────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
        `attachment; filename="${certificateID}.pdf"`);
    res.setHeader('X-IPFS-CID',       cert.ipfsCID);
    res.setHeader('X-SHA256-Hash',     cert.sha256Hash);
    res.setHeader('X-Integrity-Check', 'PASSED');
    res.send(fileBuffer);
}));

/**
 * GET /api/upload/certificate/:certificateID/verify-file
 *
 * Verify a specific PDF file matches the blockchain record.
 * Useful for employers to verify a certificate PDF they received.
 */
router.post('/certificate/:certificateID/verify-file',
    upload.single('pdf'),
    asyncHandler(async (req, res) => {
        const { certificateID } = req.params;

        if (!req.file) {
            throw new Error('INVALID_INPUT — PDF file is required');
        }

        // Hash the uploaded file
        const uploadedHash = computeSHA256(req.file.buffer);

        // Verify against blockchain
        const result = await fabricGateway.verifyByHash(uploadedHash);

        res.json({
            success: true,
            data: {
                ...result,
                uploadedFileHash: uploadedHash,
                message: result.status === 'VALID'
                    ? 'PDF matches blockchain record — document is authentic'
                    : result.status === 'REVOKED'
                        ? 'PDF found but certificate is REVOKED'
                        : 'PDF does not match any blockchain record — may be forged',
            },
        });
    })
);

module.exports = router;