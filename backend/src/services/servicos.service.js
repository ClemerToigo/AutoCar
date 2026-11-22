const { Op } = require('sequelize');
const database = require('../config/database');
const Servico = require('../models/servico.model');
const VendaServico = require('../models/venda-servico.model');
const money = require('./money');
const v = require('./validation');
const attributes = ['id', 'nome', 'descricao', 'preco', 'ativo', 'versao', 'created_at', 'updated_at'];
const duplicate = () => v.fail('Já existe um serviço com esse nome.', 409);
function validate(body) {
  v.object(body);
  return {
    nome: v.text(body.nome, 'o nome do serviço', 120),
    descricao: v.text(body.descricao, 'a descrição', 1000, false),
    preco: money.format(money.parse(body.preco, 'o preço', { allowZero: true })),
    ativo: v.boolean(body.ativo, 'um status'),
  };
}
async function list(query) {
  const pagination = v.page(query, 8);
  const term = v.search(query.q);
  const where = {};
  if (term) where[Op.or] = [{ nome: { [Op.iLike]: `%${term}%` } }, { descricao: { [Op.iLike]: `%${term}%` } }];
  if (query.status) where.ativo = v.option(query.status, ['ATIVO', 'INATIVO'], 'um status') === 'ATIVO';
  const { rows, count } = await Servico.findAndCountAll({ where, attributes, order: [['nome', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit });
  return v.result(rows, count, pagination);
}
async function get(rawId) {
  const row = await Servico.findByPk(v.integer(rawId, 'ID'), { attributes });
  if (!row) v.fail('Serviço não encontrado.', 404);
  return row;
}
async function create(body) {
  const data = validate(body);
  try {
    const row = await Servico.create(data);
    return await get(row.id);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') duplicate();
    throw error;
  }
}
async function update(rawId, body) {
  const id = v.integer(rawId, 'ID');
  v.object(body);
  try {
    await database.transaction(async (transaction) => {
      const row = await Servico.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) v.fail('Serviço não encontrado.', 404);
      if (body.versao !== undefined && v.integer(body.versao, 'Versão', 0) !== row.versao) v.fail('Este serviço foi alterado por outra pessoa. Recarregue os dados antes de salvar.', 409);
      await row.update({ ...validate(body), versao: row.versao + 1 }, { transaction });
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') duplicate();
    throw error;
  }
  return get(id);
}
async function remove(rawId) {
  const id = v.integer(rawId, 'ID');
  await database.transaction(async (transaction) => {
    const row = await Servico.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) v.fail('Serviço não encontrado.', 404);
    if (await VendaServico.count({ where: { servico_id: id }, transaction })) {
      v.fail('Este serviço já foi usado em vendas e não pode ser excluído. Marque-o como inativo para deixar de oferecê-lo.', 409);
    }
    await row.destroy({ transaction });
  });
}
module.exports = { list, get, create, update, remove };
