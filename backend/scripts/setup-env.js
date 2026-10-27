const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const destination = path.resolve(__dirname, '../.env');
if (fs.existsSync(destination) && fs.readFileSync(destination, 'utf8').trim()) {
  console.log('backend/.env já configurado. Nenhum valor foi alterado.');
} else {
  const template = fs.readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8');
  fs.writeFileSync(destination, template.replace('SECRET=\n', `SECRET=${randomBytes(48).toString('hex')}\n`), { mode: 0o600 });
  fs.chmodSync(destination, 0o600);
  console.log('backend/.env criado com uma chave JWT aleatória. Configure os dados do PostgreSQL.');
}
