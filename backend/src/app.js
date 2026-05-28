'use strict';

require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
});

const express    = require('express');
const cors       = require('cors');
const logger     = require('./utils/logger');
const { errorHandler }  = require('./middleware/errorHandler');
const { initDatabase }  = require('./database');

// Routes
const authRoutes         = require('./routes/auth');
const certificateRoutes  = require('./routes/certificate');
const uploadRoutes       = require('./routes/upload');
const recoveryRoutes     = require('./routes/recovery');
const usersRoutes        = require('./routes/users');
const dashboardRoutes    = require('./routes/dashboard');
const auditLogsRoutes    = require('./routes/auditLogs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.debug(`→ ${req.method} ${req.path}`);
    next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status:    'ok',
        service:   'SecureCert Backend',
        timestamp: new Date().toISOString(),
    });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/certificates',   certificateRoutes);
app.use('/api/upload',         uploadRoutes);
app.use('/api/recovery',       recoveryRoutes);
app.use('/api/users',          usersRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/audit-logs',     auditLogsRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found.' });
});

// ── Central error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
async function start() {
    try {
        // Initialize database first
        await initDatabase();

        app.listen(PORT, () => {
            logger.info(`SecureCert backend running → http://localhost:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (err) {
        logger.error(`Failed to start server: ${err.message}`);
        process.exit(1);
    }
}

start();

module.exports = app;