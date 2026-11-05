const service = require('../services/veiculos.service');
exports.list = async (req, res) => res.json(await service.list(req.query));
exports.options = async (req, res) => res.json(await service.options());
exports.get = async (req, res) => res.json(await service.get(req.params.id));
exports.create = async (req, res) => res.status(201).json(await service.create(req.body, req.files));
exports.update = async (req, res) => res.json(await service.update(req.params.id, req.body, req.files));
exports.remove = async (req, res) => { await service.remove(req.params.id); res.status(204).end(); };
