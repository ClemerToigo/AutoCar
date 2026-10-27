const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Usuario = database.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(255), allowNull: false },
  login: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'USUARIO' },
}, {
  tableName: 'usuarios',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Usuario;
