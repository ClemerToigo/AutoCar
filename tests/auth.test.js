const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Configure TEST_DATABASE_URL com um PostgreSQL de testes. Consulte o README.');
}
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SECRET = randomBytes(48).toString('hex');
const database = require('../backend/src/config/database');
const schema = `autocar_auth_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../backend/src/config/env');
const app = require('../backend/src/app');
let server;
let base;
let token;
let user;

async function login(body) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

before(async () => {
  await database.createSchema(schema);
  await Usuario.sync();
  user = await Usuario.create({ nome: 'Pessoa de Teste', login: 'teste@autocar.local', senha: await bcrypt.hash('senha-teste-123', 12), tipo: 'ADMIN' });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); }
});

test('login normaliza o e-mail, compara bcrypt e retorna JWT sem revelar senha', async () => {
  const response = await login({ login: '  TESTE@AUTOCAR.LOCAL ', senha: 'senha-teste-123' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const data = await response.json();
  token = data.token;
  assert.equal(data.id_usuario, user.id);
  assert.equal(data.nome, 'Pessoa de Teste');
  assert.equal(data.token_type, 'Bearer');
  assert.equal('senha' in data, false);
  assert.notEqual(user.senha, 'senha-teste-123');
  const decoded = jwt.verify(token, config.secret, { algorithms: ['HS256'], issuer: config.issuer, audience: config.audience });
  assert.equal(decoded.id_usuario, user.id);
  assert.ok(decoded.exp > decoded.iat);
});

test('aceita o campo email da mesma forma que o projeto de referência', async () => {
  assert.equal((await login({ email: user.login, senha: 'senha-teste-123' })).status, 200);
});

test('rejeita campos ausentes, objetos e senhas maiores que o limite de bcrypt', async () => {
  for (const body of [{}, { login: [] }, { login: { $ne: null }, senha: '12345678' }, { login: user.login, senha: {} }, { login: user.login, senha: 'á'.repeat(37) }]) {
    const response = await login(body);
    assert.equal(response.status, 400);
    assert.equal('token' in await response.json(), false);
  }
});

test('credenciais incorretas têm a mesma resposta para usuário inexistente e senha errada', async () => {
  const wrong = await login({ login: user.login, senha: 'incorreta' });
  const unknown = await login({ login: 'naoexiste@autocar.local', senha: 'incorreta' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(await wrong.json(), await unknown.json());
});

test('/me exige Bearer e rejeita JWT adulterado, expirado ou de outra aplicação', async () => {
  const sign = (payload, options = {}) => jwt.sign(payload, config.secret, { issuer: config.issuer, audience: config.audience, ...options });
  const invalid = [null, token, 'Bearer invalido', `Bearer ${token.slice(0, -5)}xxxxx`,
    `Bearer ${sign({ id_usuario: user.id }, { expiresIn: -1 })}`,
    `Bearer ${sign({ id_usuario: user.id }, { issuer: 'outra-aplicacao' })}`,
    `Bearer ${sign({ id_usuario: '1' })}`];
  for (const authorization of invalid) {
    const response = await fetch(`${base}/api/auth/me`, { headers: authorization ? { Authorization: authorization } : {} });
    assert.equal(response.status, 401);
  }
});

test('/me carrega os dados atuais do banco e não retorna hash ou token', async () => {
  await user.update({ tipo: 'USUARIO' });
  const response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id_usuario: user.id, nome: user.nome, login: user.login, tipo: 'USUARIO' });
});

test('uma conta removida deixa de autenticar com um token ainda válido', async () => {
  const removed = await Usuario.create({ nome: 'Removido', login: 'removido@autocar.local', senha: user.senha });
  const removedToken = jwt.sign({ id_usuario: removed.id }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' });
  await removed.destroy();
  const response = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${removedToken}` } });
  assert.equal(response.status, 401);
});

test('trata JSON inválido e não expõe arquivos do backend ou da referência', async () => {
  const invalid = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalido' });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { message: 'Envie um JSON válido.' });
  for (const path of ['/.env', '/backend/.env', '/desenvweb2026/backend/package.json']) {
    assert.equal((await fetch(`${base}${path}`)).status, 404);
  }
  const page = await fetch(`${base}/pages/login.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /login-form/);
  assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});

test('limita tentativas repetidas de login sem entregar token', async () => {
  let response;
  for (let i = 0; i < 12; i++) {
    response = await login({ login: user.login, senha: 'incorreta' });
    if (response.status === 429) break;
  }
  assert.equal(response.status, 429);
  assert.equal('token' in await response.json(), false);
  assert.ok(response.headers.get('retry-after'));
});
