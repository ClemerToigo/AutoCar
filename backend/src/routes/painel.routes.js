const router = require('express').Router();
const { Op } = require('sequelize');
const Usuario = require('../models/usuario.model');
const Veiculo = require('../models/veiculo.model');
router.use(require('../middlewares/auth.middleware'), require('../middlewares/admin.middleware'));
router.get('/', async (req, res) => {
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const [total, disponiveis, vendidos, clientes, novosVeiculos, novosClientes, recentes] = await Promise.all([
    Veiculo.count(), Veiculo.count({ where: { status: 'DISPONIVEL' } }), Veiculo.count({ where: { status: 'VENDIDO' } }),
    Usuario.count({ where: { tipo: 'USUARIO' } }), Veiculo.count({ where: { created_at: { [Op.gte]: month } } }),
    Usuario.count({ where: { tipo: 'USUARIO', created_at: { [Op.gte]: month } } }),
    Veiculo.findAll({ include: [{ association: 'marca', attributes: ['id', 'nome'] }], limit: 4, order: [['created_at', 'DESC'], ['id', 'DESC']] }),
  ]);
  res.json({ total, disponiveis, vendidos, clientes, novosVeiculos, novosClientes, recentes });
});
module.exports = router;
