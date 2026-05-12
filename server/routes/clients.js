const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const SEL = `SELECT client_id AS "id", full_name AS "fullName", phone, email,
  address, loyalty_points AS "loyaltyPoints",
  TO_CHAR(created_at,'YYYY-MM-DD') AS "createdAt" FROM clients`;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = SEL, p = [];
    if (search) { p.push(`%${search}%`); sql += ` WHERE full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1`; }
    sql += ' ORDER BY created_at DESC';
    res.json((await query(sql, p)).rows);
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { fullName, phone, email = '', address = '' } = req.body;
    if (!fullName || !phone) return res.status(400).json({ error: 'fullName та phone обов\'язкові' });
    const r = await query(
      `INSERT INTO clients(full_name,phone,email,address) VALUES($1,$2,$3,$4)
       RETURNING client_id AS "id", full_name AS "fullName", phone, email, loyalty_points AS "loyaltyPoints"`,
      [fullName, phone, email, address]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { fullName, phone, email, address } = req.body;
    const r = await query(
      `UPDATE clients SET full_name=COALESCE($1,full_name), phone=COALESCE($2,phone),
       email=COALESCE($3,email), address=COALESCE($4,address)
       WHERE client_id=$5
       RETURNING client_id AS "id", full_name AS "fullName", phone, email, loyalty_points AS "loyaltyPoints"`,
      [fullName, phone, email, address, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
