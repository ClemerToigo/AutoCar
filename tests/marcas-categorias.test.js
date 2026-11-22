const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para executar os testes de integração.');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SECRET = randomBytes(48).toString('hex');
const database = require('../backend/src/config/database');
const schema = `autocar_marcas_categorias_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const Marca = require('../backend/src/models/marca.model');
const Categoria = require('../backend/src/models/categoria.model');
const Veiculo = require('../backend/src/models/veiculo.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../backend/src/config/env');
const app = require('../backend/src/app');
let server, base, adminToken, clientToken;
const resources = [
  { route: 'marcas', Model: Marca, foreign: 'marca_id', singular: 'marca' },
  { route: 'categorias', Model: Categoria, foreign: 'categoria_id', singular: 'categoria' },
];
function sign(user) { return jwt.sign({ id_usuario: user.id, versao_sessao: user.versao_sessao }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' }); }
async function call(route, { method = 'GET', body, token = adminToken } = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
before(async () => {
  await database.createSchema(schema); await Usuario.sync(); await Marca.sync(); await Categoria.sync(); await Veiculo.sync();
  const hash = await bcrypt.hash('senha-admin-123', 12);
  const admin = await Usuario.create({ nome: 'Admin Teste', login: 'admin@autocar.local', senha: hash, tipo: 'ADMIN' });
  const client = await Usuario.create({ nome: 'Cliente Teste', login: 'cliente@autocar.local', senha: hash, tipo: 'USUARIO' });
  adminToken = sign(admin); clientToken = sign(client);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); }
});

test('as operações de marcas e categorias exigem autenticação e perfil ADMIN', async () => {
  for (const { route } of resources) for (const [method, suffix, body] of [['GET', '', null], ['GET', '/1', null], ['POST', '', {}], ['PUT', '/1', {}], ['DELETE', '/1', null]]) {
    assert.equal((await call(`/api/${route}${suffix}`, { method, body, token: null })).status, 401);
    assert.equal((await call(`/api/${route}${suffix}`, { method, body, token: clientToken })).status, 403);
  }
});

for (const { route, singular } of resources) {
  test(`cria, consulta, edita e exclui ${route}`, async () => {
    const created = await call(`/api/${route}`, { method: 'POST', body: { nome: `  ${singular} de teste  ` } });
    assert.equal(created.status, 201);
    assert.equal(created.data.nome, `${singular} de teste`);
    assert.equal(created.data.total_veiculos, 0);
    const id = created.data.id;
    assert.equal((await call(`/api/${route}/${id}`)).data.nome, `${singular} de teste`);
    const updated = await call(`/api/${route}/${id}`, { method: 'PUT', body: { nome: `${singular} renomeada` } });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.nome, `${singular} renomeada`);
    assert.equal((await call(`/api/${route}/${id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await call(`/api/${route}/${id}`)).status, 404);
    assert.equal((await call(`/api/${route}/${id}`, { method: 'DELETE' })).status, 404);
  });

  test(`valida o nome de ${route}`, async () => {
    for (const body of [{}, { nome: '' }, { nome: '   ' }, { nome: 123 }, { nome: 'x'.repeat(101) }]) {
      assert.equal((await call(`/api/${route}`, { method: 'POST', body })).status, 400);
    }
    assert.equal((await call(`/api/${route}`, { method: 'POST', body: [] })).status, 400);
    assert.equal((await call(`/api/${route}/abc`)).status, 400);
  });

  test(`não permite nome duplicado em ${route}, mesmo com maiúsculas diferentes`, async () => {
    const first = await call(`/api/${route}`, { method: 'POST', body: { nome: `Duplicada ${route}` } });
    assert.equal(first.status, 201);
    assert.equal((await call(`/api/${route}`, { method: 'POST', body: { nome: `DUPLICADA ${route}`.toUpperCase() } })).status, 409);
    const other = await call(`/api/${route}`, { method: 'POST', body: { nome: `Outra ${route}` } });
    assert.equal((await call(`/api/${route}/${other.data.id}`, { method: 'PUT', body: { nome: `duplicada ${route}` } })).status, 409);
    // Regravar o próprio nome, mudando só as letras, é permitido.
    assert.equal((await call(`/api/${route}/${first.data.id}`, { method: 'PUT', body: { nome: `DUPLICADA ${route}` } })).status, 200);
  });

  test(`pesquisa e pagina ${route}`, async () => {
    for (let i = 1; i <= 3; i++) await call(`/api/${route}`, { method: 'POST', body: { nome: `Paginada ${route} ${i}` } });
    const filtered = await call(`/api/${route}?q=PAGINADA&limit=2&page=2`);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.data.total, 3);
    assert.equal(filtered.data.pages, 2);
    assert.equal(filtered.data.items.length, 1);
    assert.deepEqual(Object.keys(filtered.data.items[0]).sort(), ['id', 'nome', 'total_veiculos']);
    assert.equal((await call(`/api/${route}?limit=0`)).status, 400);
    assert.equal((await call(`/api/${route}?q=%25`)).data.total, 0);
  });
}

test('marca e categoria com veículos mostram a contagem e não podem ser excluídas', async () => {
  const marca = await Marca.create({ nome: 'Marca com veículo' });
  const categoria = await Categoria.create({ nome: 'Categoria com veículo' });
  await Veiculo.create({ marca_id: marca.id, categoria_id: categoria.id, modelo: 'Modelo A', ano: 2024, quilometragem: 0, preco: '100000.00', combustivel: 'Flex', cambio: 'Manual', cor: 'Preto' });
  await Veiculo.create({ marca_id: marca.id, categoria_id: categoria.id, modelo: 'Modelo B', ano: 2024, quilometragem: 0, preco: '100000.00', combustivel: 'Flex', cambio: 'Manual', cor: 'Branco' });
  assert.equal((await call(`/api/marcas/${marca.id}`)).data.total_veiculos, 2);
  assert.equal((await call(`/api/categorias/${categoria.id}`)).data.total_veiculos, 2);
  const listed = await call('/api/marcas?q=Marca com veículo');
  assert.equal(listed.data.items[0].total_veiculos, 2);
  const blockedBrand = await call(`/api/marcas/${marca.id}`, { method: 'DELETE' });
  assert.equal(blockedBrand.status, 409);
  assert.match(blockedBrand.data.message, /veículos cadastrados/);
  assert.equal((await call(`/api/categorias/${categoria.id}`, { method: 'DELETE' })).status, 409);
  assert.ok(await Marca.findByPk(marca.id));
  assert.ok(await Categoria.findByPk(categoria.id));
});
