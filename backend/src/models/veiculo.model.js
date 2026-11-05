const { DataTypes } = require('sequelize');
const database = require('../config/database');
const Marca = require('./marca.model');
const Categoria = require('./categoria.model');
const Veiculo = database.define('Veiculo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  marca_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Marca, key: 'id' } },
  categoria_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Categoria, key: 'id' } },
  modelo: { type: DataTypes.STRING(120), allowNull: false },
  ano: { type: DataTypes.INTEGER, allowNull: false },
  quilometragem: { type: DataTypes.INTEGER, allowNull: false },
  preco: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  combustivel: { type: DataTypes.STRING(20), allowNull: false },
  cambio: { type: DataTypes.STRING(20), allowNull: false },
  cor: { type: DataTypes.STRING(80), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DISPONIVEL' },
  descricao: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  foto: { type: DataTypes.STRING(255), allowNull: true },
  galeria: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'veiculos', underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });
Veiculo.belongsTo(Marca, { as: 'marca', foreignKey: 'marca_id', onDelete: 'RESTRICT' });
Veiculo.belongsTo(Categoria, { as: 'categoria', foreignKey: 'categoria_id', onDelete: 'RESTRICT' });
module.exports = Veiculo;
