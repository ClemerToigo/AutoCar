const { DataTypes } = require('sequelize');
const database = require('../config/database');
module.exports = database.define('Categoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
}, { tableName: 'categorias', timestamps: false });
