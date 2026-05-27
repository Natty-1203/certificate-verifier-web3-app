'use strict';

const logger = require('../utils/logger');

/**
 * Map chaincode error messages to HTTP status codes.
 * The chaincode throws errors with these prefixes.
 */
const ERROR_MAP = {
    'ACCESS DENIED':    403,
    'NOT_FOUND':        404,
    'DUPLICATE':        409,
    'INVALID_INPUT':    400,
    'ALREADY_REVOKED':  409,
};

function getStatusCode(message) {
    for (const [key, code] of Object.entries(ERROR_MAP)) {
        if (message && message.includes(key)) return code;
    }
    return 500;
}

/**
 * Express error-handling middleware.
 * Must have exactly 4 parameters so Express recognizes it as an error handler.
 */
function errorHandler(err, req, res, next) {         // eslint-disable-line no-unused-vars
    const message    = err.message || 'Internal server error';
    const statusCode = getStatusCode(message);

    logger.error(`[${req.method}] ${req.path} → ${statusCode}: ${message}`);

    res.status(statusCode).json({
        success: false,
        error:   message,
        code:    statusCode,
        path:    req.path,
    });
}

/**
 * Wrap async route handlers so errors are forwarded to errorHandler.
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { errorHandler, asyncHandler };