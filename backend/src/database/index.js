'use strict';

const sequelize       = require('./db');
const User            = require('./models/User');
const Certificate     = require('./models/Certificate');
const VerificationLog = require('./models/VerificationLog');
const Student         = require('./models/Student');
const Request          = require('./models/Request');
const RequestMessage   = require('./models/RequestMessage');
const bcrypt          = require('bcryptjs');
const logger          = require('../utils/logger');

// ── Sync all models to database ───────────────────────────────────────────────
async function initDatabase() {
    try {
        await sequelize.authenticate();
        logger.info('Database connection established');

        // alter: true → adds missing columns to existing tables without dropping data
        await sequelize.sync({ alter: true });
        logger.info('Database tables synchronized');

        // Seed default admin user if none exists
        await seedDefaultAdmin();

    } catch (error) {
        logger.error(`Database initialization failed: ${error.message}`);
        throw error;
    }
}

// ── Create default admin on first run ─────────────────────────────────────────
async function seedDefaultAdmin() {
    const count = await User.count();
    if (count === 0) {
        const hash = await bcrypt.hash('Admin@1234', 12);
        await User.create({
            id:             'usr_root_admin',
            username:       'admin',
            password_hash:  hash,
            role:           'Admin',
            institution_id: process.env.INSTITUTION_ID || 'AASTU',
            is_active:      true,
        });
        logger.info('Default admin created → username: admin / password: Admin@1234');
        logger.warn('CHANGE THE DEFAULT ADMIN PASSWORD IMMEDIATELY');
    }
}

module.exports = {
    sequelize,
    User,
    Certificate,
    VerificationLog,
    Student,
    Request,
    RequestMessage,
    initDatabase,
};