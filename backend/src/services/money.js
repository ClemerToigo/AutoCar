const { fail } = require('./validation');
// Valores em reais trafegam como texto com ponto ("178990.50"). Os cálculos usam centavos inteiros para evitar erros de ponto flutuante.
const PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const MAX_CENTS = 999999999999; // limite de NUMERIC(12,2)

function cents(value) {
  const [whole, fraction = ''] = String(value).split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}
function parse(value, label, { allowZero = false } = {}) {
  if (!['string', 'number'].includes(typeof value) || !PATTERN.test(String(value))) {
    fail(`Informe ${label} ${allowZero ? 'igual ou maior que zero' : 'maior que zero'}, com até duas casas decimais.`);
  }
  const result = cents(value);
  if (result === 0 && !allowZero) fail(`Informe ${label} maior que zero, com até duas casas decimais.`);
  return result;
}
function format(total) {
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}
module.exports = { cents, parse, format, MAX_CENTS };
