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
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  });
  next();
});
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '8kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/painel', require('./routes/painel.routes'));
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/veiculos', require('./routes/veiculos.routes'));
app.get('/media/:filename', (req, res, next) => {
  if (!/^[a-f0-9-]{36}\.webp$/.test(req.params.filename)) return res.status(404).end();
  res.sendFile(req.params.filename, { root: require('./services/vehicle-photos').directory, maxAge: '1d', immutable: true }, (error) => { if (error) { if (error.status === 404) res.status(404).end(); else next(error); } });
});
app.use('/api', (req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
app.use(express.static(path.resolve(__dirname, '../../frontend'), { dotfiles: 'deny' }));
app.use((req, res) => res.status(404).send('Página não encontrada.'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const isUpload = error.name === 'MulterError';
  const status = error.status || (isUpload ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : error.name === 'SequelizeUniqueConstraintError' ? 409 : error.name === 'SequelizeForeignKeyConstraintError' ? 409 : error.name === 'SequelizeValidationError' ? 400 : 500);
  if (status >= 500) console.error(`Erro no servidor: ${error.name}`);
  const message = isUpload ? (error.code === 'LIMIT_FILE_SIZE' ? 'Cada foto pode ter no máximo 5 MB.' : 'Envie uma foto principal e até 6 fotos na galeria.')
    : error.name === 'SequelizeUniqueConstraintError' ? 'Já existe um usuário com esse e-mail ou CPF.'
    : error.name === 'SequelizeForeignKeyConstraintError' ? 'Não foi possível concluir: há registros vinculados ou uma opção não existe.'
    : error.name === 'SequelizeValidationError' ? 'Confira os dados informados.'
    : error.type === 'entity.parse.failed' ? 'Envie um JSON válido.'
    : error.type === 'entity.too.large' ? 'Requisição muito grande.'
    : status >= 500 ? 'Não foi possível concluir a solicitação. Tente novamente.' : error.message;
  res.status(status).json({ message });
});

module.exports = app;
