const { DataTypes } = require('sequelize');
const database = require('../config/database');
module.exports = database.define('Servico', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  descricao: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  preco: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'servicos', underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });
