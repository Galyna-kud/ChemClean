const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'chemclean_secret_2026';

router.post('/login', async (req, res, next) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'login та password обов\'язкові' });
    const r = await query(
      `SELECT e.employee_id, e.full_name, e.login, e.password_hash, e.is_active,
              ro.name AS role, ro.can_admin AS "canAdmin"
       FROM employees e JOIN roles ro ON ro.role_id = e.role_id
       WHERE e.login = $1`, [login]
    );
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Невірний логін або пароль' });
    if (!u.is_active) return res.status(403).json({ error: 'Акаунт заблоковано' });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'Невірний логін або пароль' });
const payload = { id: u.employee_id, name: u.full_name, login: u.login, role: u.role, canAdmin: u.canAdmin };
    const token = jwt.sign(payload, SECRET, { expiresIn: '12h' });
    res.json({ token, user: payload });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, (req, res) => res.json(req.user));

module.exports = router;
