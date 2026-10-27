const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Usuario = require('../models/usuario.model');
const { publicUser } = require('../services/auth.service');

async function verifyJWT(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ message: 'Entre na sua conta para continuar.' });
  let decoded;
  try {
    decoded = jwt.verify(match[1], config.secret, {
      algorithms: ['HS256'], issuer: config.issuer, audience: config.audience,
    });
  } catch {
    return res.status(401).json({ message: 'Sua sessão expirou. Entre novamente.' });
  }
  if (!Number.isInteger(decoded.id_usuario) || decoded.id_usuario < 1) {
    return res.status(401).json({ message: 'Sessão inválida. Entre novamente.' });
  }
  try {
    const usuario = await Usuario.findByPk(decoded.id_usuario, { attributes: ['id', 'nome', 'login', 'tipo'] });
    if (!usuario) return res.status(401).json({ message: 'Sessão inválida. Entre novamente.' });
    req.user = publicUser(usuario);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = verifyJWT;
