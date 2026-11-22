const { Op, literal } = require('sequelize');
const database = require('../config/database');
const Venda = require('../models/venda.model');
const VendaServico = require('../models/venda-servico.model');
const Servico = require('../models/servico.model');
const Usuario = require('../models/usuario.model');
const Veiculo = require('../models/veiculo.model');
const Marca = require('../models/marca.model');
const money = require('./money');
const v = require('./validation');

const STATUS = ['EM_NEGOCIACAO', 'APROVADA', 'CONCLUIDA', 'CANCELADA'];
const PAYMENTS = ['A_VISTA', 'FINANCIAMENTO', 'CARTAO'];
const PERIODS = ['30', 'mes', 'ano'];
// Status do veículo que acompanha cada status da venda.
const VEHICLE_STATUS = { EM_NEGOCIACAO: 'RESERVADO', APROVADA: 'RESERVADO', CONCLUIDA: 'VENDIDO', CANCELADA: 'DISPONIVEL' };
const MAX_SERVICES = 20;
const timeZone = 'America/Sao_Paulo';
const periodStart = {
  30: "now() - INTERVAL '30 days'",
  mes: `date_trunc('month', now() AT TIME ZONE '${timeZone}') AT TIME ZONE '${timeZone}'`,
  ano: `date_trunc('year', now() AT TIME ZONE '${timeZone}') AT TIME ZONE '${timeZone}'`,
};
const conflict = () => v.fail('Este veículo já possui uma venda em andamento ou concluída.', 409);

const listInclude = () => [
  { model: Usuario, as: 'cliente', attributes: ['id', 'nome', 'login'] },
  { model: Veiculo, as: 'veiculo', attributes: ['id', 'modelo', 'ano'], include: [{ model: Marca, as: 'marca', attributes: ['id', 'nome'] }] },
];
const detailInclude = () => [
  ...listInclude(),
  { model: VendaServico, as: 'itens', include: [{ model: Servico, as: 'servico', attributes: ['id', 'nome'] }] },
];

function saleYear(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date(date));
}
function serialize(row, detailed = false) {
  const data = row.get({ plain: true });
  const sale = {
    id: data.id,
    numero: `V-${saleYear(data.created_at)}-${String(data.id).padStart(4, '0')}`,
    cliente: { id: data.cliente.id, nome: data.cliente.nome, email: data.cliente.login },
    veiculo: { id: data.veiculo.id, modelo: data.veiculo.modelo, ano: data.veiculo.ano, marca: data.veiculo.marca },
    valor_veiculo: data.valor_veiculo, valor_servicos: data.valor_servicos, valor_total: data.valor_total,
    forma_pagamento: data.forma_pagamento, status: data.status, versao: data.versao,
    created_at: data.created_at, updated_at: data.updated_at,
  };
  if (detailed) {
    sale.servicos = data.itens
      .map((item) => ({ id: item.servico.id, nome: item.servico.nome, preco: item.preco }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return sale;
}

function choice(value, label) {
  if (value === undefined || value === null || value === '') v.fail(`Selecione ${label}.`);
  return v.integer(value, label);
}
function serviceIds(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_SERVICES) v.fail(`Selecione até ${MAX_SERVICES} serviços.`);
  const ids = value.map((id) => v.integer(id, 'Serviço'));
  if (new Set(ids).size !== ids.length) v.fail('Há serviços repetidos na venda.');
  return ids;
}
// Valida o formato dos dados. As regras que dependem do banco ficam nas funções abaixo.
function parse(body) {
  v.object(body);
  return {
    cliente_id: choice(body.cliente_id, 'um cliente'),
    veiculo_id: choice(body.veiculo_id, 'um veículo'),
    valor_veiculo: money.parse(body.valor_veiculo, 'o valor do veículo'),
    forma_pagamento: v.option(body.forma_pagamento, PAYMENTS, 'uma forma de pagamento'),
    status: v.option(body.status, STATUS, 'um status'),
    servicos: serviceIds(body.servicos),
  };
}

async function ensureClient(id, transaction, currentId) {
  const client = await Usuario.findByPk(id, { attributes: ['id', 'tipo', 'ativo'], transaction });
  if (!client || client.tipo !== 'USUARIO') v.fail('Selecione um cliente cadastrado.');
  if (!client.ativo && id !== currentId) v.fail('O cliente selecionado está inativo.');
}
async function ensureAvailable(vehicle, transaction) {
  if (vehicle.status === 'VENDIDO') v.fail('Este veículo já consta como vendido.', 409);
  const active = await Venda.count({ where: { veiculo_id: vehicle.id, status: { [Op.ne]: 'CANCELADA' } }, transaction });
  if (active) conflict();
}
// `kept` guarda o preço já cobrado dos serviços que a venda tinha; os novos usam o preço atual e precisam estar ativos.
async function resolveServices(ids, kept, transaction) {
  const found = ids.length ? await Servico.findAll({ where: { id: ids }, transaction, lock: transaction.LOCK.SHARE }) : [];
  if (found.length !== ids.length) v.fail('Um dos serviços selecionados não existe mais.');
  return found.map((service) => {
    if (kept.has(service.id)) return { servico_id: service.id, cents: kept.get(service.id) };
    if (!service.ativo) v.fail(`O serviço "${service.nome}" está inativo.`);
    return { servico_id: service.id, cents: money.cents(service.preco) };
  });
}
function totals(vehicleCents, items) {
  const services = items.reduce((sum, item) => sum + item.cents, 0);
  const total = vehicleCents + services;
  if (total > money.MAX_CENTS) v.fail('O valor total da venda excede o limite permitido.');
  return { valor_veiculo: money.format(vehicleCents), valor_servicos: money.format(services), valor_total: money.format(total) };
}
async function setVehicleStatus(vehicle, status, transaction) {
  if (vehicle.status !== status) await vehicle.update({ status, versao: vehicle.versao + 1 }, { transaction });
}

async function list(query) {
  const pagination = v.page(query, 8);
  const where = {};
  const term = v.search(query.q);
  if (term) {
    const like = { [Op.iLike]: `%${term}%` };
    const clauses = [{ '$cliente.nome$': like }, { '$cliente.login$': like }, { '$veiculo.modelo$': like }, { '$veiculo.marca.nome$': like }];
    const number = /^(?:v-?\d{4}-?)?(\d{1,9})$/i.exec(term);
    if (number) clauses.push({ id: Number(number[1]) });
    where[Op.or] = clauses;
  }
  if (query.status) where.status = v.option(query.status, STATUS, 'um status');
  if (query.forma_pagamento) where.forma_pagamento = v.option(query.forma_pagamento, PAYMENTS, 'uma forma de pagamento');
  if (query.periodo) where.created_at = { [Op.gte]: literal(periodStart[v.option(query.periodo, PERIODS, 'um período')]) };
  const { rows, count } = await Venda.findAndCountAll({
    where, include: listInclude(), order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit,
  });
  return v.result(rows.map((row) => serialize(row)), count, pagination);
}
async function get(rawId) {
  const row = await Venda.findByPk(v.integer(rawId, 'ID'), { include: detailInclude() });
  if (!row) v.fail('Venda não encontrada.', 404);
  return serialize(row, true);
}
async function create(body) {
  const data = parse(body);
  const serviceList = data.servicos ?? [];
  let id;
  try {
    id = await database.transaction(async (transaction) => {
      // Sempre trava o veículo primeiro: duas vendas do mesmo carro são processadas uma de cada vez.
      const vehicle = await Veiculo.findByPk(data.veiculo_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!vehicle) v.fail('Selecione um veículo cadastrado.');
      await ensureClient(data.cliente_id, transaction);
      const items = await resolveServices(serviceList, new Map(), transaction);
      const active = data.status !== 'CANCELADA';
      if (active) await ensureAvailable(vehicle, transaction);
      const sale = await Venda.create({
        cliente_id: data.cliente_id, veiculo_id: data.veiculo_id, forma_pagamento: data.forma_pagamento, status: data.status,
        ...totals(data.valor_veiculo, items),
      }, { transaction });
      if (items.length) await VendaServico.bulkCreate(items.map((item) => ({ venda_id: sale.id, servico_id: item.servico_id, preco: money.format(item.cents) })), { transaction });
      if (active) await setVehicleStatus(vehicle, VEHICLE_STATUS[data.status], transaction);
      return sale.id;
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') conflict();
    throw error;
  }
  return get(id);
}
async function update(rawId, body) {
  const id = v.integer(rawId, 'ID');
  v.object(body);
  await database.transaction(async (transaction) => {
    const sale = await Venda.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!sale) v.fail('Venda não encontrada.', 404);
    if (sale.status === 'CANCELADA') v.fail('Vendas canceladas não podem ser alteradas. Registre uma nova venda.', 409);
    if (body.versao !== undefined && v.integer(body.versao, 'Versão', 0) !== sale.versao) v.fail('Esta venda foi alterada por outra pessoa. Recarregue os dados antes de salvar.', 409);
    const data = parse({ ...body, veiculo_id: body.veiculo_id ?? sale.veiculo_id });
    if (data.veiculo_id !== sale.veiculo_id) v.fail('O veículo de uma venda não pode ser trocado. Cancele esta venda e registre outra.', 409);
    const vehicle = await Veiculo.findByPk(sale.veiculo_id, { transaction, lock: transaction.LOCK.UPDATE });
    await ensureClient(data.cliente_id, transaction, sale.cliente_id);
    const current = await VendaServico.findAll({ where: { venda_id: id }, transaction });
    const kept = new Map(current.map((item) => [item.servico_id, money.cents(item.preco)]));
    const ids = data.servicos ?? [...kept.keys()];
    const items = await resolveServices(ids, kept, transaction);
    const values = totals(data.valor_veiculo, items);
    await VendaServico.destroy({ where: { venda_id: id, ...(ids.length ? { servico_id: { [Op.notIn]: ids } } : {}) }, transaction });
    const added = items.filter((item) => !kept.has(item.servico_id));
    if (added.length) await VendaServico.bulkCreate(added.map((item) => ({ venda_id: id, servico_id: item.servico_id, preco: money.format(item.cents) })), { transaction });
    await sale.update({ cliente_id: data.cliente_id, forma_pagamento: data.forma_pagamento, status: data.status, ...values, versao: sale.versao + 1 }, { transaction });
    await setVehicleStatus(vehicle, VEHICLE_STATUS[data.status], transaction);
  });
  return get(id);
}
// Excluir uma venda a cancela: o registro e os valores permanecem no histórico e o veículo volta a ficar disponível.
async function cancel(rawId) {
  const id = v.integer(rawId, 'ID');
  await database.transaction(async (transaction) => {
    const sale = await Venda.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!sale) v.fail('Venda não encontrada.', 404);
    if (sale.status === 'CANCELADA') v.fail('Esta venda já está cancelada.', 409);
    const vehicle = await Veiculo.findByPk(sale.veiculo_id, { transaction, lock: transaction.LOCK.UPDATE });
    await sale.update({ status: 'CANCELADA', versao: sale.versao + 1 }, { transaction });
    await setVehicleStatus(vehicle, VEHICLE_STATUS.CANCELADA, transaction);
  });
}
async function options() {
  const busy = await Venda.findAll({ attributes: ['veiculo_id'], where: { status: { [Op.ne]: 'CANCELADA' } }, raw: true });
  const taken = busy.map((row) => row.veiculo_id);
  const [clientes, veiculos, servicos] = await Promise.all([
    Usuario.findAll({ attributes: ['id', 'nome', 'login'], where: { tipo: 'USUARIO', ativo: true }, order: [['nome', 'ASC'], ['id', 'ASC']] }),
    Veiculo.findAll({
      attributes: ['id', 'modelo', 'ano', 'preco', 'status'],
      where: { status: { [Op.ne]: 'VENDIDO' }, ...(taken.length ? { id: { [Op.notIn]: taken } } : {}) },
      include: [{ model: Marca, as: 'marca', attributes: ['id', 'nome'] }], order: [['id', 'DESC']],
    }),
    Servico.findAll({ attributes: ['id', 'nome', 'preco'], where: { ativo: true }, order: [['nome', 'ASC']] }),
  ]);
  return { clientes: clientes.map((row) => ({ id: row.id, nome: row.nome, email: row.login })), veiculos, servicos };
}
module.exports = { list, get, create, update, cancel, options };
