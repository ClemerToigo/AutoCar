const { Op } = require('sequelize');
const database = require('../config/database');
const Veiculo = require('../models/veiculo.model');
const Marca = require('../models/marca.model');
const Categoria = require('../models/categoria.model');
const photos = require('./vehicle-photos');
const v = require('./validation');
const include = [{ model: Marca, as: 'marca', attributes: ['id', 'nome'] }, { model: Categoria, as: 'categoria', attributes: ['id', 'nome'] }];
async function validate(body, transaction) {
  v.object(body);
  const data = {
    marca_id: v.integer(body.marca_id, 'Marca'), categoria_id: v.integer(body.categoria_id, 'Categoria'),
    modelo: v.text(body.modelo, 'o modelo', 120), ano: v.integer(body.ano, 'Ano', 1886, new Date().getFullYear() + 1),
    quilometragem: v.integer(body.quilometragem, 'Quilometragem', 0, 9999999),
    cor: v.text(body.cor, 'a cor', 80), descricao: v.text(body.descricao, 'a descrição', 5000, false),
    combustivel: v.option(body.combustivel, ['Gasolina', 'Etanol', 'Flex', 'Diesel', 'Elétrico', 'Híbrido'], 'um combustível'),
    cambio: v.option(body.cambio, ['Manual', 'Automático', 'CVT'], 'um câmbio'),
    status: v.option(body.status, ['DISPONIVEL', 'RESERVADO', 'VENDIDO'], 'um status'),
  };
  if (!['string', 'number'].includes(typeof body.preco) || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(body.preco)) || Number(body.preco) <= 0) v.fail('Informe um preço maior que zero, com até duas casas decimais.');
  data.preco = Number(body.preco).toFixed(2);
  if (!await Marca.findByPk(data.marca_id, { transaction })) v.fail('Selecione uma marca cadastrada.');
  if (!await Categoria.findByPk(data.categoria_id, { transaction })) v.fail('Selecione uma categoria cadastrada.');
  return data;
}
async function list(query) {
  const pagination = v.page(query, 8);
  const where = {};
  const term = v.search(query.q);
  if (term) where[Op.or] = [{ modelo: { [Op.iLike]: `%${term}%` } }, { '$marca.nome$': { [Op.iLike]: `%${term}%` } }];
  if (query.marca_id) where.marca_id = v.integer(query.marca_id, 'Marca');
  if (query.categoria_id) where.categoria_id = v.integer(query.categoria_id, 'Categoria');
  if (query.status) where.status = v.option(query.status, ['DISPONIVEL', 'RESERVADO', 'VENDIDO'], 'um status');
  const { rows, count } = await Veiculo.findAndCountAll({ where, include, order: [['id', 'DESC']], limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit });
  return v.result(rows, count, pagination);
}
async function get(rawId) {
  const row = await Veiculo.findByPk(v.integer(rawId, 'ID'), { include });
  if (!row) v.fail('Veículo não encontrado.', 404);
  return row;
}
async function create(body, files) {
  const data = await validate(body);
  const images = await photos.prepare(body, files);
  try { const row = await Veiculo.create({ ...data, foto: images.foto, galeria: images.galeria }); return get(row.id); }
  catch (error) { await photos.discard(images.created); throw error; }
}
async function update(rawId, body, files) {
  const id = v.integer(rawId, 'ID');
  v.object(body);
  let images;
  let removed = [];
  try {
    await database.transaction(async (transaction) => {
      const row = await Veiculo.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) v.fail('Veículo não encontrado.', 404);
      if (body.versao !== undefined && v.integer(body.versao, 'Versão', 0) !== row.versao) v.fail('Este veículo foi alterado por outra pessoa. Recarregue os dados antes de salvar.', 409);
      const data = await validate(body, transaction);
      images = await photos.prepare(body, files, row);
      const retained = [images.foto, ...images.galeria];
      removed = [row.foto, ...row.galeria].filter((photo) => photo && !retained.includes(photo));
      await row.update({ ...data, foto: images.foto, galeria: images.galeria, versao: row.versao + 1 }, { transaction });
    });
  } catch (error) { if (images) await photos.discard(images.created); throw error; }
  await photos.discard(removed);
  return get(id);
}
async function remove(rawId) {
  const id = v.integer(rawId, 'ID');
  const images = await database.transaction(async (transaction) => {
    const row = await Veiculo.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) v.fail('Veículo não encontrado.', 404);
    const paths = [row.foto, ...row.galeria].filter(Boolean);
    await row.destroy({ transaction });
    return paths;
  });
  await photos.discard(images);
}
async function options() {
  return { marcas: await Marca.findAll({ order: [['nome', 'ASC']] }), categorias: await Categoria.findAll({ order: [['nome', 'ASC']] }) };
}
module.exports = { list, get, create, update, remove, options };
