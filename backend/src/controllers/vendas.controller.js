const service = require('../services/vendas.service');
exports.list = async (req, res) => res.json(await service.list(req.query));
exports.options = async (req, res) => res.json(await service.options());
exports.get = async (req, res) => res.json(await service.get(req.params.id));
exports.create = async (req, res) => res.status(201).json(await service.create(req.body));
exports.update = async (req, res) => res.json(await service.update(req.params.id, req.body));
exports.cancel = async (req, res) => { await service.cancel(req.params.id); res.status(204).end(); };
