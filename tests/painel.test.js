const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { Op } = require('sequelize');

if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para testar o dashboard.');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SECRET = randomBytes(48).toString('hex');
const database = require('../backend/src/config/database');
const schema = `autocar_painel_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const Marca = require('../backend/src/models/marca.model');
const Categoria = require('../backend/src/models/categoria.model');
const Veiculo = require('../backend/src/models/veiculo.model');
const { snapshot } = require('../backend/src/services/painel.service');
const app = require('../backend/src/app');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../backend/src/config/env');
let server, base, admin, token, brand, category, hash, counter = 0;
const reference = new Date('2026-03-01T02:30:00.000Z'); // Ainda é fevereiro no horário de Brasília.

const customer = (overrides = {}) => Usuario.create({ nome: `Cliente ${++counter}`, login: `cliente${counter}@painel.local`, senha: hash, tipo: 'USUARIO', ...overrides });
const vehicleBody = (overrides = {}) => ({ marca_id: brand.id, categoria_id: category.id, modelo: `Veículo ${++counter}`, ano: 2024, quilometragem: 10000, preco: '100.10', combustivel: 'Flex', cambio: 'Manual', cor: 'Branco', status: 'DISPONIVEL', ...overrides });
const vehicle = (overrides = {}) => Veiculo.create(vehicleBody(overrides));
async function call(route, { method = 'GET', body, authorization = token } = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}

before(async () => {
  await database.createSchema(schema); await Usuario.sync(); await Marca.sync(); await Categoria.sync(); await Veiculo.sync();
  hash = await bcrypt.hash('senha-painel-123', 12);
  admin = await Usuario.create({ nome: 'Admin Painel', login: 'admin@painel.local', senha: hash, tipo: 'ADMIN' });
  token = jwt.sign({ id_usuario: admin.id, versao_sessao: admin.versao_sessao }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' });
  brand = await Marca.create({ nome: 'Marca do teste' }); category = await Categoria.create({ nome: 'Categoria do teste' });
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Veiculo.destroy({ where: {} });
  await Usuario.destroy({ where: { id: { [Op.ne]: admin.id } } });
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); }
});

test('banco sem veículos ou clientes retorna zeros, listas vazias e doze meses sem valores inventados', async () => {
  const data = await snapshot(reference);
  for (const key of ['total', 'disponiveis', 'reservados', 'vendidos', 'clientes', 'clientesAtivos', 'novosVeiculos', 'novosClientes']) assert.equal(data[key], 0);
  assert.equal(data.valorEstoque, '0.00'); assert.deepEqual(data.recentes, []); assert.deepEqual(data.clientesRecentes, []);
  assert.equal(data.cadastrosMensais.length, 12);
  assert.equal(data.cadastrosMensais[0].mes, '2025-03'); assert.equal(data.cadastrosMensais[11].mes, '2026-02');
  assert.ok(data.cadastrosMensais.every((month) => month.veiculos === 0 && month.clientes === 0));
});

test('totais respeitam status, clientes ativos e soma decimal do estoque sem incluir vendidos', async () => {
  await vehicle({ preco: '0.10' }); await vehicle({ preco: '0.20', status: 'RESERVADO' }); await vehicle({ preco: '9999.99', status: 'VENDIDO' });
  await customer(); await customer({ ativo: false }); await customer({ tipo: 'ADMIN' });
  const data = await snapshot();
  assert.equal(data.total, 3); assert.equal(data.disponiveis, 1); assert.equal(data.reservados, 1); assert.equal(data.vendidos, 1);
  assert.equal(data.valorEstoque, '0.30'); assert.equal(data.clientes, 2); assert.equal(data.clientesAtivos, 1);
});

test('gráfico usa datas reais, limites de mês em Brasília e exclui registros fora do período', async () => {
  await vehicle({ created_at: new Date('2025-03-01T02:59:59Z') });
  await vehicle({ created_at: new Date('2025-03-01T03:00:00Z') });
  await vehicle({ created_at: new Date('2026-03-01T01:00:00Z') });
  await vehicle({ created_at: new Date('2026-03-01T03:00:00Z') });
  await customer({ created_at: new Date('2026-01-01T02:00:00Z') });
  await customer({ tipo: 'ADMIN', created_at: new Date('2026-02-10T12:00:00Z') });
  const data = await snapshot(reference);
  assert.equal(data.cadastrosMensais.find((month) => month.mes === '2025-03').veiculos, 1);
  assert.equal(data.cadastrosMensais.find((month) => month.mes === '2025-12').clientes, 1);
  assert.equal(data.cadastrosMensais.find((month) => month.mes === '2026-01').clientes, 0);
  assert.equal(data.novosVeiculos, 1); assert.equal(data.novosClientes, 0);
  assert.equal(data.cadastrosMensais.reduce((sum, month) => sum + month.veiculos, 0), 2);
  assert.equal(data.cadastrosMensais.reduce((sum, month) => sum + month.clientes, 0), 1);
  assert.equal(data.fusoHorario, 'America/Sao_Paulo');
});

test('últimos clientes e veículos vêm do banco, com ordem determinística e sem dados privados', async () => {
  const customers = [], vehicles = [];
  for (let i = 1; i <= 5; i++) {
    customers.push(await customer({ created_at: new Date(`2026-02-${String(i).padStart(2, '0')}T12:00:00Z`), cpf: null }));
    vehicles.push(await vehicle({ created_at: new Date(`2026-02-${String(i).padStart(2, '0')}T12:00:00Z`) }));
  }
  const data = (await call('/api/painel')).data;
  assert.deepEqual(data.clientesRecentes.map((row) => row.id), customers.slice(1).reverse().map((row) => row.id));
  assert.deepEqual(data.recentes.map((row) => row.id), vehicles.slice(1).reverse().map((row) => row.id));
  for (const row of data.clientesRecentes) for (const key of ['senha', 'cpf', 'versao_sessao', 'termos_aceitos_em']) assert.equal(key in row, false);
  assert.equal(data.recentes[0].marca.nome, brand.nome);
});

test('cadastro público, alteração de status e exclusão refletem na próxima consulta do dashboard', async () => {
  const registered = await call('/api/auth/register', { method: 'POST', authorization: null, body: { nome: 'Cliente Integrado', email: 'integrado@painel.local', cpf: '52998224725', telefone: '11999991234', senha: 'senha-cliente-123', confirmar_senha: 'senha-cliente-123', aceite_termos: true } });
  assert.equal(registered.status, 201);
  const body = vehicleBody(); const created = await call('/api/veiculos', { method: 'POST', body }); assert.equal(created.status, 201);
  const first = await call('/api/painel');
  assert.equal(first.data.total, 1); assert.equal(first.data.clientes, 1); assert.equal(first.data.valorEstoque, '100.10');
  assert.equal(first.data.clientesRecentes[0].nome, 'Cliente Integrado');
  assert.equal(first.data.novosVeiculos, 1); assert.equal(first.data.novosClientes, 1);
  assert.equal((await call(`/api/veiculos/${created.data.id}`, { method: 'PUT', body: { ...body, status: 'VENDIDO', versao: created.data.versao } })).status, 200);
  const second = await call('/api/painel'); assert.equal(second.data.vendidos, 1); assert.equal(second.data.disponiveis, 0); assert.equal(second.data.valorEstoque, '0.00');
  assert.equal((await call(`/api/veiculos/${created.data.id}`, { method: 'DELETE' })).status, 204);
  const third = await call('/api/painel'); assert.equal(third.data.total, 0); assert.equal(third.data.novosVeiculos, 0); assert.deepEqual(third.data.recentes, []);
});

test('dashboard mantém autenticação e acesso exclusivo para administradores', async () => {
  assert.equal((await call('/api/painel', { authorization: null })).status, 401);
  const client = await customer();
  const clientToken = jwt.sign({ id_usuario: client.id, versao_sessao: 0 }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' });
  assert.equal((await call('/api/painel', { authorization: clientToken })).status, 403);
  assert.equal((await call('/api/painel')).status, 200);
});
