const { Op } = require('sequelize'); //Monta condições de pesquisa, como procurar por nome ou e-mail.
const bcrypt = require('bcryptjs'); //Protege as senhas antes de salvar.
const database = require('../config/database');//Permite trabalhar com a conexão do banco e com transações.
const Usuario = require('../models/usuario.model');//Permite consultar e alterar a tabela de usuários.
const Venda = require('../models/venda.model');
const v = require('./validation');//Reúne funções que verificam os dados recebidos.
const attributes = ['id', 'nome', 'login', 'cpf', 'telefone', 'tipo', 'ativo', 'versao', 'created_at', 'updated_at'];//determina quais colunas da tabela de usuários podem ser consultadas e alteradas. Evita que dados sensíveis, como a senha, sejam enviados para a tela.
function toPublic(row) { //escolhendo quais dados podem voltar para a tela
  const data = row.get({ plain: true });//transforma o objeto do banco em um objeto simples, sem métodos.
  return { id: data.id, nome: data.nome, email: data.login, cpf: data.cpf, telefone: data.telefone, tipo: data.tipo, ativo: data.ativo, versao: data.versao, created_at: data.created_at, updated_at: data.updated_at };
}
function validate(body, existing) {//verifica se os dados recebidos da tela estão corretos e no formato esperado.
  //body - dados enviados pelo formulário, existing - dados do usuário que já existe no banco, caso seja uma atualização.
  v.object(body);//verifica se body é um objeto.
  const data = {
    //v.text verifica se o valor é uma string, se não está vazio e se não ultrapassa o tamanho máximo.
    nome: v.text(body.nome, 'o nome completo', 255),
    login: v.text(body.email ?? body.login, 'o e-mail', 255).toLowerCase(),
    cpf: v.cpf(body.cpf), telefone: v.phone(body.telefone),
    tipo: v.option(body.tipo, ['ADMIN', 'USUARIO'], 'um tipo de usuário'),
    ativo: v.boolean(body.ativo, 'um status'),
  };
  if (!/^[^\s@]+@[^\s@]+$/.test(data.login)) v.fail('Informe um e-mail válido.');//verifica se o e-mail tem o formato correto.
  if (!existing || (body.senha !== undefined && body.senha !== '')) data.senha = v.password(body.senha);
  return data;
}
async function list(query) {//lista os usuários cadastrados, com paginação e filtros de pesquisa.
  const pagination = v.page(query, 5);//verifica se a página e o tamanho da página são números válidos, e define o tamanho máximo da página como 5.
  const term = v.search(query.q);//verifica se o termo de pesquisa é uma string válida, e remove espaços extras.
  const where = {};//define as condições de pesquisa, que serão passadas para o banco de dados. Se não houver filtros, todas as linhas serão retornadas.
  if (term) where[Op.or] = [{ nome: { [Op.iLike]: `%${term}%` } }, { login: { [Op.iLike]: `%${term}%` } }];
  //verifica se o termo de pesquisa está presente no nome ou no e-mail do usuário, ignorando maiúsculas e minúsculas.
  if (query.tipo) where.tipo = v.option(query.tipo, ['ADMIN', 'USUARIO'], 'um tipo de usuário');
  //verifica se o tipo de usuário é ADMIN ou USUARIO, e adiciona a condição de pesquisa.
  if (query.status) where.ativo = v.option(query.status, ['ATIVO', 'INATIVO'], 'um status') === 'ATIVO';
  //verifica se o status do usuário é ATIVO ou INATIVO, e adiciona a condição de pesquisa.
  const { rows, count } = await Usuario.findAndCountAll({ where, attributes, order: [['nome', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit });
  return v.result(rows.map(toPublic), count, pagination);
  //retorna os dados dos usuários, o total de usuários encontrados e as informações de paginação.
}
async function get(rawId) {//busca um usuário pelo ID, e retorna os dados públicos.
  const row = await Usuario.findByPk(v.integer(rawId, 'ID'), { attributes });//verifica se o ID é um número válido, e busca o usuário no banco de dados.
  if (!row) v.fail('Usuário não encontrado.', 404);//se o usuário não for encontrado, retorna um erro 404.
  return toPublic(row);
}
async function change(actorId, action) {//função que garante que apenas administradores podem criar, atualizar ou excluir usuários. Também garante que ações simultâneas não removam todos os administradores.
  // Serializa alterações administrativas para evitar que ações simultâneas removam todos os administradores.
  return database.transaction(async (transaction) => {//inicia uma transação no banco de dados, que garante que todas as alterações sejam aplicadas ou nenhuma seja aplicada.
    await database.query('SELECT pg_advisory_xact_lock(18321, 1)', { transaction });//bloqueia a transação para que apenas uma ação administrativa seja executada por vez.
    const actor = await Usuario.findByPk(actorId, { transaction });//busca o usuário que está tentando realizar a ação, para verificar se ele é um administrador ativo.
    if (!actor || !actor.ativo || actor.tipo !== 'ADMIN') v.fail('Acesso restrito a administradores.', 403);//se o usuário não for encontrado, não estiver ativo ou não for um administrador, retorna um erro 403.
    return action(transaction);
  });
}
async function create(body, actorId) {//cria um novo usuário, após validar os dados recebidos e garantir que o usuário que está tentando criar o novo usuário é um administrador ativo.
  const data = validate(body);//valida os dados recebidos do formulário, e retorna um objeto com os dados válidos.
  data.senha = await bcrypt.hash(data.senha, 12);//criptografa a senha recebida, para que não seja armazenada em texto simples no banco de dados.
  return change(actorId, async (transaction) => toPublic(await Usuario.create(data, { transaction })));//cria o novo usuário no banco de dados, e retorna os dados públicos do usuário criado.
}
async function update(rawId, body, actorId) { //atualiza os dados de um usuário existente, após validar os dados recebidos e garantir que o usuário que está tentando atualizar o usuário é um administrador ativo.
  const id = v.integer(rawId, 'ID');//verifica se o ID recebido é um número válido, e lança um erro caso não seja.
  v.object(body);
  return change(actorId, async (transaction) => {//inicia uma transação no banco de dados, que garante que todas as alterações sejam aplicadas ou nenhuma seja aplicada.
    const row = await Usuario.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });//busca o usuário que será atualizado, e bloqueia a linha para evitar que outras transações alterem os mesmos dados ao mesmo tempo.
    if (!row) v.fail('Usuário não encontrado.', 404);
    if (body.versao !== undefined && v.integer(body.versao, 'Versão', 0) !== row.versao) v.fail('Este usuário foi alterado por outra pessoa. Recarregue os dados antes de salvar.', 409);//verifica se a versão recebida é igual à versão atual do usuário no banco de dados, e lança um erro caso não seja.
    const data = validate(body, row);//valida os dados recebidos do formulário, e retorna um objeto com os dados válidos.
    if (id === actorId && (!data.ativo || data.tipo !== 'ADMIN')) v.fail('Você não pode desativar sua própria conta nem remover seu perfil de administrador.', 409);//verifica se o usuário que está tentando atualizar o usuário é o mesmo que está sendo atualizado, e lança um erro caso ele esteja tentando desativar sua própria conta ou remover seu perfil de administrador.
    const invalidate = Boolean(data.senha) || data.login !== row.login || data.tipo !== row.tipo || data.ativo !== row.ativo;//verifica se a senha foi alterada, ou se o login, tipo ou status do usuário foram alterados, para invalidar a sessão atual.
    if (data.senha) data.senha = await bcrypt.hash(data.senha, 12);//criptografa a senha recebida, para que não seja armazenada em texto simples no banco de dados.
    await row.update({ ...data, versao: row.versao + 1, versao_sessao: row.versao_sessao + (invalidate ? 1 : 0) }, { transaction });//atualiza os dados do usuário no banco de dados, e incrementa a versão do usuário e da sessão caso necessário.
    return toPublic(row);
  });
}
async function remove(rawId, actorId) {
  const id = v.integer(rawId, 'ID');
  if (id === actorId) v.fail('Você não pode excluir sua própria conta de administrador.', 409);
  return change(actorId, async (transaction) => {
    const row = await Usuario.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) v.fail('Usuário não encontrado.', 404);
    if (await Venda.count({ where: { cliente_id: id }, transaction })) {
      v.fail('Este usuário possui vendas vinculadas e não pode ser excluído. Desative a conta para impedir novos acessos e preservar o histórico.', 409);
    }
    await row.destroy({ transaction });
  });
}
module.exports = { list, get, create, update, remove };
