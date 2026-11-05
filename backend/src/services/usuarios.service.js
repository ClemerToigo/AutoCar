const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const database = require('../config/database');
const Usuario = require('../models/usuario.model');
const v = require('./validation');
const attributes = ['id', 'nome', 'login', 'cpf', 'telefone', 'tipo', 'ativo', 'versao', 'created_at', 'updated_at'];
function toPublic(row) {
  const data = row.get({ plain: true });
  return { id: data.id, nome: data.nome, email: data.login, cpf: data.cpf, telefone: data.telefone, tipo: data.tipo, ativo: data.ativo, versao: data.versao, created_at: data.created_at, updated_at: data.updated_at };
}
function validate(body, existing) {
  v.object(body);
  const data = {
    nome: v.text(body.nome, 'o nome completo', 255),
    login: v.text(body.email ?? body.login, 'o e-mail', 255).toLowerCase(),
    cpf: v.cpf(body.cpf), telefone: v.phone(body.telefone),
    tipo: v.option(body.tipo, ['ADMIN', 'USUARIO'], 'um tipo de usuário'),
    ativo: v.boolean(body.ativo, 'um status'),
  };
  if (!/^[^\s@]+@[^\s@]+$/.test(data.login)) v.fail('Informe um e-mail válido.');
  if (!existing || (body.senha !== undefined && body.senha !== '')) data.senha = v.password(body.senha);
  return data;
}
async function list(query) {
  const pagination = v.page(query, 5);
  const term = v.search(query.q);
  const where = {};
  if (term) where[Op.or] = [{ nome: { [Op.iLike]: `%${term}%` } }, { login: { [Op.iLike]: `%${term}%` } }];
  if (query.tipo) where.tipo = v.option(query.tipo, ['ADMIN', 'USUARIO'], 'um tipo de usuário');
  if (query.status) where.ativo = v.option(query.status, ['ATIVO', 'INATIVO'], 'um status') === 'ATIVO';
  const { rows, count } = await Usuario.findAndCountAll({ where, attributes, order: [['nome', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit });
  return v.result(rows.map(toPublic), count, pagination);
}
async function get(rawId) {
  const row = await Usuario.findByPk(v.integer(rawId, 'ID'), { attributes });
  if (!row) v.fail('Usuário não encontrado.', 404);
  return toPublic(row);
}
async function change(actorId, action) {
  // Serializa alterações administrativas para evitar que ações simultâneas removam todos os administradores.
  return database.transaction(async (transaction) => {
    await database.query('SELECT pg_advisory_xact_lock(18321, 1)', { transaction });
    const actor = await Usuario.findByPk(actorId, { transaction });
    if (!actor || !actor.ativo || actor.tipo !== 'ADMIN') v.fail('Acesso restrito a administradores.', 403);
    return action(transaction);
  });
}
async function create(body, actorId) {
  const data = validate(body);
  data.senha = await bcrypt.hash(data.senha, 12);
  return change(actorId, async (transaction) => toPublic(await Usuario.create(data, { transaction })));
}
async function update(rawId, body, actorId) {
  const id = v.integer(rawId, 'ID');
  v.object(body);
  return change(actorId, async (transaction) => {
    const row = await Usuario.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) v.fail('Usuário não encontrado.', 404);
    if (body.versao !== undefined && v.integer(body.versao, 'Versão', 0) !== row.versao) v.fail('Este usuário foi alterado por outra pessoa. Recarregue os dados antes de salvar.', 409);
    const data = validate(body, row);
    if (id === actorId && (!data.ativo || data.tipo !== 'ADMIN')) v.fail('Você não pode desativar sua própria conta nem remover seu perfil de administrador.', 409);
    const invalidate = Boolean(data.senha) || data.login !== row.login || data.tipo !== row.tipo || data.ativo !== row.ativo;
    if (data.senha) data.senha = await bcrypt.hash(data.senha, 12);
    await row.update({ ...data, versao: row.versao + 1, versao_sessao: row.versao_sessao + (invalidate ? 1 : 0) }, { transaction });
    return toPublic(row);
  });
}
async function remove(rawId, actorId) {
  const id = v.integer(rawId, 'ID');
  if (id === actorId) v.fail('Você não pode excluir sua própria conta de administrador.', 409);
  return change(actorId, async (transaction) => {
    const row = await Usuario.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) v.fail('Usuário não encontrado.', 404);
    await row.destroy({ transaction });
  });
}
module.exports = { list, get, create, update, remove };
