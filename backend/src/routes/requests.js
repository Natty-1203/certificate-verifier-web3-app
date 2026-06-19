'use strict';

const crypto     = require('crypto');
const { Router } = require('express');
const { Op }         = require('sequelize');
const { asyncHandler }   = require('../middleware/errorHandler');
const { verifyToken }    = require('../middleware/auth');
const { requireRole }    = require('../middleware/roles');
const { Request, RequestMessage, Certificate, Student } = require('../database');
const fabricGateway      = require('../fabric/gateway');
const { generateQRCode } = require('../utils/qrGenerator');
const { sendEmail, certificateIssuedEmail } = require('../utils/email');
const logger             = require('../utils/logger');

const router = Router();

// ── POST /api/requests ────────────────────────────────────────────────────────
// Student creates a new support request
router.post('/',
    verifyToken,
    requireRole('Student'),
    asyncHandler(async (req, res) => {
        const { certificate_id, subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ message: 'Subject and message are required.' });
        }

        const student_id = req.user.student_id || req.body.student_id;
        if (!student_id) {
            return res.status(400).json({ message: 'No student ID linked to your account.' });
        }

        // If certificate_id provided, check no active request exists for it
        if (certificate_id) {
            const activeRequest = await Request.findOne({
                where: {
                    certificate_id,
                    status: { [Op.in]: ['Pending', 'Approved'] },
                },
            });
            if (activeRequest) {
                return res.status(400).json({
                    message: 'A pending or approved request already exists for this certificate.'
                });
            }
        }

        const request = await Request.create({
            student_id,
            student_name: req.user.username,
            subject,
            certificate_id: certificate_id || null,
        });

        await RequestMessage.create({
            request_id: request.id,
            sender_id:  req.user.id,
            sender_name: req.user.username,
            sender_role: 'Student',
            message,
        });

        logger.info(`Request created: ${request.id} by ${req.user.username}`);

        res.status(201).json({
            message: 'Request created successfully.',
            request,
        });
    })
);

// ── GET /api/requests ─────────────────────────────────────────────────────────
// Students see own requests; Admin/Issuer see all
router.get('/',
    verifyToken,
    asyncHandler(async (req, res) => {
        const where = {};
        if (req.user.role === 'Student') {
            where.student_id = req.user.student_id;
        }

        const requests = await Request.findAll({
            where,
            order: [['created_at', 'DESC']],
        });

        res.status(200).json({ requests });
    })
);

// ── GET /api/requests/:id ─────────────────────────────────────────────────────
// Get request detail + all messages
router.get('/:id',
    verifyToken,
    asyncHandler(async (req, res) => {
        const request = await Request.findByPk(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        // Students can only see their own requests
        if (req.user.role === 'Student' && request.student_id !== req.user.student_id) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const messages = await RequestMessage.findAll({
            where: { request_id: request.id },
            order: [['created_at', 'ASC']],
        });

        res.status(200).json({ request, messages });
    })
);

// ── POST /api/requests/:id/messages ───────────────────────────────────────────
// Add a message to a request
router.post('/:id/messages',
    verifyToken,
    asyncHandler(async (req, res) => {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        const request = await Request.findByPk(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        if (req.user.role === 'Student' && request.student_id !== req.user.student_id) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        if (request.status === 'Resolved' || request.status === 'Rejected') {
            return res.status(400).json({ message: 'This request is closed.' });
        }

        const msg = await RequestMessage.create({
            request_id: request.id,
            sender_id:  req.user.id,
            sender_name: req.user.username,
            sender_role: req.user.role,
            message,
        });

        // If student replies to a non-Open request, set back to Open
        if (req.user.role === 'Student' && request.status !== 'Open') {
            await request.update({ status: 'Open' });
        }

        // If admin/issuer replies to an Open request, set to InReview
        if (req.user.role !== 'Student' && request.status === 'Open') {
            await request.update({ status: 'InReview' });
        }

        logger.info(`Message added to request ${request.id} by ${req.user.username}`);

        res.status(201).json({ message: 'Reply added.', msg });
    })
);

// ── PATCH /api/requests/:id/status ────────────────────────────────────────────
// Admin updates request status (Approve/Reject)
router.patch('/:id/status',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const { status } = req.body;
        const valid = ['Open', 'InReview', 'Approved', 'Rejected', 'Resolved'];
        if (!valid.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Valid: ${valid.join(', ')}` });
        }

        const request = await Request.findByPk(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        await request.update({ status });
        logger.info(`Request ${request.id} status → ${status} by ${req.user.username}`);

        res.status(200).json({ message: `Request status updated to ${status}.`, request });
    })
);

// ── PATCH /api/requests/:id/assign ────────────────────────────────────────────
// Admin assigns request to an issuer
router.patch('/:id/assign',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const { assigned_to } = req.body;
        if (!assigned_to) {
            return res.status(400).json({ message: 'Issuer user ID is required (assigned_to).' });
        }

        const request = await Request.findByPk(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        await request.update({ assigned_to });
        logger.info(`Request ${request.id} assigned to ${assigned_to} by ${req.user.username}`);

        res.status(200).json({ message: 'Request assigned.', request });
    })
);

// ── POST /api/requests/:id/reissue ────────────────────────────────────────────
// Issuer executes re-issuance (request must be Approved + assigned to this issuer)
router.post('/:id/reissue',
    verifyToken,
    requireRole('Issuer'),
    asyncHandler(async (req, res) => {
        const request = await Request.findByPk(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        if (request.status !== 'Approved') {
            return res.status(400).json({ message: 'Request must be Approved before re-issuing.' });
        }

        if (request.assigned_to !== req.user.id) {
            return res.status(403).json({ message: 'This request is not assigned to you.' });
        }

        // Check original certificate is revoked before re-issuing
        if (request.certificate_id) {
            const originalCert = await Certificate.findByPk(request.certificate_id);
            if (!originalCert || originalCert.status !== 'Revoked') {
                return res.status(400).json({
                    message: 'The original certificate must be revoked before re-issuance.'
                });
            }
        }

        // Look up original certificate data if a certificate_id is linked
        let studentName = request.student_name;
        let studentID   = request.student_id;
        let department  = 'Unknown';
        let cgpa        = 0;
        let gradYear    = '';
        let ipfsCID     = '';

        if (request.certificate_id) {
            const oldCert = await fabricGateway.getCertificate(request.certificate_id);
            if (oldCert) {
                studentName = oldCert.studentName || studentName;
                studentID   = oldCert.studentID   || studentID;
                department  = oldCert.department   || department;
                cgpa        = oldCert.cgpa         || cgpa;
                gradYear    = String(oldCert.graduationYear || '');
                ipfsCID     = oldCert.ipfsCID       || '';
            }
        }

        // Validate student still exists in university roster
        const rosterEntry = await Student.findByPk(studentID);
        if (!rosterEntry) {
            return res.status(400).json({
                message: `Student ID "${studentID}" is no longer in the university roster.`
            });
        }
        if (rosterEntry.full_name.toLowerCase() !== studentName.toLowerCase()) {
            return res.status(400).json({
                message: `Name "${studentName}" does not match university record "${rosterEntry.full_name}".`
            });
        }

        // Generate new certificate ID
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        const newCertId = request.certificate_id
            ? `${request.certificate_id}-R${suffix}`
            : `AASTU-${gradYear || new Date().getFullYear()}-${studentID.replace(/[^0-9]/g, '').slice(-4) || suffix}`;

        // Generate a unique hash (old hash cannot be reused — chaincode rejects duplicates)
        const sha256Hash = crypto.createHash('sha256').update(newCertId + crypto.randomUUID()).digest('hex');

        // Chaincode requires non-empty ipfsCID — reuse old IPFS address or placeholder
        const cid = ipfsCID || 'N/A';

        // Store on blockchain (no IPFS upload — old PDF already on IPFS)
        await fabricGateway.issueCertificate({
            certificateID:  newCertId,
            studentName,
            studentID,
            department,
            cgpa,
            graduationYear: parseInt(gradYear) || new Date().getFullYear(),
            sha256Hash,
            ipfsCID: cid,
        });

        // Save to PostgreSQL
        const { qrBase64 } = await generateQRCode(newCertId);
        await Certificate.create({
            certificate_id: newCertId,
            student_id:     studentID,
            full_name:      studentName,
            department,
            cgpa,
            graduation_year: String(gradYear),
            sha256_hash:    sha256Hash,
            ipfs_cid:       cid,
            issue_date:     new Date(),
            issuer_id:      req.user.id,
            status:         'Active',
            qr_code_data:   qrBase64,
            institution_id: req.user.institution_id || 'AASTU',
        });

        // Mark request resolved
        await request.update({ status: 'Resolved' });

        // Send email notification
        try {
            const { User } = require('../database');
            const studentUser = await User.findOne({ where: { student_id: studentID } });
            if (studentUser && studentUser.email) {
                const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${newCertId}`;
                sendEmail({
                    to: studentUser.email,
                    ...certificateIssuedEmail({
                        fullName: studentName,
                        certificateID: newCertId,
                        studentID,
                        department,
                        graduationYear: String(gradYear),
                        verificationURL,
                    }),
                });
            }
        } catch (_) { /* email failure does not block re-issuance */ }

        logger.info(`Certificate re-issued: ${newCertId} by ${req.user.username} (request ${request.id})`);

        res.status(201).json({
            message: 'Certificate re-issued successfully.',
            certificate_id: newCertId,
        });
    })
);

// ── GET /api/requests/issuer/pending ──────────────────────────────────────────
// Issuer: get requests assigned to them with status Approved
router.get('/issuer/pending',
    verifyToken,
    requireRole('Issuer'),
    asyncHandler(async (req, res) => {
        const requests = await Request.findAll({
            where: {
                assigned_to: req.user.id,
                status: 'Approved',
            },
            order: [['updated_at', 'DESC']],
        });
        res.status(200).json({ requests });
    })
);

module.exports = router;
