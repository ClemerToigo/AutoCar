const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/usuario.model');
const config = require('../config/env');

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
  if (!usuario || !senhaValida) {
    const error = new Error('E-mail ou senha inválidos.');
    error.status = 401;
    throw error;
  }
  const user = publicUser(usuario);
  const token = jwt.sign(user, config.secret, {
    algorithm: 'HS256', expiresIn: config.expiresIn, issuer: config.issuer, audience: config.audience,
  });
  return { token_type: 'Bearer', token, ...user };
}

module.exports = { login, publicUser };
