const app = require('./app');
const database = require('./config/database');

async function start() {
  await database.authenticate();
  // Verifica a instalação sem criar ou modificar tabelas na inicialização.
  await database.query('SELECT id, nome, login, senha, tipo FROM usuarios LIMIT 0');
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`AutoCar disponível em http://${host}:${port}`));
  const shutdown = () => server.close(() => database.close().then(() => process.exit(0)));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.on('error', (error) => {
    console.error(`Não foi possível iniciar o servidor: ${error.message}`);
    database.close().finally(() => { process.exitCode = 1; });
  });
}

start().catch((error) => {
  console.error(`Não foi possível iniciar o AutoCar: ${error.message}. Verifique o PostgreSQL e execute npm run db:setup.`);
  database.close().finally(() => { process.exitCode = 1; });
});
