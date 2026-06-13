'use strict';

const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { Op }     = require('sequelize');
const { User }   = require('../database');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger     = require('../utils/logger');
const { sendEmail, registrationConfirmationEmail } = require('../utils/email');

const router = Router();

const MAX_FAILED_ATTEMPTS = 20;

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'Username and password are required.'
        });
    }

    // Find user
    const user = await User.findOne({ where: { username } });

    if (!user) {
        return res.status(401).json({
            message: 'Incorrect credentials entered. Please try again.'
        });
    }

    // Check if account is locked
    if (user.failed_attempts >= MAX_FAILED_ATTEMPTS) {
        return res.status(403).json({
            message: 'Account locked after 5 consecutive failed login attempts. Contact administrator.'
        });
    }

    // Check if account is active
    if (!user.is_active) {
        return res.status(403).json({
            message: 'Account has been deactivated. Contact administrator.'
        });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        // Increment failed attempts
        await user.increment('failed_attempts');

        const remaining = MAX_FAILED_ATTEMPTS - (user.failed_attempts + 1);
        logger.warn(`Failed login for: ${username}. Remaining attempts: ${remaining}`);

        return res.status(401).json({
            message: 'Incorrect credentials entered. Please try again.'
        });
    }

    // Reset failed attempts on success
    await user.update({
        failed_attempts: 0,
        last_login:      new Date(),
    });

    // Sign JWT with role claims — frontend reads these
    const token = jwt.sign(
        {
            id:             user.id,
            username:       user.username,
            role:           user.role,
            institution_id: user.institution_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info(`Login successful: ${username} (${user.role})`);

    res.status(200).json({
        message: 'Login successful',
        token,
        user: {
            id:             user.id,
            username:       user.username,
            role:           user.role,
            institution_id: user.institution_id,
            is_active:      user.is_active,
            email:          user.email || null,
            student_id:     user.student_id || null,
        },
    });
}));

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post('/change-password',
    verifyToken,
    asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: 'Current password and new password are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: 'New password must be at least 6 characters long.'
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        const password_hash = await bcrypt.hash(newPassword, 12);
        await user.update({ password_hash, failed_attempts: 0 });

        logger.info(`Password changed for user: ${user.username}`);

        res.status(200).json({ message: 'Password changed successfully.' });
    })
);

// ── POST /api/auth/register ────────────────────────────────────────────────────
router.post('/register', asyncHandler(async (req, res) => {
    const { username, password, email, student_id, full_name } = req.body;

    if (!username || !password || !email || !student_id) {
        return res.status(400).json({
            message: 'Username, password, email, and student ID are required.'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: 'Password must be at least 6 characters.'
        });
    }

    // Check for existing username
    const existingUser = await User.findOne({
        where: { [Op.or]: [{ username }, { email }] }
    });
    if (existingUser) {
        return res.status(409).json({
            message: 'A user with this username or email already exists.'
        });
    }

    // Verify student_id matches a certificate in the database
    const { Certificate } = require('../database');
    const cert = await Certificate.findOne({ where: { student_id } });
    if (!cert) {
        return res.status(400).json({
            message: 'No certificate records found for this student ID. Contact the registrar.'
        });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
        username,
        password_hash,
        role: 'Student',
        institution_id: process.env.INSTITUTION_ID || 'AASTU',
        email,
        student_id,
    });

    logger.info(`Student self-registered: ${username} (${student_id})`);

    // Send confirmation email
    sendEmail(registrationConfirmationEmail({ username, studentID: student_id, fullName: full_name || username }));

    res.status(201).json({
        message: 'Account created successfully. You can now log in.',
    });
}));

// ── POST /api/auth/link-student-id ─────────────────────────────────────────────
router.patch('/link-student-id',
    verifyToken,
    asyncHandler(async (req, res) => {
        const { student_id } = req.body;
        if (!student_id) {
            return res.status(400).json({ message: 'Student ID is required.' });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await user.update({ student_id });
        logger.info(`Student ID linked: ${user.username} -> ${student_id}`);

        res.json({ message: 'Student ID linked successfully.', student_id });
    })
);

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
    // JWT is stateless — client deletes the token
    // Log the logout event
    logger.info(`Logout: ${req.user.username}`);

    res.status(200).json({ message: 'Logged out successfully.' });
}));

module.exports = router;