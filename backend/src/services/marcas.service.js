const { Op, fn, col, where: sqlWhere } = require('sequelize');
const database = require('../config/database');
const Marca = require('../models/marca.model');
const Veiculo = require('../models/veiculo.model');
const v = require('./validation');
const attributes = ['id', 'nome'];
const duplicate = () => v.fail('Já existe uma marca com esse nome.', 409);
const notFound = () => v.fail('Marca não encontrada.', 404);
function validate(body) {
  v.object(body);
  return { nome: v.text(body.nome, 'o nome da marca', 100) };
}
// Quantidade de veículos de cada marca, para exibir na listagem.
async function totals(rows) {
  const counts = rows.length ? await Veiculo.count({ where: { marca_id: rows.map((row) => row.id) }, group: ['marca_id'] }) : [];
  const byId = new Map(counts.map((item) => [item.marca_id, Number(item.count)]));
  return rows.map((row) => ({ id: row.id, nome: row.nome, total_veiculos: byId.get(row.id) ?? 0 }));
}
// O nome é único sem diferenciar maiúsculas de minúsculas.
async function ensureUnique(nome, ignoreId, transaction) {
  const conditions = [sqlWhere(fn('lower', col('nome')), fn('lower', nome))];
  if (ignoreId) conditions.push({ id: { [Op.ne]: ignoreId } });
  if (await Marca.findOne({ where: { [Op.and]: conditions }, attributes: ['id'], transaction })) duplicate();
}
async function list(query) {
  const pagination = v.page(query, 8);
  const term = v.search(query.q);
  const where = {};
  if (term) where.nome = { [Op.iLike]: `%${term}%` };
  const { rows, count } = await Marca.findAndCountAll({ where, attributes, order: [['nome', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit });
  return v.result(await totals(rows), count, pagination);
}
async function get(rawId) {
  const row = await Marca.findByPk(v.integer(rawId, 'ID'), { attributes });
  if (!row) notFound();
  return (await totals([row]))[0];
}
async function create(body) {
  const data = validate(body);
  try {
    const row = await database.transaction(async (transaction) => {
      await ensureUnique(data.nome, null, transaction);
      return Marca.create(data, { transaction });
    });
    return await get(row.id);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') duplicate();
    throw error;
  }
}
async function update(rawId, body) {
  const id = v.integer(rawId, 'ID');
  const data = validate(body);
  try {
    await database.transaction(async (transaction) => {
      const row = await Marca.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) notFound();
      await ensureUnique(data.nome, id, transaction);
      await row.update(data, { transaction });
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
    const row = await Marca.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) notFound();
    if (await Veiculo.count({ where: { marca_id: id }, transaction })) {
      v.fail('Esta marca possui veículos cadastrados e não pode ser excluída. Altere ou exclua esses veículos antes.', 409);
    }
    await row.destroy({ transaction });
  });
}
module.exports = { list, get, create, update, remove };
