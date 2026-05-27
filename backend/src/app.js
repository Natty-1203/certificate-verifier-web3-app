'use strict';

require('dotenv').config();

const express    = require('express');
const logger     = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const certificateRoutes = require('./routes/certificate');
const uploadRoutes      = require('./routes/upload');
const recoveryRoutes = require('./routes/recovery');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.debug(`→ ${req.method} ${req.path}`);
    next();
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status:    'ok',
        service:   'certificate-backend',
        timestamp: new Date().toISOString(),
    });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/certificates', certificateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/recovery', recoveryRoutes);

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Central error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    logger.info(`Certificate backend running on http://localhost:${PORT}`);
    logger.info(`Channel: ${process.env.FABRIC_CHANNEL}`);
    logger.info(`Chaincode: ${process.env.FABRIC_CHAINCODE}`);
});

module.exports = app;