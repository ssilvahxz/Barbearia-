const { getDb } = require('./database');

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
  if (!req.db) {
    return getDb().then(db => {
      req.db = db;
      const user = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(req.session.userId);
      if (user && user.is_blocked) {
        req.session.destroy();
        return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com a barbearia.' });
      }
      next();
    }).catch(() => res.status(500).json({ error: 'Database error' }));
  }
  const user = req.db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(req.session.userId);
  if (user && user.is_blocked) {
    req.session.destroy();
    return res.status(403).json({ error: 'Conta bloqueada. Entre em contato com a barbearia.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador' });
  }
  next();
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>'"&]/g, c => ({'<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;','&':'&amp;'}[c]));
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
  return /^[\d\s()\-+]+$/.test(phone) && phone.replace(/\D/g,'').length >= 10;
}

module.exports = { requireAuth, requireAdmin, sanitize, validateEmail, validatePhone };