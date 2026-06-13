'use strict';

const { Router } = require('express');
const multer     = require('multer');
const { parse }  = require('csv-parse/sync');
const { asyncHandler }      = require('../middleware/errorHandler');
const { verifyToken }       = require('../middleware/auth');
const { requireRole }       = require('../middleware/roles');
const fabricGateway         = require('../fabric/gateway');
const { uploadToIPFS, computeSHA256 } = require('../utils/ipfs');
const { generateQRCode }    = require('../utils/qrGenerator');
const { Certificate, VerificationLog } = require('../database');
const { sendEmail, certificateIssuedEmail } = require('../utils/email');
const { Op }                = require('sequelize');
const logger                = require('../utils/logger');

const router = Router();

// Multer — PDF only, 10MB max
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Academic certificate PDF must be attached to compute cryptographic hashes.'));
        }
    },
});

// ── Helper: format certificate for frontend ───────────────────────────────────
function formatCertificate(cert) {
    return {
        id:              cert.certificate_id || cert.certificateID,
        studentId:       cert.student_id     || cert.studentID,
        studentName:     cert.full_name      || cert.studentName,
        department:      cert.department,
        cgpa:            parseFloat(cert.cgpa),
        graduationYear:  String(cert.graduation_year || cert.graduationYear),
        issueDate:       cert.issue_date     || cert.issuedAt,
        ipfsAddress:     cert.ipfs_cid       || cert.ipfsCID,
        hash:            cert.sha256_hash    || cert.sha256Hash,
        status:          cert.status         || (cert.isRevoked ? 'Revoked' : 'Active'),
        revocationDate:  cert.revocation_date   || cert.revokedAt   || null,
        revocationReason: cert.revocation_reason || cert.revocationReason || null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/certificates/batch-issue
// Auth: Issuer or Admin
// Accepts a CSV file with columns: student_id, full_name, department, cgpa, graduation_year
// ─────────────────────────────────────────────────────────────────────────────
router.post('/batch-issue',
    verifyToken,
    requireRole(['Admin', 'Issuer']),
    upload.single('csv'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ message: 'CSV file is required.' });
        }

        const csvText = req.file.buffer.toString('utf-8');
        let records;
        try {
            records = parse(csvText, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
        } catch (err) {
            return res.status(400).json({ message: 'Invalid CSV format: ' + err.message });
        }

        if (records.length === 0) {
            return res.status(400).json({ message: 'CSV file is empty.' });
        }

        const results = { success: [], errors: [] };

        for (let i = 0; i < records.length; i++) {
            const row = records[i];
            const rowNum = i + 2; // +2 for header row + 1-indexed

            try {
                const student_id = row.student_id || row.studentId || '';
                const full_name = row.full_name || row.fullName || row.student_name || row.studentName || '';
                const department = row.department || '';
                const cgpa = parseFloat(row.cgpa || row.CGPA || '0');
                const graduation_year = row.graduation_year || row.graduationYear || '';

                if (!student_id || !full_name || !department || !cgpa || !graduation_year) {
                    results.errors.push({ row: rowNum, message: 'Missing required fields', data: row });
                    continue;
                }

                if (isNaN(cgpa) || cgpa < 2.0 || cgpa > 4.0) {
                    results.errors.push({ row: rowNum, message: 'Invalid CGPA (must be 2.0-4.0)', data: row });
                    continue;
                }

                const certificateId = `AASTU-${graduation_year}-${student_id.replace(/[^0-9]/g, '').slice(-4) || String(i + 1).padStart(4, '0')}`;
                const dummyBuffer = Buffer.from(`AASTU Certificate: ${certificateId}\nStudent: ${full_name}\nStudent ID: ${student_id}\nDepartment: ${department}\nCGPA: ${cgpa}\nYear: ${graduation_year}`);
                const sha256Hash = computeSHA256(dummyBuffer);
                const { cid } = await uploadToIPFS(dummyBuffer, `${certificateId}.txt`);

                await fabricGateway.issueCertificate({
                    certificateID: certificateId,
                    studentName: full_name,
                    studentID: student_id,
                    department,
                    cgpa,
                    graduationYear: parseInt(graduation_year),
                    sha256Hash,
                    ipfsCID: cid,
                });

                const { qrBase64 } = await generateQRCode(certificateId);
                await Certificate.create({
                    certificate_id: certificateId,
                    student_id,
                    full_name,
                    department,
                    cgpa,
                    graduation_year: String(graduation_year),
                    sha256_hash: sha256Hash,
                    ipfs_cid: cid,
                    issue_date: new Date(),
                    issuer_id: req.user.id,
                    status: 'Active',
                    qr_code_data: qrBase64,
                    institution_id: req.user.institution_id,
                });

                await VerificationLog.create({
                    certificate_id: certificateId,
                    verification_method: 'CertificateID',
                    result: 'Valid',
                    actor: req.user.username,
                    details: `Certificate batch-issued by ${req.user.username}`,
                });

                // Send email notification if student has registered with email
                const { User } = require('../database');
                const studentUser = await User.findOne({ where: { student_id } });
                if (studentUser && studentUser.email) {
                    const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certificateId}`;
                    sendEmail(certificateIssuedEmail({
                        fullName: full_name,
                        certificateID: certificateId,
                        studentID: student_id,
                        department,
                        graduationYear: graduation_year,
                        verificationURL,
                    }));
                }

                results.success.push({ row: rowNum, certificate_id: certificateId, student_id, full_name });
                logger.info(`Batch-issued: ${certificateId} for ${full_name}`);
            } catch (err) {
                results.errors.push({ row: rowNum, message: err.message, data: row });
                logger.error(`Batch row ${rowNum} failed: ${err.message}`);
            }
        }

        const statusCode = results.errors.length === 0 ? 201 : results.success.length > 0 ? 207 : 400;
        res.status(statusCode).json({
            message: `Issued ${results.success.length} of ${records.length} certificates.`,
            results,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/certificates/issue
// Auth: Issuer or Admin
// ─────────────────────────────────────────────────────────────────────────────
router.post('/issue',
    verifyToken,
    requireRole(['Admin', 'Issuer']),
    upload.single('file'),
    asyncHandler(async (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                message: 'Academic certificate PDF must be attached to compute cryptographic hashes.'
            });
        }

        const {
            student_id,
            full_name,
            department,
            cgpa,
            graduation_year,
            certificate_id,
        } = req.body;

        if (!student_id || !full_name || !department || !cgpa || !graduation_year || !certificate_id) {
            return res.status(400).json({
                message: 'All fields are required: student_id, full_name, department, cgpa, graduation_year, certificate_id'
            });
        }

        const fileBuffer = req.file.buffer;

        // Step 1 — Compute SHA-256 hash
        const sha256Hash = computeSHA256(fileBuffer);

        // Step 2 — Upload to IPFS
        const { cid } = await uploadToIPFS(fileBuffer, `${certificate_id}.pdf`);

        // Step 3 — Store on blockchain
        const blockchainResult = await fabricGateway.issueCertificate({
            certificateID:  certificate_id,
            studentName:    full_name,
            studentID:      student_id,
            department,
            cgpa:           parseFloat(cgpa),
            graduationYear: parseInt(graduation_year),
            sha256Hash,
            ipfsCID:        cid,
        });

        // Step 4 — Generate QR code
        const { qrBase64 } = await generateQRCode(certificate_id);

        // Step 5 — Save metadata to database
        const issueDate = new Date();
        await Certificate.create({
            certificate_id,
            student_id,
            full_name,
            department,
            cgpa:           parseFloat(cgpa),
            graduation_year: String(graduation_year),
            sha256_hash:    sha256Hash,
            ipfs_cid:       cid,
            issue_date:     issueDate,
            issuer_id:      req.user.id,
            status:         'Active',
            qr_code_data:   qrBase64,
            institution_id: req.user.institution_id,
        });

        // Step 6 — Log to audit table
        await VerificationLog.create({
            certificate_id,
            verification_method: 'CertificateID',
            result:              'Valid',
            actor:               req.user.username,
            details:             `Certificate issued by ${req.user.username}`,
        });

        // Step 7 — Send email notification if student registered
        try {
            const { User } = require('../database');
            const studentUser = await User.findOne({ where: { student_id } });
            if (studentUser && studentUser.email) {
                const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certificate_id}`;
                sendEmail(certificateIssuedEmail({
                    fullName: full_name,
                    certificateID: certificate_id,
                    studentID: student_id,
                    department,
                    graduationYear: graduation_year,
                    verificationURL,
                }));
            }
        } catch (_) { /* email failure does not block issuance */ }

        logger.info(`Certificate issued: ${certificate_id} by ${req.user.username}`);

        res.status(201).json({
            id:           certificate_id,
            issue_date:   issueDate.toISOString(),
            ipfsAddress:  cid,
            hash:         sha256Hash,
            certificateDetails: {
                id:              certificate_id,
                studentId:       student_id,
                studentName:     full_name,
                department,
                cgpa:            parseFloat(cgpa),
                graduationYear:  String(graduation_year),
                issueDate:       issueDate.toISOString(),
                ipfsAddress:     cid,
                hash:            sha256Hash,
            },
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/certificates/verify/:id
// Public — accepts certificate ID, student ID, or SHA-256 hash
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verify/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    let blockchainResult = null;
    let method           = 'CertificateID';

    // Detect type of :id
    if (/^[a-f0-9]{64}$/i.test(id)) {
        // SHA-256 hash
        method          = 'Hash';
        blockchainResult = await fabricGateway.verifyByHash(id);
    } else {
        // Try as certificate ID first, then student ID
        blockchainResult = await fabricGateway.verifyCertificate(id);

        if (!blockchainResult.exists) {
            // Try as student ID via database
            const dbCert = await Certificate.findOne({
                where: { student_id: id }
            });

            if (dbCert) {
                blockchainResult = await fabricGateway.verifyCertificate(
                    dbCert.certificate_id
                );
                method = 'CertificateID';
            }
        }
    }

    // Log verification attempt
    await VerificationLog.create({
        certificate_id:      blockchainResult?.certificate?.certificateID || id,
        verification_method: method,
        result:              blockchainResult.exists
            ? (blockchainResult.isRevoked ? 'Revoked' : 'Valid')
            : 'NotFound',
        verifier_ip:         req.ip,
        details:             `Public verification attempt via ${method}`,
    }).catch(() => {}); // don't fail if logging fails

    // Not found
    if (!blockchainResult.exists) {
        return res.status(404).json({
            message: 'No certificate matching that ID was found on the blockchain records.'
        });
    }

    const cert = blockchainResult.certificate;

    // Revoked
    if (blockchainResult.isRevoked) {
        return res.status(200).json({
            status:           'Revoked',
            revocationDate:   cert.revokedAt,
            revocationReason: cert.revocationReason,
            certificateDetails: formatCertificate(cert),
        });
    }

    // Valid
    return res.status(200).json({
        status: 'Valid',
        certificateDetails: formatCertificate(cert),
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/certificates/revoke
// Auth: Admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post('/revoke',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const { certificateId, reason } = req.body;

        if (!certificateId || !reason) {
            return res.status(400).json({
                message: 'certificateId and reason parameters are required.'
            });
        }

        // Revoke on blockchain
        await fabricGateway.revokeCertificate(certificateId, reason);

        // Update database
        const cert = await Certificate.findByPk(certificateId);
        if (!cert) {
            return res.status(404).json({
                message: `Certificate with ID ${certificateId} was not found.`
            });
        }

        await cert.update({
            status:            'Revoked',
            revocation_date:   new Date(),
            revocation_reason: reason,
        });

        // Log to audit
        await VerificationLog.create({
            certificate_id:      certificateId,
            verification_method: 'CertificateID',
            result:              'Revoked',
            actor:               req.user.username,
            details:             `Revoked by ${req.user.username}. Reason: ${reason}`,
        });

        logger.warn(`Certificate revoked: ${certificateId} by ${req.user.username}`);

        res.status(200).json({
            success: true,
            message: 'Academic degree certificate successfully disabled.',
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/certificates/search
// Auth: Admin or Issuer
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search',
    verifyToken,
    requireRole(['Admin', 'Issuer']),
    asyncHandler(async (req, res) => {
        const {
            full_name_query,
            student_id_query,
            department,
            graduation_year,
            status,
            page  = 1,
            limit = 20,
        } = req.query;

        const where = {};

        if (full_name_query) {
            where.full_name = { [Op.iLike]: `%${full_name_query}%` };
        }
        if (student_id_query) {
            where.student_id = { [Op.iLike]: `%${student_id_query}%` };
        }
        if (department && department !== 'All') {
            where.department = department;
        }
        if (graduation_year) {
            where.graduation_year = graduation_year;
        }
        if (status && status !== 'All') {
            where.status = status;
        }

        const { rows, count } = await Certificate.findAndCountAll({
            where,
            order:  [['issue_date', 'DESC']],
            limit:  parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
        });

        res.status(200).json(
            rows.map(cert => ({
                certificate_id:  cert.certificate_id,
                student_id:      cert.student_id,
                full_name:       cert.full_name,
                department:      cert.department,
                cgpa:            parseFloat(cert.cgpa),
                graduation_year: cert.graduation_year,
                issue_date:      cert.issue_date,
                status:          cert.status,
                ipfs_cid:        cert.ipfs_cid,
                sha256_hash:     cert.sha256_hash,
            }))
        );
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/certificates/:id/qr
// Public — QR codes are public by nature
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/qr',
    asyncHandler(async (req, res) => {
        const cert = await Certificate.findByPk(req.params.id);

        if (!cert) {
            return res.status(404).json({ message: 'Certificate not found.' });
        }

        // Regenerate if missing
        if (!cert.qr_code_data) {
            const { qrBase64 } = await generateQRCode(cert.certificate_id);
            await cert.update({ qr_code_data: qrBase64 });
            cert.qr_code_data = qrBase64;
        }

        // Return as PNG
        const base64Data = cert.qr_code_data.replace(/^data:image\/png;base64,/, '');
        const imgBuffer  = Buffer.from(base64Data, 'base64');

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}-qr.png"`);
        res.send(imgBuffer);
    })
);

module.exports = router;