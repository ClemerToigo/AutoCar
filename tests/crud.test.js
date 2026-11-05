const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
if (!process.env.TEST_DATABASE_URL) throw new Error('Configure TEST_DATABASE_URL para executar os testes de integração.');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.SECRET = randomBytes(48).toString('hex');
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `autocar-crud-photos-${randomBytes(8).toString('hex')}`);
const database = require('../backend/src/config/database');
const schema = `autocar_crud_test_${randomBytes(8).toString('hex')}`;
database.options.define = { ...database.options.define, schema };
const Usuario = require('../backend/src/models/usuario.model');
const Marca = require('../backend/src/models/marca.model');
const Categoria = require('../backend/src/models/categoria.model');
const Veiculo = require('../backend/src/models/veiculo.model');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const config = require('../backend/src/config/env');
const app = require('../backend/src/app');
let server, base, admin, otherAdmin, client, adminToken, otherAdminToken, clientToken, brand, category, photo;
let counter = 0;
function cpf(prefix) { let value = prefix; for (let size = 9; size <= 10; size++) { let sum = 0; for (let i = 0; i < size; i++) sum += Number(value[i]) * (size + 1 - i); const digit = (sum * 10) % 11; value += digit === 10 ? '0' : String(digit); } return value; }
function userBody(overrides = {}) { const i = ++counter; return { nome: `Usuário de teste ${i}`, email: `pessoa${i}@autocar.local`, cpf: cpf(String(900000000 + i)), telefone: '11999991234', senha: 'senha-teste-123', tipo: 'USUARIO', ativo: true, ...overrides }; }
function vehicleBody(overrides = {}) { return { marca_id: brand.id, categoria_id: category.id, modelo: 'Modelo de integração', ano: 2024, quilometragem: 12500, preco: '178990.00', combustivel: 'Flex', cambio: 'Automático', cor: 'Preto', status: 'DISPONIVEL', descricao: 'Registro exclusivo para testes.', ...overrides }; }
function sign(user) { return jwt.sign({ id_usuario: user.id, versao_sessao: user.versao_sessao }, config.secret, { issuer: config.issuer, audience: config.audience, expiresIn: '1h' }); }
async function call(route, { method = 'GET', body, token = adminToken } = {}) {
  const response = await fetch(`${base}${route}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
  return { status: response.status, data: response.status === 204 ? null : await response.json(), response };
}
function multipart(data, main, gallery = []) { const form = new FormData(); for (const [key, value] of Object.entries(data)) form.set(key, String(value)); if (main) form.set('foto', new Blob([main], { type: 'image/png' }), 'principal.png'); for (const bytes of gallery) form.append('galeria', new Blob([bytes], { type: 'image/png' }), 'galeria.png'); return form; }
before(async () => {
  await database.createSchema(schema); await Usuario.sync(); await Marca.sync(); await Categoria.sync(); await Veiculo.sync();
  const hash = await bcrypt.hash('senha-admin-123', 12);
  admin = await Usuario.create({ nome: 'Admin Teste', login: 'admin@autocar.local', senha: hash, tipo: 'ADMIN' });
  otherAdmin = await Usuario.create({ nome: 'Outro Admin', login: 'outroadmin@autocar.local', senha: hash, tipo: 'ADMIN' });
  client = await Usuario.create({ nome: 'Cliente Teste', login: 'cliente@autocar.local', senha: hash, tipo: 'USUARIO' });
  adminToken = sign(admin); otherAdminToken = sign(otherAdmin); clientToken = sign(client);
  brand = await Marca.create({ nome: 'Marca de teste' }); category = await Categoria.create({ nome: 'SUV' });
  photo = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#ec0010' } }).png().toBuffer();
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  try { await database.dropSchema(schema, { cascade: true }); } finally { await database.close(); await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true }); }
});

test('todas as operações dos CRUDs exigem autenticação e perfil ADMIN', async () => {
  for (const resource of ['usuarios', 'veiculos']) for (const [method, suffix, body] of [['GET', '', null], ['GET', '/1', null], ['POST', '', {}], ['PUT', '/1', {}], ['DELETE', '/1', null]]) {
    assert.equal((await call(`/api/${resource}${suffix}`, { method, body, token: null })).status, 401);
    assert.equal((await call(`/api/${resource}${suffix}`, { method, body, token: clientToken })).status, 403);
  }
  assert.equal((await call('/api/veiculos/opcoes', { token: clientToken })).status, 403);
});
test('cria, consulta, filtra e pagina usuários sem retornar senha ou hash', async () => {
  const body = userBody({ nome: 'Pessoa pesquisável', email: '  PESSOA@AUTOCAR.LOCAL ' });
  const created = await call('/api/usuarios', { method: 'POST', body });
  assert.equal(created.status, 201); assert.equal(created.data.email, 'pessoa@autocar.local');
  assert.equal('senha' in created.data, false); assert.equal('versao_sessao' in created.data, false);
  const stored = await Usuario.findByPk(created.data.id); assert.notEqual(stored.senha, body.senha); assert.ok(await bcrypt.compare(body.senha, stored.senha));
  const fetched = await call(`/api/usuarios/${created.data.id}`); assert.equal(fetched.data.cpf, body.cpf);
  const list = await call('/api/usuarios?q=pesquis%C3%A1vel&tipo=USUARIO&status=ATIVO&limit=1');
  assert.equal(list.status, 200); assert.equal(list.data.total, 1); assert.equal(list.data.items[0].id, stored.id); assert.equal(list.data.pages, 1);
  assert.equal('senha' in list.data.items[0], false);
  assert.equal((await call('/api/usuarios?page=0')).status, 400);
  assert.equal((await call('/api/usuarios?tipo=ROOT')).status, 400);
});
test('valida CPF, telefone, e-mail, senha e duplicidades sem criar registros inválidos', async () => {
  for (const override of [{ cpf: '11111111111' }, { cpf: '12345678900' }, { telefone: '123' }, { email: 'invalido' }, { senha: 'curta' }, { senha: 'á'.repeat(37) }, { tipo: 'ROOT' }, { ativo: 'qualquer' }]) {
    assert.equal((await call('/api/usuarios', { method: 'POST', body: userBody(override) })).status, 400);
  }
  const body = userBody(); assert.equal((await call('/api/usuarios', { method: 'POST', body })).status, 201);
  assert.equal((await call('/api/usuarios', { method: 'POST', body: userBody({ email: body.email }) })).status, 409);
  assert.equal((await call('/api/usuarios', { method: 'POST', body: userBody({ cpf: body.cpf }) })).status, 409);
});
test('edita usuário preservando senha em branco e rejeita edição de versão antiga', async () => {
  const body = userBody(); const created = (await call('/api/usuarios', { method: 'POST', body })).data;
  const oldHash = (await Usuario.findByPk(created.id)).senha;
  const updated = await call(`/api/usuarios/${created.id}`, { method: 'PUT', body: { ...body, nome: 'Nome atualizado', senha: '', versao: created.versao } });
  assert.equal(updated.status, 200); assert.equal(updated.data.versao, 1); assert.equal(updated.data.nome, 'Nome atualizado');
  assert.equal((await Usuario.findByPk(created.id)).senha, oldHash);
  assert.equal((await call(`/api/usuarios/${created.id}`, { method: 'PUT', body: { ...body, versao: 0 } })).status, 409);
});
test('nova senha revoga o JWT anterior e a conta inativa não consegue entrar', async () => {
  const body = userBody(); const created = (await call('/api/usuarios', { method: 'POST', body })).data;
  const oldToken = sign(await Usuario.findByPk(created.id));
  assert.equal((await call(`/api/usuarios/${created.id}`, { method: 'PUT', body: { ...body, senha: 'outra-senha-123' } })).status, 200);
  assert.equal((await call('/api/auth/me', { token: oldToken })).status, 401);
  const newLogin = await call('/api/auth/login', { method: 'POST', body: { login: body.email, senha: 'outra-senha-123' }, token: null });
  assert.equal(newLogin.status, 200);
  assert.equal((await call(`/api/usuarios/${created.id}`, { method: 'PUT', body: { ...body, senha: '', ativo: false } })).status, 200);
  assert.equal((await call('/api/auth/me', { token: newLogin.data.token })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { login: body.email, senha: 'outra-senha-123' }, token: null })).status, 401);
});
test('impede excluir, desativar ou rebaixar a própria conta administradora', async () => {
  assert.equal((await call(`/api/usuarios/${admin.id}`, { method: 'DELETE' })).status, 409);
  for (const override of [{ ativo: false }, { tipo: 'USUARIO' }]) {
    assert.equal((await call(`/api/usuarios/${admin.id}`, { method: 'PUT', body: userBody({ nome: admin.nome, email: admin.login, ...override }) })).status, 409);
  }
  assert.equal((await call('/api/auth/me')).status, 200);
});
test('exclui outro usuário e retorna 404 quando o registro não existe', async () => {
  const created = (await call('/api/usuarios', { method: 'POST', body: userBody() })).data;
  assert.equal((await call(`/api/usuarios/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/api/usuarios/${created.id}`)).status, 404);
  assert.equal((await call('/api/usuarios/abc')).status, 400);
  assert.equal((await call('/api/usuarios/2147483647', { method: 'DELETE' })).status, 404);
});
test('oferece marcas e categorias cadastradas para preencher os veículos', async () => {
  const result = await call('/api/veiculos/opcoes'); assert.equal(result.status, 200);
  assert.equal(result.data.marcas[0].id, brand.id); assert.equal(result.data.categorias[0].id, category.id);
});
test('cria e lista veículo com associações, preço decimal e filtros reais', async () => {
  const created = await call('/api/veiculos', { method: 'POST', body: vehicleBody({ modelo: 'Modelo pesquisável' }) });
  assert.equal(created.status, 201); assert.equal(created.data.preco, '178990.00'); assert.equal(created.data.marca.nome, brand.nome); assert.deepEqual(created.data.galeria, []);
  const result = await call(`/api/veiculos?q=pesquis%C3%A1vel&marca_id=${brand.id}&categoria_id=${category.id}&status=DISPONIVEL&limit=1`);
  assert.equal(result.status, 200); assert.equal(result.data.total, 1); assert.equal(result.data.items[0].id, created.data.id);
  assert.equal((await call('/api/veiculos?q=Marca%20de%20teste')).status, 200);
  const literal = await call('/api/veiculos?q=%25'); assert.equal(literal.data.total, 0);
});
test('rejeita veículos inválidos e referências que não existem no banco', async () => {
  for (const override of [{ modelo: '' }, { marca_id: 2147483647 }, { categoria_id: 2147483647 }, { ano: 1800 }, { ano: new Date().getFullYear() + 2 }, { quilometragem: -1 }, { preco: '1.999' }, { preco: 0 }, { status: 'OUTRO' }, { cambio: 'OUTRO' }, { combustivel: 'OUTRO' }]) {
    assert.equal((await call('/api/veiculos', { method: 'POST', body: vehicleBody(override) })).status, 400);
  }
  assert.equal((await call('/api/veiculos?limit=1000')).status, 400);
});
test('altera e exclui veículos e detecta concorrência na edição', async () => {
  const created = (await call('/api/veiculos', { method: 'POST', body: vehicleBody() })).data;
  const updated = await call(`/api/veiculos/${created.id}`, { method: 'PUT', body: vehicleBody({ status: 'VENDIDO', preco: '150000.50', versao: created.versao }) });
  assert.equal(updated.status, 200); assert.equal(updated.data.preco, '150000.50'); assert.equal(updated.data.versao, 1);
  assert.equal((await call(`/api/veiculos/${created.id}`, { method: 'PUT', body: vehicleBody({ versao: 0 }) })).status, 409);
  assert.equal((await call(`/api/veiculos/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await call(`/api/veiculos/${created.id}`)).status, 404);
});
test('dashboard informa os totais reais de veículos e clientes', async () => {
  const result = await call('/api/painel');
  assert.equal(result.status, 200);
  assert.equal(result.data.total, await Veiculo.count());
  assert.equal(result.data.disponiveis, await Veiculo.count({ where: { status: 'DISPONIVEL' } }));
  assert.equal(result.data.clientes, await Usuario.count({ where: { tipo: 'USUARIO' } }));
  assert.ok(result.data.recentes.length <= 4);
  assert.equal((await call('/api/painel', { token: null })).status, 401);
  assert.equal((await call('/api/painel', { token: clientToken })).status, 403);
});

test('recebe fotos reais, converte para WEBP, preserva galeria e limpa ao excluir', async () => {
  const created = await call('/api/veiculos', { method: 'POST', body: multipart(vehicleBody(), photo, [photo]) });
  assert.equal(created.status, 201); assert.match(created.data.foto, /^\/media\/[a-f0-9-]{36}\.webp$/); assert.equal(created.data.galeria.length, 1);
  const media = await fetch(`${base}${created.data.foto}`); assert.equal(media.status, 200); assert.match(media.headers.get('content-type'), /image\/webp/);
  const metadata = await sharp(Buffer.from(await media.arrayBuffer())).metadata(); assert.equal(metadata.format, 'webp');
  const updated = await call(`/api/veiculos/${created.data.id}`, { method: 'PUT', body: multipart(vehicleBody({ remover_foto: 'true', galeria_manter: '[]' }), null, [photo]) });
  assert.equal(updated.status, 200); assert.equal(updated.data.foto, null); assert.equal(updated.data.galeria.length, 1);
  assert.equal((await fetch(`${base}${created.data.foto}`)).status, 404);
  assert.equal((await fetch(`${base}${created.data.galeria[0]}`)).status, 404);
  assert.equal((await call(`/api/veiculos/${created.data.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${base}${updated.data.galeria[0]}`)).status, 404);
});
test('rejeita imagens falsas, arquivos grandes e referências de fotos de outro registro', async () => {
  assert.equal((await call('/api/veiculos', { method: 'POST', body: multipart(vehicleBody(), Buffer.from('<script>alert(1)</script>')) })).status, 400);
  assert.equal((await call('/api/veiculos', { method: 'POST', body: multipart(vehicleBody(), Buffer.alloc(5 * 1024 * 1024 + 1)) })).status, 413);
  assert.equal((await call('/api/veiculos', { method: 'POST', body: vehicleBody({ galeria_manter: ['/media/00000000-0000-0000-0000-000000000000.webp'] }) })).status, 400);
});
test('alterações simultâneas de administradores não removem todos os acessos administrativos', async () => {
  const results = await Promise.all([
    call(`/api/usuarios/${otherAdmin.id}`, { method: 'DELETE', token: adminToken }),
    call(`/api/usuarios/${admin.id}`, { method: 'DELETE', token: otherAdminToken }),
  ]);
  assert.equal(results.filter((result) => result.status === 204).length, 1);
  assert.equal(await Usuario.count({ where: { tipo: 'ADMIN', ativo: true } }), 1);
});
