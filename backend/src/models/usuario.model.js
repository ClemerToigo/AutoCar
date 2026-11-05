const { DataTypes } = require('sequelize');
const database = require('../config/database');

const Usuario = database.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(255), allowNull: false },
  login: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  cpf: { type: DataTypes.STRING(11), allowNull: true, unique: true },
  telefone: { type: DataTypes.STRING(11), allowNull: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  versao_sessao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'USUARIO' },
}, {
  tableName: 'usuarios',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Usuario;
