const { test } = require('node:test');
const assert = require('node:assert/strict');
const money = require('../backend/src/services/money');

test('parse converte reais em centavos sem erro de ponto flutuante', () => {
  assert.equal(money.parse('178990.50', 'o valor'), 17899050);
  assert.equal(money.parse('0.1', 'o valor'), 10);
  assert.equal(money.parse(850, 'o valor'), 85000);
  assert.equal(money.parse('9999999999.99', 'o valor'), money.MAX_CENTS);
});

test('parse recusa zero, negativos, excesso de casas e formatos inválidos', () => {
  for (const value of ['0', '0.00', '-1', '1.234', '1,5', 'abc', '', null, undefined, '1e5', '00.50', '10000000000']) {
    assert.throws(() => money.parse(value, 'o valor'), (error) => error.status === 400, `deveria recusar ${String(value)}`);
  }
});

test('allowZero aceita zero apenas quando permitido', () => {
  assert.equal(money.parse('0', 'o preço', { allowZero: true }), 0);
  assert.equal(money.parse('0.00', 'o preço', { allowZero: true }), 0);
  assert.throws(() => money.parse('0', 'o preço'), (error) => error.status === 400);
});

test('format e cents são inversos', () => {
  for (const value of ['0.00', '0.05', '1.00', '850.00', '178990.50', '9999999999.99']) {
    assert.equal(money.format(money.cents(value)), value);
  }
  assert.equal(money.cents('850'), 85000);
  assert.equal(money.format(money.cents('0.1') + money.cents('0.2')), '0.30');
});
