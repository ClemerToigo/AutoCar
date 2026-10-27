require('./env');
const { Sequelize } = require('sequelize');

const options = { dialect: 'postgres', logging: false, pool: { max: 5, min: 0 } };
const database = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, options)
  : new Sequelize(process.env.DB_NAME || 'autocar', process.env.DB_USER || 'postgres', process.env.DB_PASSWORD || '', {
      ...options,
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
    });

module.exports = database;
