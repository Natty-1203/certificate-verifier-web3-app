'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const RequestMessage = sequelize.define('RequestMessage', {
    id: {
        type:         DataTypes.STRING(50),
        primaryKey:   true,
        defaultValue: () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    },
    request_id: {
        type:      DataTypes.STRING(50),
        allowNull: false,
        references: { model: 'requests', key: 'id' },
    },
    sender_id: {
        type:      DataTypes.STRING(50),
        allowNull: false,
    },
    sender_name: {
        type:      DataTypes.STRING(200),
        allowNull: false,
    },
    sender_role: {
        type:      DataTypes.STRING(20),
        allowNull: false,
    },
    message: {
        type:      DataTypes.TEXT,
        allowNull: false,
    },
}, {
    tableName:  'request_messages',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  false,
});

module.exports = RequestMessage;
