'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const User = sequelize.define('User', {
    id: {
        type:         DataTypes.STRING(50),
        primaryKey:   true,
        defaultValue: () => `usr_${Date.now()}`,
    },
    username: {
        type:      DataTypes.STRING(100),
        allowNull: false,
        unique:    true,
    },
    password_hash: {
        type:      DataTypes.STRING(255),
        allowNull: false,
    },
    role: {
        type:      DataTypes.ENUM('Admin', 'Issuer', 'Student'),
        allowNull: false,
    },
    institution_id: {
        type:         DataTypes.STRING(50),
        allowNull:    false,
        defaultValue: 'AASTU',
    },
    is_active: {
        type:         DataTypes.BOOLEAN,
        defaultValue: true,
    },
    failed_attempts: {
        type:         DataTypes.INTEGER,
        defaultValue: 0,
    },
    last_login: {
        type:      DataTypes.DATE,
        allowNull: true,
    },
    email: {
        type:      DataTypes.STRING(255),
        allowNull: true,
    },
    student_id: {
        type:      DataTypes.STRING(50),
        allowNull: true,
    },
    created_by: {
        type:      DataTypes.STRING(50),
        allowNull: true,
    },
}, {
    tableName:  'users',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',
});

module.exports = User;