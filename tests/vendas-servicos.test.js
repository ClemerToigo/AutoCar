const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para testar Serviços, Vendas e a atualização do banco.');
const schema = `autocar_vendas_test_${randomBytes(8).toString('hex')}`;
const connection = new URL(process.env.TEST_DATABASE_URL);
connection.searchParams.set('options', `${connection.searchParams.get('options') || ''} -c search_path=${schema},public`.trim());
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = connection.toString();
process.env.SECRET = randomBytes(48).toString('hex');
process.env.ADMIN_SEED_LOGIN = 'admin@vendas.local';
process.env.ADMIN_SEED_PASSWORD = 'senha-seed-nao-substitui';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `autocar-vendas-photos-${randomBytes(8).toString('hex')}`);
const database = require('../backend/src/config/database');
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const Marca = require('../backend/src/models/marca.model');
const Categoria = require('../backend/src/models/categoria.model');
const Veiculo = require('../backend/src/models/veiculo.model');
const Servico = require('../backend/src/models/servico.model');
const Venda = require('../backend/src/models/venda.model');
const VendaServico = require('../backend/src/models/venda-servico.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const config = require('../backend/src/config/env');
const app = require('../backend/src/app');
const setup = require('../backend/scripts/setup-database');
let server, base, admin, client, brand, category, hash, adminToken, clientToken, legacySnapshot;
let sequence = 0;
const sign = (user) => jwt.sign({ id_usuario: user.id, versao_sessao: user.versao_sessao }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' });
async function call(route, { method = 'GET', body, token = adminToken } = {}) {
  const response = await fetch(`${base}/api${route}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
function expectStatus(response, status) { assert.equal(response.status, status, JSON.stringify(response)); return response.data; }
function vehicleBody(extra = {}) {
  return { marca_id: brand.id, categoria_id: category.id, modelo: `Modelo de teste ${++sequence}`, ano: 2024, quilometragem: 1200, preco: '50000.00', combustivel: 'Flex', cambio: 'Manual', cor: 'Preto', status: 'DISPONIVEL', descricao: '', ...extra };
}
async function createVehicle(extra = {}) { return expectStatus(await call('/veiculos', { method: 'POST', body: vehicleBody(extra) }), 201); }
function saleBody(vehicleId, extra = {}) { return { cliente_id: client.id, veiculo_id: vehicleId, valor_veiculo: '50000.00', forma_pagamento: 'A_VISTA', status: 'EM_NEGOCIACAO', servicos: [], ...extra }; }
async function createSale(extra = {}) {
  const vehicle = await createVehicle();
  return expectStatus(await call('/vendas', { method: 'POST', body: saleBody(vehicle.id, extra) }), 201);
}
function serviceBody(extra = {}) { return { nome: `Serviço de teste ${++sequence}`, descricao: 'Exclusivo do banco de testes', preco: '850.50', ativo: true, ...extra }; }
async function legacyData() {
  return JSON.stringify({ usuarios: await Usuario.findAll({ order: [['id', 'ASC']] }), veiculos: await Veiculo.findAll({ order: [['id', 'ASC']] }) });
}
before(async () => {
  await database.createSchema(schema);
  await database.query(await fs.readFile(path.join(__dirname, 'fixtures/schema-antes-cruds.sql'), 'utf8'));
  hash = await bcrypt.hash('senha-original-preservada', 12);
  admin = await Usuario.create({ nome: 'Admin antigo', login: process.env.ADMIN_SEED_LOGIN, senha: hash, tipo: 'ADMIN' });
  client = await Usuario.create({ nome: 'Cliente antigo', login: 'cliente@vendas.local', senha: hash, tipo: 'USUARIO', cpf: '52998224725', telefone: '11999991234' });
  brand = await Marca.findOne({ where: { nome: 'Toyota' } }); category = await Categoria.findOne({ where: { nome: 'SUV' } });
  await Veiculo.create(vehicleBody({ modelo: 'Veículo anterior à atualização' }));
  legacySnapshot = await legacyData();
  await setup(); await setup();
  adminToken = sign(admin); clientToken = sign(client);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); }
  finally { await database.close(); await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true }); }
});

test('atualizar duas vezes o banco antigo preserva usuários, senhas e veículos', async () => {
  assert.equal(await legacyData(), legacySnapshot);
  assert.equal((await Usuario.findByPk(admin.id)).senha, hash);
  assert.equal(await Servico.count(), 0); assert.equal(await Venda.count(), 0); assert.equal(await VendaServico.count(), 0);
});

test('Serviços e Vendas exigem sessão de administrador', async () => {
  for (const resource of ['servicos', 'vendas']) {
    for (const [method, suffix, body] of [['GET', '', undefined], ['GET', '/1', undefined], ['POST', '', {}], ['PUT', '/1', {}], ['DELETE', '/1', undefined]]) {
      expectStatus(await call(`/${resource}${suffix}`, { method, body, token: null }), 401);
      expectStatus(await call(`/${resource}${suffix}`, { method, body, token: clientToken }), 403);
    }
  }
  expectStatus(await call('/vendas/opcoes', { token: clientToken }), 403);
});

test('Serviços valida, consulta, edita com versão e exclui registros sem vínculo', async () => {
  const body = serviceBody({ nome: 'Revisão pesquisável' });
  let service = expectStatus(await call('/servicos', { method: 'POST', body }), 201);
  for (const extra of [{ preco: '-1' }, { preco: '1.234' }, { ativo: 'invalido' }, { nome: '' }]) {
    expectStatus(await call('/servicos', { method: 'POST', body: { ...body, nome: 'Inválido', ...extra } }), 400);
  }
  const list = expectStatus(await call('/servicos?q=pesquis&limit=1'), 200); assert.equal(list.total, 1);
  service = expectStatus(await call(`/servicos/${service.id}`, { method: 'PUT', body: { ...body, preco: '900.25', versao: service.versao } }), 200);
  expectStatus(await call(`/servicos/${service.id}`, { method: 'PUT', body: { ...body, versao: 0 } }), 409);
  expectStatus(await call(`/servicos/${service.id}`, { method: 'DELETE' }), 204);
  expectStatus(await call(`/servicos/${service.id}`), 404);
});

for (const resource of ['marcas', 'categorias', 'servicos']) {
  test(`${resource}: nomes com acentos não podem ser repetidos mudando apenas as maiúsculas`, async () => {
    const nome = `Revisão acentuada ${resource}`;
    const body = resource === 'servicos' ? serviceBody({ nome }) : { nome };
    const first = expectStatus(await call(`/${resource}`, { method: 'POST', body }), 201);
    expectStatus(await call(`/${resource}`, { method: 'POST', body: { ...body, nome: nome.toUpperCase() } }), 409);
    // Acentos continuam significativos: revisão e revisao podem ser cadastros diferentes.
    expectStatus(await call(`/${resource}`, { method: 'POST', body: { ...body, nome: nome.replace('ã', 'a') } }), 201);
    expectStatus(await call(`/${resource}/${first.id}`, { method: 'PUT', body: { ...body, nome: nome.toUpperCase(), versao: first.versao } }), 200);
  });
  test(`${resource}: duas criações simultâneas com o mesmo nome geram apenas um cadastro`, async () => {
    const nome = `Concorrência de criação ${resource}`;
    const body = resource === 'servicos' ? serviceBody({ nome }) : { nome };
    const results = await Promise.all([call(`/${resource}`, { method: 'POST', body }), call(`/${resource}`, { method: 'POST', body: { ...body, nome: nome.toUpperCase() } })]);
    assert.deepEqual(results.map((item) => item.status).sort(), [201, 409]);
  });
  test(`${resource}: duas edições simultâneas não podem produzir nomes repetidos`, async () => {
    const body = resource === 'servicos' ? serviceBody() : { nome: `Nome inicial ${resource} ${++sequence}` };
    const first = expectStatus(await call(`/${resource}`, { method: 'POST', body }), 201);
    const second = expectStatus(await call(`/${resource}`, { method: 'POST', body: { ...body, nome: `${body.nome} outro` } }), 201);
    const nome = `Concorrência de edição ${resource}`;
    const results = await Promise.all([
      call(`/${resource}/${first.id}`, { method: 'PUT', body: { ...body, nome, versao: first.versao } }),
      call(`/${resource}/${second.id}`, { method: 'PUT', body: { ...body, nome: nome.toUpperCase(), versao: second.versao } }),
    ]);
    assert.deepEqual(results.map((item) => item.status).sort(), [200, 409]);
  });
}

test('Vendas calcula os totais no servidor e preserva o preço histórico dos serviços', async () => {
  const body = serviceBody();
  let service = expectStatus(await call('/servicos', { method: 'POST', body }), 201);
  let sale = await createSale({ servicos: [service.id], valor_total: '0.01', valor_servicos: '0.00' });
  assert.equal(sale.valor_total, '50850.50'); assert.equal(sale.valor_servicos, '850.50');
  service = expectStatus(await call(`/servicos/${service.id}`, { method: 'PUT', body: { ...body, preco: '1500.00', ativo: false, versao: service.versao } }), 200);
  sale = expectStatus(await call(`/vendas/${sale.id}`, { method: 'PUT', body: saleBody(sale.veiculo.id, { status: 'CONCLUIDA', servicos: [service.id], versao: sale.versao }) }), 200);
  assert.equal(sale.valor_total, '50850.50'); assert.equal(sale.servicos[0].preco, '850.50');
  expectStatus(await call(`/servicos/${service.id}`, { method: 'DELETE' }), 409);
  expectStatus(await call(`/vendas/${sale.id}`, { method: 'PUT', body: saleBody(sale.veiculo.id, { versao: 0 }) }), 409);
});

test('Vendas lista por número, cliente, período, status e pagamento', async () => {
  const sale = await createSale();
  for (const query of [`q=${sale.numero}`, 'q=Cliente', 'periodo=30', 'periodo=mes', 'periodo=ano', 'forma_pagamento=A_VISTA&status=EM_NEGOCIACAO']) {
    const list = expectStatus(await call(`/vendas?${query}`), 200); assert.ok(list.items.some((item) => item.id === sale.id));
  }
  expectStatus(await call('/vendas?periodo=invalido'), 400);
});

for (const [saleStatus, expectedVehicle] of [['EM_NEGOCIACAO', 'RESERVADO'], ['APROVADA', 'RESERVADO'], ['CONCLUIDA', 'VENDIDO']]) {
  test(`venda ${saleStatus} protege o status ${expectedVehicle} e permite editar outros dados do veículo`, async () => {
    const sale = await createSale({ status: saleStatus });
    const vehicle = expectStatus(await call(`/veiculos/${sale.veiculo.id}`), 200);
    assert.equal(vehicle.status, expectedVehicle);
    const before = expectStatus(await call('/painel'), 200);
    const blocked = await call(`/veiculos/${vehicle.id}`, { method: 'PUT', body: vehicleBody({ status: 'DISPONIVEL', versao: vehicle.versao }) });
    expectStatus(blocked, 409); assert.match(blocked.data.message, /venda vinculada/);
    const after = expectStatus(await call('/painel'), 200);
    assert.equal(after.vendidos, before.vendidos); assert.equal(after.reservados, before.reservados);
    const updated = expectStatus(await call(`/veiculos/${vehicle.id}`, { method: 'PUT', body: vehicleBody({ status: expectedVehicle, cor: 'Branco', versao: vehicle.versao }) }), 200);
    assert.equal(updated.cor, 'Branco'); assert.equal(updated.status, expectedVehicle);
    assert.equal((await Venda.findByPk(sale.id)).status, saleStatus);
  });
}

test('vendas simultâneas do mesmo veículo não geram duas vendas ativas', async () => {
  const vehicle = await createVehicle(); const body = saleBody(vehicle.id);
  const results = await Promise.all([call('/vendas', { method: 'POST', body }), call('/vendas', { method: 'POST', body })]);
  assert.deepEqual(results.map((item) => item.status).sort(), [201, 409]);
});

test('cliente e veículo com venda não podem ser excluídos e as fotos são preservadas', async () => {
  const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ff0000' } }).webp().toBuffer();
  const filename = `${randomUUID()}.webp`;
  await fs.mkdir(process.env.UPLOAD_DIR, { recursive: true });
  const photoPath = path.join(process.env.UPLOAD_DIR, filename); await fs.writeFile(photoPath, bytes);
  const vehicle = await Veiculo.create(vehicleBody({ foto: `/media/${filename}` }));
  const sale = expectStatus(await call('/vendas', { method: 'POST', body: saleBody(vehicle.id) }), 201);
  for (const [resource, id] of [['usuarios', client.id], ['veiculos', vehicle.id]]) {
    const result = await call(`/${resource}/${id}`, { method: 'DELETE' }); expectStatus(result, 409); assert.match(result.data.message, /vendas vinculadas/);
  }
  assert.deepEqual(await fs.readFile(photoPath), bytes); assert.ok(await Usuario.findByPk(client.id)); assert.ok(await Veiculo.findByPk(vehicle.id));
  expectStatus(await call(`/vendas/${sale.id}`, { method: 'DELETE' }), 204);
  // Vendas canceladas também fazem parte do histórico.
  expectStatus(await call(`/usuarios/${client.id}`, { method: 'DELETE' }), 409);
  expectStatus(await call(`/veiculos/${vehicle.id}`, { method: 'DELETE' }), 409);
});

test('a proteção de erro também reconhece uma violação RESTRICT do PostgreSQL', async () => {
  const service = require('../backend/src/services/usuarios.service'); const original = service.remove;
  // Simula o conflito chegando diretamente do banco, como pode ocorrer numa disputa entre requisições.
  service.remove = async (id) => { const row = await Usuario.findByPk(id); await row.destroy(); };
  try {
    const result = await call(`/usuarios/${client.id}`, { method: 'DELETE' }); expectStatus(result, 409); assert.match(result.data.message, /registros vinculados/);
    assert.ok(await Usuario.findByPk(client.id));
  } finally { service.remove = original; }
});

test('cancelar preserva a venda, libera o veículo e permite uma nova venda', async () => {
  const sale = await createSale();
  expectStatus(await call(`/vendas/${sale.id}`, { method: 'DELETE' }), 204);
  const cancelled = expectStatus(await call(`/vendas/${sale.id}`), 200);
  assert.equal(cancelled.status, 'CANCELADA'); assert.equal(cancelled.valor_total, sale.valor_total);
  assert.equal((await Veiculo.findByPk(sale.veiculo.id)).status, 'DISPONIVEL');
  expectStatus(await call(`/vendas/${sale.id}`, { method: 'PUT', body: saleBody(sale.veiculo.id) }), 409);
  expectStatus(await call('/vendas', { method: 'POST', body: saleBody(sale.veiculo.id) }), 201);
});

test('repetir a preparação respeita marcas e categorias renomeadas em maiúsculas', async () => {
  await brand.update({ nome: 'TOYOTA' }); await category.update({ nome: 'suv' });
  await setup();
  assert.equal(await Marca.count({ where: { nome: ['Toyota', 'TOYOTA'] } }), 1);
  assert.equal(await Categoria.count({ where: { nome: ['SUV', 'suv'] } }), 1);
});

test('a atualização detecta duplicados antigos sem apagar ou mesclar registros', async () => {
  await database.query(`DROP INDEX "${schema}".marcas_nome_sem_caixa_unique`);
  const first = await Marca.create({ nome: 'Duplicada antiga' }); const second = await Marca.create({ nome: 'DUPLICADA ANTIGA' });
  try {
    await assert.rejects(setup(), /nomes duplicados em marcas/);
    assert.ok(await Marca.findByPk(first.id)); assert.ok(await Marca.findByPk(second.id));
    assert.equal((await Usuario.findByPk(admin.id)).senha, hash);
  } finally {
    await second.destroy(); await first.destroy(); await setup();
  }
});
