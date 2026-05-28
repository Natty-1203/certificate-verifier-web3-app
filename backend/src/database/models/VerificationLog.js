'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const VerificationLog = sequelize.define('VerificationLog', {
    log_id: {
        type:          DataTypes.INTEGER,
        primaryKey:    true,
        autoIncrement: true,
    },
    certificate_id: {
        type:      DataTypes.STRING(100),
        allowNull: true,
    },
    verification_method: {
        type:      DataTypes.ENUM('CertificateID', 'QRCode', 'PDFUpload', 'Hash'),
        allowNull: false,
    },
    result: {
        type:      DataTypes.ENUM('Valid', 'Invalid', 'Revoked', 'NotFound'),
        allowNull: false,
    },
    actor: {
        type:      DataTypes.STRING(100),
        allowNull: true,
    },
    verifier_ip: {
        type:      DataTypes.STRING(45),
        allowNull: true,
    },
    blockchain_tx_id: {
        type:      DataTypes.STRING(255),
        allowNull: true,
    },
    details: {
        type:      DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName:  'verification_logs',
    timestamps: true,
    createdAt:  'timestamp',
    updatedAt:  false,
});

module.exports = VerificationLog;