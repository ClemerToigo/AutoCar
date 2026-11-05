function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function object(body) { if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Envie um objeto JSON válido.'); }
function text(value, label, max, required = true) {
  if (typeof value !== 'string') { if (!required && value == null) return ''; fail(`Informe ${label}.`); }
  const result = value.trim();
  if ((required && !result) || result.length > max) fail(`Informe ${label} com até ${max} caracteres.`);
  return result;
}
function integer(value, label, min = 1, max = 2147483647) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))) fail(`${label} inválido.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(`${label} deve estar entre ${min} e ${max}.`);
  return number;
}
function option(value, values, label) { if (!values.includes(value)) fail(`Selecione ${label} válido.`); return value; }
function boolean(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  fail(`Selecione ${label} válido.`);
}
function cpf(value) {
  const raw = text(value, 'o CPF', 20);
  if (!/^[\d.\-\s]+$/.test(raw)) fail('Informe um CPF válido.');
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) fail('Informe um CPF válido.');
  for (let length = 9; length <= 10; length++) {
    let total = 0;
    for (let i = 0; i < length; i++) total += Number(digits[i]) * (length + 1 - i);
    const check = (total * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(digits[length])) fail('Informe um CPF válido.');
  }
  return digits;
}
function phone(value) {
  const raw = text(value, 'o telefone', 25);
  if (!/^[\d()\-\s]+$/.test(raw)) fail('Informe um telefone com DDD.');
  const digits = raw.replace(/\D/g, '');
  if (!/^\d{10,11}$/.test(digits)) fail('Informe um telefone com DDD e 10 ou 11 dígitos.');
  return digits;
}
function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 72) fail('A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.');
  return value;
}
function page(query, defaultLimit) {
  return { page: query.page === undefined ? 1 : integer(query.page, 'Página', 1, 100000), limit: query.limit === undefined ? defaultLimit : integer(query.limit, 'Quantidade por página', 1, 100) };
}
function search(value) {
  const raw = value === undefined ? '' : text(value, 'a pesquisa', 120, false);
  return raw.replace(/[\\%_]/g, '\\$&');
}
function result(items, total, pagination) { return { items, total, ...pagination, pages: Math.max(1, Math.ceil(total / pagination.limit)) }; }
module.exports = { fail, object, text, integer, option, boolean, cpf, phone, password, page, search, result };
