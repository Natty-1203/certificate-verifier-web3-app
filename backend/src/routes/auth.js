'use strict';

const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { User }   = require('../database');
const { verifyToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger     = require('../utils/logger');

const router = Router();

const MAX_FAILED_ATTEMPTS = 5;

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