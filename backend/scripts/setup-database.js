const fs = require('node:fs/promises');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const database = require('../src/config/database');
const Usuario = require('../src/models/usuario.model');

async function setupDatabase() {
  const login = (process.env.ADMIN_SEED_LOGIN || '').trim().toLowerCase();
  const senha = process.env.ADMIN_SEED_PASSWORD;
  if (!login || typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha) > 72) {
    throw new Error('Configure ADMIN_SEED_LOGIN e ADMIN_SEED_PASSWORD (8 a 72 bytes) no backend/.env.');
  }
  if (process.env.NODE_ENV === 'production' && senha === 'admin123') {
    throw new Error('Defina uma senha própria para o administrador em produção.');
  }
  await database.authenticate();
  const schema = await fs.readFile(path.resolve(__dirname, '../../database/schema.sql'), 'utf8');
  await database.transaction(async (transaction) => {
    await database.query(schema, { transaction });
    const [, created] = await Usuario.findOrCreate({
      where: { login },
      defaults: {
        nome: process.env.ADMIN_SEED_NOME || 'Administrador',
        senha: await bcrypt.hash(senha, 12),
        tipo: 'ADMIN',
      },
      transaction,
    });
    console.log(created ? 'Tabela de usuários pronta. Administrador criado.' : 'Tabela de usuários pronta. Usuário existente preservado, incluindo a senha.');
  });
}

if (require.main === module) {
  setupDatabase().catch((error) => {
    console.error(`Não foi possível preparar o banco: ${error.message}`);
    process.exitCode = 1;
  }).finally(() => database.close());
}

module.exports = setupDatabase;
