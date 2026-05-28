'use strict';

const QRCode = require('qrcode');

/**
 * Generate a QR code as base64 PNG string.
 * Encodes the public verification URL for the certificate.
 */
async function generateQRCode(certificateID) {
    const verificationURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify/${certificateID}`;

    const qrBase64 = await QRCode.toDataURL(verificationURL, {
        errorCorrectionLevel: 'H',
        width: 300,
        margin: 2,
        color: {
            dark:  '#000000',
            light: '#FFFFFF',
        },
    });

    return { qrBase64, verificationURL };
}

module.exports = { generateQRCode };