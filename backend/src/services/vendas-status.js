// A venda e o cadastro do veículo usam a mesma regra de status.
module.exports = Object.freeze({
  EM_NEGOCIACAO: 'RESERVADO',
  APROVADA: 'RESERVADO',
  CONCLUIDA: 'VENDIDO',
  CANCELADA: 'DISPONIVEL',
});
