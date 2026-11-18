const express = require('express');
const { rateLimit } = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const verifyJWT = require('../middlewares/auth.middleware');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de cadastro. Tente novamente em uma hora.' },
});
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de alteração da conta. Aguarde 15 minutos e tente novamente.' },
});

router.post('/login', loginLimiter, controller.login);
router.post('/register', registerLimiter, controller.register);
router.get('/me', verifyJWT, controller.me);
router.get('/profile', verifyJWT, controller.profile);
router.put('/profile', verifyJWT, accountLimiter, controller.updateProfile);
router.post('/logout-all', verifyJWT, accountLimiter, controller.logoutAll);
router.post('/close-account', verifyJWT, accountLimiter, controller.closeAccount);

module.exports = router;
