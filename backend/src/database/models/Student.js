'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../db');

const Student = sequelize.define('Student', {
    student_id: {
        type:         DataTypes.STRING(50),
        primaryKey:   true,
    },
    full_name: {
        type:      DataTypes.STRING(200),
        allowNull: false,
    },
    email: {
        type:      DataTypes.STRING(255),
        allowNull: false,
    },
    department: {
        type:      DataTypes.STRING(100),
        allowNull: false,
    },
    graduation_year: {
        type:      DataTypes.STRING(4),
        allowNull: false,
    },
    is_active: {
        type:         DataTypes.BOOLEAN,
        defaultValue: true,
    },
    imported_by: {
        type:      DataTypes.STRING(50),
        allowNull: true,
    },
}, {
    tableName:  'students',
    timestamps: true,
    createdAt:  'created_at',
    updatedAt:  'updated_at',
});

module.exports = Student;
