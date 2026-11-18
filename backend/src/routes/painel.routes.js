const router = require('express').Router();
const service = require('../services/painel.service');
router.use(require('../middlewares/auth.middleware'), require('../middlewares/admin.middleware'));
router.get('/', async (req, res) => {
  res.json(await service.snapshot());
});
module.exports = router;
