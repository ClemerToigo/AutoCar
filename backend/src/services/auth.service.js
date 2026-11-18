const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');
const config = require('../config/env');
const v = require('./validation');

// O mesmo custo de comparação é aplicado quando o login não existe.
const dummyHash = bcrypt.hashSync('autocar-validacao-interna', 12);

function publicUser(usuario) {
  return { id_usuario: usuario.id, nome: usuario.nome, login: usuario.login, tipo: usuario.tipo };
}

async function login(body = {}) {
  const identifier = body?.login ?? body?.email;
  const senha = body?.senha;
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 255 ||
      typeof senha !== 'string' || !senha.length || Buffer.byteLength(senha) > 72) {
    const error = new Error('Informe um e-mail e uma senha válidos.');
    error.status = 400;
    throw error;
  }
  const usuario = await Usuario.findOne({ where: { login: identifier.trim().toLowerCase() } });
  const senhaValida = await bcrypt.compare(senha, usuario?.senha || dummyHash);
  if (!usuario || !usuario.ativo || !senhaValida) {
    const error = new Error('E-mail ou senha inválidos.');
    error.status = 401;
    throw error;
  }
  const user = publicUser(usuario);
  const token = jwt.sign({ ...user, versao_sessao: usuario.versao_sessao }, config.secret, {
    algorithm: 'HS256', expiresIn: config.expiresIn, issuer: config.issuer, audience: config.audience,
  });
  return { token_type: 'Bearer', token, ...user };
}

async function register(body) {
  v.object(body);
  const nome = v.text(body.nome, 'o nome completo', 255);
  const email = v.text(body.email, 'o e-mail', 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) v.fail('Informe um e-mail válido.');
  const cpf = v.cpf(body.cpf);
  const telefone = v.phone(body.telefone);
  const senha = v.password(body.senha);
  if (senha !== body.confirmar_senha) v.fail('As senhas não conferem.');
  if (body.aceite_termos !== true) v.fail('Leia e aceite os termos de uso e a política de privacidade para continuar.');
  // O cadastro público permite somente contas de cliente. Perfil e status não vêm da requisição.
  const usuario = await Usuario.create({
    nome, login: email, cpf, telefone, senha: await bcrypt.hash(senha, 12),
    tipo: 'USUARIO', ativo: true, termos_aceitos_em: new Date(), versao_termos: '1',
  });
  return publicUser(usuario);
}

module.exports = { login, register, publicUser };
