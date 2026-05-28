'use strict';

const { Router } = require('express');
const bcrypt     = require('bcryptjs');
const { User }   = require('../database');
const { verifyToken }  = require('../middleware/auth');
const { requireRole }  = require('../middleware/roles');
const { asyncHandler } = require('../middleware/errorHandler');
const logger     = require('../utils/logger');

const router = Router();

const formatUser = (u) => ({
    id:             u.id,
    username:       u.username,
    role:           u.role,
    institution_id: u.institution_id,
    is_active:      u.is_active,
    failed_attempts: u.failed_attempts,
});

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (_req, res) => {
        const users = await User.findAll({
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'DESC']],
        });
        res.json(users.map(formatUser));
    })
);

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const { username, role, institutionId, password } = req.body;

        if (!username || !role) {
            return res.status(400).json({
                message: 'username and role are required.'
            });
        }

        if (!['Admin', 'Issuer', 'Student'].includes(role)) {
            return res.status(400).json({
                message: 'role must be Admin, Issuer, or Student.'
            });
        }

        const exists = await User.findOne({ where: { username } });
        if (exists) {
            return res.status(409).json({
                message: `Username "${username}" already exists.`
            });
        }

        // Use provided password or generate default
        const rawPassword   = password || `${username}@AASTU2024`;
        const password_hash = await bcrypt.hash(rawPassword, 12);
        const id            = `usr_${Date.now()}`;

        const user = await User.create({
            id,
            username,
            password_hash,
            role,
            institution_id: institutionId || process.env.INSTITUTION_ID || 'AASTU',
            is_active:      true,
            created_by:     req.user.id,
        });

        logger.info(`User created: ${username} (${role}) by ${req.user.username}`);

        res.status(201).json({
            ...formatUser(user),
            temporary_password: rawPassword,    // shown once — user should change it
        });
    })
);

// ── PATCH /api/users/:userId/deactivate ───────────────────────────────────────
router.patch('/:userId/deactivate',
    verifyToken,
    requireRole('Admin'),
    asyncHandler(async (req, res) => {
        const user = await User.findByPk(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Toggle active status
        await user.update({ is_active: !user.is_active });

        logger.info(`User ${user.username} ${user.is_active ? 'activated' : 'deactivated'} by ${req.user.username}`);

        // Return updated full list (as frontend expects)
        const allUsers = await User.findAll({
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'DESC']],
        });

        res.json(allUsers.map(formatUser));
    })
);

module.exports = router;