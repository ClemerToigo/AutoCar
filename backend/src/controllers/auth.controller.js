const authService = require('../services/auth.service');
const profileService = require('../services/perfil.service');

async function login(req, res, next) {
  try {
    res.json(await authService.login(req.body));
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json(req.user);
}

async function register(req, res, next) {
  try {
    res.status(201).json(await authService.register(req.body));
  } catch (error) {
    next(error);
  }
}

const profile = async (req, res) => res.json(await profileService.get(req.user.id_usuario));
const updateProfile = async (req, res) => res.json(await profileService.update(req.user.id_usuario, req.body));
const logoutAll = async (req, res) => { await profileService.logoutAll(req.user.id_usuario, req.body); res.status(204).end(); };
const closeAccount = async (req, res) => { await profileService.close(req.user.id_usuario, req.body); res.status(204).end(); };

module.exports = { login, register, me, profile, updateProfile, logoutAll, closeAccount };
