const authService = require('../services/auth.service');

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

module.exports = { login, me };
