module.exports = function requireAdmin(req, res, next) {
  if (req.user?.tipo !== 'ADMIN') return res.status(403).json({ message: 'Acesso restrito a administradores.' });
  next();
};
