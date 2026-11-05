const { DataTypes } = require('sequelize');
const database = require('../config/database');
module.exports = database.define('Marca', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, { tableName: 'marcas', timestamps: false });
