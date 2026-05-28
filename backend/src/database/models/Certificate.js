'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const Certificate = sequelize.define('Certificate', {
    certificate_id: {
        type:      DataTypes.STRING(100),
        primaryKey: true,
    },
    student_id: {
        type:      DataTypes.STRING(50),
        allowNull: false,
    },
    full_name: {
        type:      DataTypes.STRING(255),
        allowNull: false,
    },
    department: {
        type:      DataTypes.STRING(100),
        allowNull: false,
    },
    cgpa: {
        type:      DataTypes.DECIMAL(3, 2),
        allowNull: false,
    },
    graduation_year: {
        type:      DataTypes.STRING(4),
        allowNull: false,
    },
    sha256_hash: {
        type:      DataTypes.STRING(64),
        allowNull: false,
        unique:    true,
    },
    ipfs_cid: {
        type:      DataTypes.STRING(100),
        allowNull: true,
    },
    issue_date: {
        type:         DataTypes.DATE,
        allowNull:    false,
        defaultValue: DataTypes.NOW,
    },
    issuer_id: {
        type:      DataTypes.STRING(50),
        allowNull: true,
    },
    status: {
        type:         DataTypes.ENUM('Active', 'Revoked'),
        allowNull:    false,
        defaultValue: 'Active',
    },
    revocation_date: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
    revocation_reason: {
        type:      DataTypes.TEXT,
        allowNull: true,
    },
    qr_code_data: {
        type:      DataTypes.TEXT,   // base64 PNG
        allowNull: true,
    },
    institution_id: {
        type:         DataTypes.STRING(50),
        defaultValue: 'AASTU',
    },
}, {
    tableName:  'certificates',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',
});

module.exports = Certificate;