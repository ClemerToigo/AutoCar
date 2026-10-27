const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

if (!process.env.SECRET || process.env.SECRET.length < 32) {
  throw new Error('Configure SECRET com pelo menos 32 caracteres em backend/.env (npm run setup).');
}

module.exports = {
  secret: process.env.SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  issuer: 'autocar',
  audience: 'autocar-web',
};
