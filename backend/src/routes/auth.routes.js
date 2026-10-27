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

router.post('/login', loginLimiter, controller.login);
router.get('/me', verifyJWT, controller.me);

module.exports = router;
