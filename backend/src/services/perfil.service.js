const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const database = require('../config/database');
const Usuario = require('../models/usuario.model');
const v = require('./validation');

async function publicProfile(row, transaction) {
  const otherAdmins = row.tipo === 'ADMIN' ? await Usuario.count({ where: { tipo: 'ADMIN', ativo: true, id: { [Op.ne]: row.id } }, transaction }) : 1;
  return {
    id_usuario: row.id, nome: row.nome, email: row.login, cpf: row.cpf, telefone: row.telefone,
    tipo: row.tipo, ativo: row.ativo, versao: row.versao, created_at: row.created_at, updated_at: row.updated_at,
    pode_encerrar: otherAdmins > 0,
    motivo_bloqueio: otherAdmins > 0 ? null : 'Você é o último administrador ativo. Cadastre ou ative outro administrador antes de encerrar sua conta.',
  };
}

async function get(actorId) {
  const row = await Usuario.findByPk(actorId);
  if (!row || !row.ativo) v.fail('Sessão inválida. Entre novamente.', 401);
  return publicProfile(row);
}

function currentPassword(value) {
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > 72) v.fail('Informe sua senha atual.');
  return value;
}

async function change(actorId, body, action) {
  v.object(body);
  const password = currentPassword(body.senha_atual);
  const version = v.integer(body.versao, 'Versão', 0);
  return database.transaction(async (transaction) => {
    // Compartilha a trava das alterações administrativas para proteger o último administrador.
    await database.query('SELECT pg_advisory_xact_lock(18321, 1)', { transaction });
    const row = await Usuario.findByPk(actorId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row || !row.ativo) v.fail('Sessão inválida. Entre novamente.', 401);
    if (row.versao !== version) v.fail('Seus dados foram alterados. Recarregue a página antes de continuar.', 409);
    if (!await bcrypt.compare(password, row.senha)) v.fail('Senha atual incorreta.', 403);
    return action(row, transaction);
  });
}

async function update(actorId, body) {
  v.object(body);
  const nome = v.text(body.nome, 'o nome', 255);
  const email = v.text(body.email, 'o e-mail', 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) v.fail('Informe um e-mail válido.');
  const newPassword = body.nova_senha === undefined || body.nova_senha === '' ? null : v.password(body.nova_senha);
  if (newPassword && newPassword !== body.confirmar_senha) v.fail('A confirmação da nova senha não confere.');
  if (!newPassword && body.confirmar_senha) v.fail('Informe a nova senha antes de confirmá-la.');
  return change(actorId, body, async (row, transaction) => {
    const invalidate = email !== row.login || Boolean(newPassword);
    const data = { nome, login: email, versao: row.versao + 1, versao_sessao: row.versao_sessao + (invalidate ? 1 : 0) };
    if (newPassword) data.senha = await bcrypt.hash(newPassword, 12);
    await row.update(data, { transaction });
    return { usuario: await publicProfile(row, transaction), autenticar_novamente: invalidate };
  });
}

async function logoutAll(actorId, body) {
  return change(actorId, body, async (row, transaction) => {
    await row.update({ versao_sessao: row.versao_sessao + 1, versao: row.versao + 1 }, { transaction });
  });
}

async function close(actorId, body) {
  v.object(body);
  if (body.confirmacao !== 'ENCERRAR') v.fail('Digite ENCERRAR para confirmar o encerramento da conta.');
  return change(actorId, body, async (row, transaction) => {
    if (row.tipo === 'ADMIN' && !await Usuario.count({ where: { tipo: 'ADMIN', ativo: true, id: { [Op.ne]: row.id } }, transaction })) {
      v.fail('Não é possível encerrar a conta do último administrador ativo. Cadastre ou ative outro administrador primeiro.', 409);
    }
    await row.update({ ativo: false, versao: row.versao + 1, versao_sessao: row.versao_sessao + 1 }, { transaction });
  });
}

module.exports = { get, update, logoutAll, close };
