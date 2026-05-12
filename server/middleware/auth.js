const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'chemclean_secret_2026';

function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизовано' });
  try { req.user = jwt.verify(h.slice(7), SECRET); next(); }
  catch { res.status(401).json({ error: 'Недійсний токен' }); }
}

function requireAdmin(req, res, next) {
  if (!req.user?.canAdmin) return res.status(403).json({ error: 'Потрібні права адміністратора' });
  next();
}

module.exports = { requireAuth, requireAdmin };
