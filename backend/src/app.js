require('./config/env');
const express = require('express');
const cors = require('cors');
const path = require('node:path');

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  });
  next();
});
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '8kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use(express.static(path.resolve(__dirname, '../../frontend'), { dotfiles: 'deny' }));
app.use((req, res) => res.status(404).send('Página não encontrada.'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  if (status >= 500) console.error(`Erro no servidor: ${error.name}`);
  const message = error.type === 'entity.parse.failed' ? 'Envie um JSON válido.'
    : error.type === 'entity.too.large' ? 'Requisição muito grande.'
    : status >= 500 ? 'Não foi possível concluir a solicitação. Tente novamente.' : error.message;
  res.status(status).json({ message });
});

module.exports = app;
