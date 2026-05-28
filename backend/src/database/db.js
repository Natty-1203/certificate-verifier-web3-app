'use strict';

const { Sequelize } = require('sequelize');
require('dotenv').config({
    path: require('path').resolve(__dirname, '../../.env')
});

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host:    process.env.DB_HOST,
        port:    process.env.DB_PORT,
        dialect: 'postgres',
        logging: false,      // set to console.log to debug queries
        pool: {
            max:     5,
            min:     0,
            acquire: 30000,
            idle:    10000,
        },
    }
);

module.exports = sequelize;