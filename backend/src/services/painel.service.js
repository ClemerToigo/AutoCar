const { Op, QueryTypes, Transaction } = require('sequelize');
const database = require('../config/database');
const Usuario = require('../models/usuario.model');
const Veiculo = require('../models/veiculo.model');

const timeZone = 'America/Sao_Paulo';

function monthlyCounts(Model, where, transaction) {
  const month = database.fn('to_char', database.fn('timezone', timeZone, database.col('created_at')), 'YYYY-MM');
  return Model.findAll({
    attributes: [[month, 'mes'], [database.fn('COUNT', database.col('id')), 'quantidade']],
    where, group: [month], raw: true, transaction,
  });
}

async function snapshot(now = new Date()) {
  // Uma única visão do banco mantém os totais e gráficos consistentes durante alterações simultâneas.
  return database.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
    const [period] = await database.query(`
      SELECT to_char(timezone($fuso, $agora::timestamptz), 'YYYY-MM') AS mes_atual,
        (date_trunc('month', timezone($fuso, $agora::timestamptz)) - INTERVAL '11 months') AT TIME ZONE $fuso AS inicio
    `, { bind: { fuso: timeZone, agora: now.toISOString() }, type: QueryTypes.SELECT, transaction });
    const createdInPeriod = { [Op.gte]: period.inicio, [Op.lte]: now };
    // A transação usa uma conexão; consultas sequenciais evitam enfileirar operações simultâneas no driver.
    const vehicleCounts = await Veiculo.findAll({ attributes: ['status', [database.fn('COUNT', database.col('id')), 'quantidade']], group: ['status'], raw: true, transaction });
    const customerCounts = await Usuario.findAll({ attributes: ['ativo', [database.fn('COUNT', database.col('id')), 'quantidade']], where: { tipo: 'USUARIO' }, group: ['ativo'], raw: true, transaction });
    const stock = await Veiculo.findOne({
        attributes: [[database.cast(database.fn('COALESCE', database.fn('SUM', database.col('preco')), 0), 'NUMERIC(30,2)'), 'valor']],
        where: { status: { [Op.in]: ['DISPONIVEL', 'RESERVADO'] } }, raw: true, transaction,
      });
    const recentes = await Veiculo.findAll({
        attributes: ['id', 'modelo', 'ano', 'preco', 'status', 'foto', 'created_at'],
        include: [{ association: 'marca', attributes: ['id', 'nome'] }],
        limit: 4, order: [['created_at', 'DESC'], ['id', 'DESC']], transaction,
      });
    const clientesRecentes = await Usuario.findAll({
        attributes: ['id', 'nome', 'login', 'telefone', 'ativo', 'created_at'], where: { tipo: 'USUARIO' },
        limit: 4, order: [['created_at', 'DESC'], ['id', 'DESC']], transaction,
      });
    const vehicleMonths = await monthlyCounts(Veiculo, { created_at: createdInPeriod }, transaction);
    const customerMonths = await monthlyCounts(Usuario, { tipo: 'USUARIO', created_at: createdInPeriod }, transaction);
    const vehicles = Object.fromEntries(vehicleCounts.map((row) => [row.status, Number(row.quantidade)]));
    const vehicleSeries = new Map(vehicleMonths.map((row) => [row.mes, Number(row.quantidade)]));
    const customerSeries = new Map(customerMonths.map((row) => [row.mes, Number(row.quantidade)]));
    const [year, month] = period.mes_atual.split('-').map(Number);
    const cadastrosMensais = Array.from({ length: 12 }, (_, index) => {
      const cursor = new Date(Date.UTC(year, month - 12 + index, 1));
      const mes = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      return { mes, veiculos: vehicleSeries.get(mes) || 0, clientes: customerSeries.get(mes) || 0 };
    });
    return {
      total: vehicleCounts.reduce((sum, row) => sum + Number(row.quantidade), 0),
      disponiveis: vehicles.DISPONIVEL || 0, reservados: vehicles.RESERVADO || 0, vendidos: vehicles.VENDIDO || 0,
      clientes: customerCounts.reduce((sum, row) => sum + Number(row.quantidade), 0),
      clientesAtivos: Number(customerCounts.find((row) => row.ativo)?.quantidade || 0),
      valorEstoque: String(stock.valor),
      novosVeiculos: cadastrosMensais[11].veiculos, novosClientes: cadastrosMensais[11].clientes,
      recentes, clientesRecentes, cadastrosMensais, fusoHorario: timeZone, atualizadoEm: now.toISOString(),
    };
  });
}

module.exports = { snapshot };
