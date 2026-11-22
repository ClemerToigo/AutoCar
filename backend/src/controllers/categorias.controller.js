const service = require('../services/categorias.service');
exports.list = async (req, res) => res.json(await service.list(req.query));
exports.get = async (req, res) => res.json(await service.get(req.params.id));
exports.create = async (req, res) => res.status(201).json(await service.create(req.body));
exports.update = async (req, res) => res.json(await service.update(req.params.id, req.body));
exports.remove = async (req, res) => { await service.remove(req.params.id); res.status(204).end(); };
