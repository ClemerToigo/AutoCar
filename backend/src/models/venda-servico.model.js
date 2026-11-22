const { DataTypes } = require('sequelize');
const database = require('../config/database');
// Serviço adicional de uma venda. `preco` guarda o valor cobrado na época, sem acompanhar mudanças no cadastro do serviço.
module.exports = database.define('VendaServico', {
  venda_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  servico_id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  preco: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
}, { tableName: 'venda_servicos', timestamps: false });
