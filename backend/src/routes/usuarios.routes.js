const router = require('express').Router();
const controller = require('../controllers/usuarios.controller');
router.use(require('../middlewares/auth.middleware'), require('../middlewares/admin.middleware'));
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
module.exports = router;
