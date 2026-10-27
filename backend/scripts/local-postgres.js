// Banco de desenvolvimento opcional, isolado dentro de AutoCar/.local.
// Usa os executáveis oficiais de uma instalação local do PostgreSQL.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    throw new Error('Este comando é somente para desenvolvimento local com os campos DB_*.');
  }
  if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) throw new Error('DB_HOST deve ser local.');
  const port = Number(process.env.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DB_PORT inválido.');
  const name = process.env.DB_NAME || 'autocar';
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(name)) throw new Error('DB_NAME deve conter apenas letras, números e sublinhado.');
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  if (!user || !password) throw new Error('Defina DB_USER e DB_PASSWORD em backend/.env.');
  const bin = process.env.PG_BIN || execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim();
  const local = path.resolve(__dirname, '../../.local');
  const data = path.join(local, 'postgres');
  const socket = path.join(local, 'socket');
  fs.mkdirSync(socket, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(local, `.postgres-password-${process.pid}`);
    try {
      fs.writeFileSync(passwordFile, password, { mode: 0o600, flag: 'wx' });
      execFileSync(path.join(bin, 'initdb'), ['-D', data, '--username', user, '--pwfile', passwordFile, '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--encoding=UTF8', '--no-locale'], { stdio: 'inherit' });
    } finally {
      if (fs.existsSync(passwordFile)) fs.unlinkSync(passwordFile);
    }
  }
  const pgctl = path.join(bin, 'pg_ctl');
  if (spawnSync(pgctl, ['-D', data, 'status'], { stdio: 'ignore' }).status !== 0) {
    const quotedSocket = `'${socket.replace(/'/g, "'\\''")}'`;
    execFileSync(pgctl, ['-D', data, '-l', path.join(local, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${quotedSocket}`, '-w', 'start'], { stdio: 'inherit' });
  }
  const client = new Client({ host: '127.0.0.1', port, user, password, database: 'postgres' });
  try {
    await client.connect();
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!result.rowCount) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  console.log(`PostgreSQL local pronto na porta ${port}; banco ${name}.`);
}

main().catch((error) => { console.error(`Não foi possível iniciar o PostgreSQL local: ${error.message}`); process.exitCode = 1; });
