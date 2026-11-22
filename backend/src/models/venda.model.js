const { DataTypes } = require('sequelize');
const database = require('../config/database');
const Usuario = require('./usuario.model');
const Veiculo = require('./veiculo.model');
const Servico = require('./servico.model');
const VendaServico = require('./venda-servico.model');
const Venda = database.define('Venda', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Usuario, key: 'id' } },
  veiculo_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Veiculo, key: 'id' } },
  valor_veiculo: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  valor_servicos: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  valor_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  forma_pagamento: { type: DataTypes.STRING(20), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'EM_NEGOCIACAO' },
  versao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'vendas', underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' });
Venda.belongsTo(Usuario, { as: 'cliente', foreignKey: 'cliente_id', onDelete: 'RESTRICT' });
Venda.belongsTo(Veiculo, { as: 'veiculo', foreignKey: 'veiculo_id', onDelete: 'RESTRICT' });
Venda.hasMany(VendaServico, { as: 'itens', foreignKey: 'venda_id', onDelete: 'CASCADE' });
VendaServico.belongsTo(Servico, { as: 'servico', foreignKey: 'servico_id', onDelete: 'RESTRICT' });
module.exports = Venda;
