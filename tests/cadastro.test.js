const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');

if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para executar os testes de cadastro.');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SECRET = randomBytes(48).toString('hex');
const database = require('../backend/src/config/database');
const schema = `autocar_cadastro_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const bcrypt = require('bcryptjs');
const app = require('../backend/src/app');
let server, base, customer, counter = 0;

function cpf(prefix) {
  let result = prefix;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(result[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11;
    result += digit === 10 ? '0' : String(digit);
  }
  return result;
}
function body(overrides = {}) {
  const id = ++counter;
  return { nome: `Cliente de cadastro ${id}`, email: `cadastro${id}@autocar.local`, cpf: cpf(String(800000000 + id)), telefone: '(11) 99999-1234', senha: 'senha-cliente-123', confirmar_senha: 'senha-cliente-123', aceite_termos: true, ...overrides };
}
const register = (data) => fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

before(async () => {
  await database.createSchema(schema);
  await Usuario.sync();
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); }
});

test('cadastro público persiste cliente, normaliza dados, protege senha e registra aceite', async () => {
  const data = body({ nome: '  Cliente de Cadastro  ', email: '  NOVO@AUTOCAR.LOCAL ' });
  const response = await register(data);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  customer = await response.json();
  assert.deepEqual(Object.keys(customer).sort(), ['id_usuario', 'login', 'nome', 'tipo']);
  assert.equal(customer.nome, 'Cliente de Cadastro');
  assert.equal(customer.login, 'novo@autocar.local');
  assert.equal(customer.tipo, 'USUARIO');
  const stored = await Usuario.findByPk(customer.id_usuario);
  assert.ok(await bcrypt.compare(data.senha, stored.senha));
  assert.notEqual(stored.senha, data.senha);
  assert.equal(stored.cpf, data.cpf);
  assert.equal(stored.telefone, '11999991234');
  assert.equal(stored.ativo, true);
  assert.ok(stored.termos_aceitos_em instanceof Date);
  assert.equal(stored.versao_termos, '1');
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.email, senha: data.senha }) });
  assert.equal(login.status, 200);
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.token}` };
  assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 200);
  assert.equal((await fetch(`${base}/api/usuarios`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/api/veiculos`, { headers })).status, 403);
});

test('ignora tentativa de escolher ADMIN, status, id ou dados internos no cadastro público', async () => {
  const response = await register(body({ tipo: 'ADMIN', ativo: false, id: 2147483000, versao_sessao: 99, termos_aceitos_em: '2000-01-01', versao_termos: 'forjada' }));
  assert.equal(response.status, 201);
  const data = await response.json(); const stored = await Usuario.findByPk(data.id_usuario);
  assert.equal(data.tipo, 'USUARIO'); assert.equal(stored.ativo, true);
  assert.notEqual(stored.id, 2147483000); assert.equal(stored.versao_sessao, 0);
  assert.equal(stored.versao_termos, '1'); assert.ok(stored.termos_aceitos_em.getFullYear() > 2000);
});

test('rejeita dados inválidos, senhas divergentes e ausência de aceite sem criar contas', async () => {
  const beforeCount = await Usuario.count();
  const invalid = [null, [], {}, body({ nome: {} }), body({ nome: ' ' }), body({ email: 'invalido' }), body({ cpf: '11111111111' }), body({ telefone: '123' }),
    body({ senha: 'curta', confirmar_senha: 'curta' }), body({ senha: 'á'.repeat(37), confirmar_senha: 'á'.repeat(37) }), body({ confirmar_senha: 'senha-diferente' }), body({ aceite_termos: false }), body({ aceite_termos: 'true' })];
  for (const item of invalid) {
    const response = await register(item);
    assert.equal(response.status, 400);
    assert.equal('token' in await response.json(), false);
  }
  assert.equal(await Usuario.count(), beforeCount);
});

test('impede duplicar e-mail normalizado ou CPF e preserva os dados da conta existente', async () => {
  const stored = await Usuario.findByPk(customer.id_usuario);
  const oldHash = stored.senha;
  for (const override of [{ email: ` ${customer.login.toUpperCase()} ` }, { cpf: stored.cpf }]) {
    const response = await register(body(override));
    assert.equal(response.status, 409);
    assert.equal('senha' in await response.json(), false);
  }
  await stored.reload(); assert.equal(stored.senha, oldHash); assert.equal(stored.nome, customer.nome);
});

test('cadastros simultâneos com os mesmos dados geram uma única conta', async () => {
  const data = body();
  const responses = await Promise.all([register(data), register(data)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await Usuario.count({ where: { login: data.email } }), 1);
});

test('limita tentativas de cadastro sem afetar o login', async () => {
  let response;
  for (let i = 0; i < 3; i++) response = await register({});
  assert.equal(response.status, 429); assert.ok(response.headers.get('retry-after'));
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: customer.login, senha: 'senha-cliente-123' }) });
  assert.equal(login.status, 200);
});

test('páginas de login, cadastro e conta servem os links e formulários reais', async () => {
  const login = await fetch(`${base}/pages/login.html`);
  assert.match(await login.text(), /href="\/pages\/cadastro.html"/);
  const registration = await fetch(`${base}/pages/cadastro.html`);
  assert.equal(registration.status, 200);
  const html = await registration.text();
  assert.match(html, /id="registration-form"/); assert.match(html, /name="confirmar_senha"/); assert.match(html, /id="aceite-termos"/);
  const account = await fetch(`${base}/pages/conta.html`);
  assert.equal(account.status, 200); assert.match(await account.text(), /id="account-content" hidden/);
});
