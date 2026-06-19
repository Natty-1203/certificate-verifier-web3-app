'use strict';

const { Router } = require('express');
const multer     = require('multer');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { sendEmail, certificateIssuedEmail } = require('../utils/email');
const { Student, Certificate } = require('../database');
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
router.post('/certificate',
    verifyToken,
    requireRole('Issuer'),
    upload.single('pdf'),
    asyncHandler(async (req, res) => {
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
        email,
    } = req.body;

    if (!certificateID || !studentName || !studentID
        || !department || !cgpa || !graduationYear) {
        throw new Error('INVALID_INPUT — all metadata fields are required');
    }

    // Validate student exists in university roster
    const rosterEntry = await Student.findByPk(studentID);
    if (!rosterEntry) {
        throw new Error(
            `VALIDATION_ERROR — Student ID "${studentID}" not found in university roster. ` +
            `Import student data first or verify the ID is correct.`
        );
    }
    if (rosterEntry.full_name.toLowerCase() !== studentName.toLowerCase()) {
        throw new Error(
            `VALIDATION_ERROR — Name "${studentName}" does not match university ` +
            `record "${rosterEntry.full_name}" for student ID ${studentID}.`
        );
    }

    // Validate CGPA range (must match chaincode constraint)
    const cgpaNum = parseFloat(cgpa);
    if (isNaN(cgpaNum) || cgpaNum < 0.0 || cgpaNum > 4.0) {
        throw new Error('INVALID_INPUT — CGPA must be a number between 0.0 and 4.0');
    }

    // Check certificate_id doesn't already exist
    const existing = await Certificate.findByPk(certificateID);
    if (existing) {
        throw new Error(
            `DUPLICATE — Certificate ID "${certificateID}" already exists. Submit a re-issuance request instead.`
        );
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
        cgpa:           cgpaNum,
        graduationYear: parseInt(graduationYear),
        sha256Hash,     // hash of the PDF — tamper detection
        ipfsCID:        cid,    // IPFS address of the PDF
    });

    // ── Step 4: Send email notification if email provided or student registered ──
    try {
        let recipientEmail = null;
        if (email) {
            recipientEmail = email;
        } else {
            const { User } = require('../database');
            const studentUser = await User.findOne({ where: { student_id: studentID } });
            if (studentUser && studentUser.email) {
                recipientEmail = studentUser.email;
            }
        }
        if (recipientEmail) {
            const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certificateID}`;
            sendEmail({
                to: recipientEmail,
                ...certificateIssuedEmail({
                    fullName: studentName,
                    certificateID,
                    studentID,
                    department,
                    graduationYear: String(graduationYear),
                    verificationURL,
                }),
            });
        }
    } catch (_) { /* email failure does not block issuance */ }

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