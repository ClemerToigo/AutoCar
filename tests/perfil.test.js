const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');

if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para testar perfil e configurações.');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; process.env.SECRET = randomBytes(48).toString('hex');
const database = require('../backend/src/config/database');
const schema = `autocar_perfil_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const app = require('../backend/src/app');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../backend/src/config/env');
let server, base, admin, otherAdmin, client, otherClient, hash;
const password = 'senha-perfil-123';
const sign = (row) => jwt.sign({ id_usuario: row.id, versao_sessao: row.versao_sessao }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h', jwtid: randomBytes(8).toString('hex') });
const changeBody = (row, overrides = {}) => ({ nome: row.nome, email: row.login, senha_atual: password, versao: row.versao, ...overrides });
async function call(route, { method = 'GET', body, token = sign(admin) } = {}) {
  const response = await fetch(`${base}/api${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
const login = (email, senha) => call('/auth/login', { method: 'POST', token: null, body: { email, senha } });
before(async () => {
  await database.createSchema(schema); await database.sync(); hash = await bcrypt.hash(password, 12);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await Usuario.destroy({ where: {} });
  admin = await Usuario.create({ nome: 'Admin Perfil', login: 'admin@perfil.local', senha: hash, tipo: 'ADMIN' });
  otherAdmin = await Usuario.create({ nome: 'Outro Admin', login: 'outro@perfil.local', senha: hash, tipo: 'ADMIN' });
  client = await Usuario.create({ nome: 'Cliente Perfil', login: 'cliente@perfil.local', senha: hash, tipo: 'USUARIO' });
  otherClient = await Usuario.create({ nome: 'Outro Cliente', login: 'outro-cliente@perfil.local', senha: hash, tipo: 'USUARIO' });
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); }
});

test('perfil e ações da conta exigem autenticação', async () => {
  for (const [route, method] of [['/auth/profile', 'GET'], ['/auth/profile', 'PUT'], ['/auth/logout-all', 'POST'], ['/auth/close-account', 'POST']]) {
    assert.equal((await call(route, { method, body: method === 'GET' ? undefined : {}, token: null })).status, 401);
  }
});

test('consulta somente os próprios dados e não retorna senha ou versão da sessão', async () => {
  const result = await call(`/auth/profile?id=${otherClient.id}`, { token: sign(client) });
  assert.equal(result.status, 200); assert.equal(result.data.id_usuario, client.id); assert.equal(result.data.email, client.login);
  assert.equal(result.data.pode_encerrar, true); assert.equal(result.data.versao, 0);
  for (const key of ['senha', 'versao_sessao', 'token']) assert.equal(key in result.data, false);
});

test('altera nome do administrador sem exigir CPF legado e preserva o acesso', async () => {
  const token = sign(admin);
  const response = await call('/auth/profile', { method: 'PUT', token, body: changeBody(admin, { nome: '  Novo Nome  ' }) });
  assert.equal(response.status, 200); assert.equal(response.data.usuario.nome, 'Novo Nome'); assert.equal(response.data.autenticar_novamente, false);
  const me = await call('/auth/me', { token }); assert.equal(me.status, 200); assert.equal(me.data.nome, 'Novo Nome');
  await admin.reload(); assert.equal(admin.cpf, null); assert.equal(admin.senha, hash); assert.equal(admin.versao, 1);
});

test('senha atual incorreta ou ausente não altera os dados nem invalida o token', async () => {
  const token = sign(admin);
  for (const [senha_atual, status] of [['incorreta', 403], ['', 400]]) {
    assert.equal((await call('/auth/profile', { method: 'PUT', token, body: changeBody(admin, { nome: 'Não salvar', senha_atual }) })).status, status);
  }
  await admin.reload(); assert.equal(admin.nome, 'Admin Perfil'); assert.equal(admin.versao, 0); assert.equal(admin.senha, hash);
  assert.equal((await call('/auth/me', { token })).status, 200);
});

test('valida campos, nova senha, confirmação e versão do registro', async () => {
  for (const overrides of [{ nome: '' }, { email: 'invalido' }, { nova_senha: 'curta', confirmar_senha: 'curta' }, { nova_senha: 'á'.repeat(37), confirmar_senha: 'á'.repeat(37) }, { nova_senha: 'senha-nova-123', confirmar_senha: 'diferente' }, { confirmar_senha: 'sem-nova-senha' }, { versao: undefined }]) {
    assert.equal((await call('/auth/profile', { method: 'PUT', body: changeBody(admin, overrides) })).status, 400);
  }
  await admin.reload(); assert.equal(admin.senha, hash); assert.equal(admin.versao, 0);
});

test('e-mail duplicado e atualização antiga preservam os dados existentes', async () => {
  assert.equal((await call('/auth/profile', { method: 'PUT', body: changeBody(admin, { email: otherAdmin.login }) })).status, 409);
  assert.equal((await call('/auth/profile', { method: 'PUT', body: changeBody(admin, { nome: 'Nome atualizado' }) })).status, 200);
  assert.equal((await call('/auth/profile', { method: 'PUT', body: changeBody(admin, { nome: 'Versão antiga' }) })).status, 409);
  await admin.reload(); assert.equal(admin.nome, 'Nome atualizado'); assert.equal(admin.login, 'admin@perfil.local');
});

test('cliente não escolhe id, perfil, CPF ou status pela atualização do próprio perfil', async () => {
  const response = await call('/auth/profile', { method: 'PUT', token: sign(client), body: changeBody(client, { id: otherClient.id, id_usuario: admin.id, tipo: 'ADMIN', ativo: false, cpf: 'qualquer', nome: 'Meu novo nome' }) });
  assert.equal(response.status, 200); assert.equal(response.data.usuario.id_usuario, client.id); assert.equal(response.data.usuario.tipo, 'USUARIO');
  await client.reload(); await otherClient.reload(); assert.equal(client.ativo, true); assert.equal(client.cpf, null); assert.equal(otherClient.nome, 'Outro Cliente');
});

test('troca de e-mail normaliza o endereço e revoga as sessões anteriores', async () => {
  const token = sign(admin), otherSession = sign(admin);
  const response = await call('/auth/profile', { method: 'PUT', token, body: changeBody(admin, { email: '  NOVO@PERFIL.LOCAL  ' }) });
  assert.equal(response.status, 200); assert.equal(response.data.usuario.email, 'novo@perfil.local'); assert.equal(response.data.autenticar_novamente, true);
  assert.equal((await call('/auth/me', { token })).status, 401); assert.equal((await call('/auth/me', { token: otherSession })).status, 401);
  assert.equal((await login('novo@perfil.local', password)).status, 200); assert.equal((await login(admin.login, password)).status, 401);
});

test('troca de senha usa bcrypt, revoga sessões e aceita somente a nova senha', async () => {
  const token = sign(admin);
  const response = await call('/auth/profile', { method: 'PUT', token, body: changeBody(admin, { nova_senha: 'nova-senha-456', confirmar_senha: 'nova-senha-456' }) });
  assert.equal(response.status, 200); assert.equal(response.data.autenticar_novamente, true);
  await admin.reload(); assert.notEqual(admin.senha, hash); assert.ok(await bcrypt.compare('nova-senha-456', admin.senha));
  assert.equal((await call('/auth/me', { token })).status, 401);
  assert.equal((await login(admin.login, password)).status, 401); assert.equal((await login(admin.login, 'nova-senha-456')).status, 200);
});

test('encerrar todas as sessões exige a senha e mantém a conta ativa', async () => {
  const token = sign(client), otherSession = sign(client);
  assert.equal((await call('/auth/logout-all', { method: 'POST', token, body: { versao: 0, senha_atual: 'incorreta' } })).status, 403);
  assert.equal((await call('/auth/logout-all', { method: 'POST', token, body: { versao: 0, senha_atual: password } })).status, 204);
  assert.equal((await call('/auth/me', { token })).status, 401); assert.equal((await call('/auth/me', { token: otherSession })).status, 401);
  await client.reload(); assert.equal(client.ativo, true); assert.equal((await login(client.login, password)).status, 200);
});

test('encerramento exige confirmação e senha, desativa só a própria conta e preserva o registro', async () => {
  const token = sign(client);
  assert.equal((await call('/auth/close-account', { method: 'POST', token, body: { senha_atual: password, versao: 0, confirmacao: 'outra' } })).status, 400);
  assert.equal((await call('/auth/close-account', { method: 'POST', token, body: { senha_atual: 'incorreta', versao: 0, confirmacao: 'ENCERRAR' } })).status, 403);
  assert.equal((await call('/auth/close-account', { method: 'POST', token, body: { senha_atual: password, versao: 0, confirmacao: 'ENCERRAR', id: admin.id } })).status, 204);
  await client.reload(); await admin.reload(); assert.equal(client.ativo, false); assert.equal(client.senha, hash); assert.equal(admin.ativo, true);
  assert.equal((await call('/auth/me', { token })).status, 401); assert.equal((await login(client.login, password)).status, 401);
});

test('último administrador não pode encerrar sua conta', async () => {
  await otherAdmin.destroy();
  const profile = await call('/auth/profile'); assert.equal(profile.data.pode_encerrar, false); assert.ok(profile.data.motivo_bloqueio.includes('último administrador'));
  const response = await call('/auth/close-account', { method: 'POST', body: { senha_atual: password, versao: 0, confirmacao: 'ENCERRAR' } });
  assert.equal(response.status, 409); await admin.reload(); assert.equal(admin.ativo, true);
});

test('encerramentos simultâneos preservam um administrador ativo', async () => {
  const responses = await Promise.all([admin, otherAdmin].map((row) => call('/auth/close-account', { method: 'POST', token: sign(row), body: { senha_atual: password, versao: 0, confirmacao: 'ENCERRAR' } })));
  assert.deepEqual(responses.map((response) => response.status).sort(), [204, 409]);
  assert.equal(await Usuario.count({ where: { tipo: 'ADMIN', ativo: true } }), 1);
});

test('encerrar a própria conta em paralelo com excluir outro administrador não elimina todos os administradores', async () => {
  const token = sign(admin);
  const responses = await Promise.all([
    call('/auth/close-account', { method: 'POST', token, body: { senha_atual: password, versao: 0, confirmacao: 'ENCERRAR' } }),
    call(`/usuarios/${otherAdmin.id}`, { method: 'DELETE', token }),
  ]);
  assert.equal(responses.filter((response) => response.status === 204).length, 1);
  assert.equal(await Usuario.count({ where: { tipo: 'ADMIN', ativo: true } }), 1);
});
