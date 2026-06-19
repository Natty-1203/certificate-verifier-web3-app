'use strict';

const crypto    = require('crypto');
const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { Op }     = require('sequelize');
const { User, Student } = require('../database');
const { verifyToken }   = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger     = require('../utils/logger');
const { sendEmail } = require('../utils/email');

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

// ── POST /api/auth/student-login ───────────────────────────────────────────────
// Students authenticate by matching name + email against the imported roster.
router.post('/student-login', asyncHandler(async (req, res) => {
    const { full_name, email } = req.body;

    if (!full_name || !email) {
        return res.status(400).json({
            message: 'Full name and email are required.'
        });
    }

    // Look up student in the roster by name + email (case-insensitive)
    const rosterEntry = await Student.findOne({
        where: {
            email:   { [Op.iLike]: email.trim() },
            full_name: { [Op.iLike]: full_name.trim() },
        },
    });

    if (!rosterEntry) {
        return res.status(401).json({
            message: 'No matching student record found. Check your name and email or contact the registrar.'
        });
    }

    // Find or auto-create a User record for this student
    let user = await User.findOne({ where: { student_id: rosterEntry.student_id } });

    if (!user) {
        const password_hash = await bcrypt.hash(crypto.randomUUID(), 12);
        user = await User.create({
            id:             `stu_${rosterEntry.student_id.replace(/[^a-zA-Z0-9]/g, '_')}`,
            username:       rosterEntry.email,
            password_hash,
            role:           'Student',
            institution_id: process.env.INSTITUTION_ID || 'AASTU',
            email:          rosterEntry.email,
            student_id:     rosterEntry.student_id,
        });
        logger.info(`Student account auto-created: ${rosterEntry.email} (${rosterEntry.student_id})`);
    }

    // Issue JWT
    const token = jwt.sign(
        {
            id:             user.id,
            username:       user.username,
            role:           user.role,
            institution_id: user.institution_id,
            student_id:     user.student_id || null,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    logger.info(`Student login: ${user.username} (${rosterEntry.student_id})`);

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

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', verifyToken, asyncHandler(async (req, res) => {
    // JWT is stateless — client deletes the token
    // Log the logout event
    logger.info(`Logout: ${req.user.username}`);

    res.status(200).json({ message: 'Logged out successfully.' });
}));

module.exports = router;