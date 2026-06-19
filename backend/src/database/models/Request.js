'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const Request = sequelize.define('Request', {
    id: {
        type:         DataTypes.STRING(50),
        primaryKey:   true,
        defaultValue: () => `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
    certificate_id: {
        type:      DataTypes.STRING(100),
        allowNull: true,
    },
    student_id: {
        type:      DataTypes.STRING(50),
        allowNull: false,
    },
    student_name: {
        type:      DataTypes.STRING(200),
        allowNull: false,
    },
    subject: {
        type:      DataTypes.STRING(300),
        allowNull: false,
    },
    status: {
        type:      DataTypes.ENUM('Open', 'InReview', 'Approved', 'Rejected', 'Resolved'),
        defaultValue: 'Open',
    },
    assigned_to: {
        type:      DataTypes.STRING(50),
        allowNull: true,
    },
}, {
    tableName:  'requests',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',
});

module.exports = Request;
