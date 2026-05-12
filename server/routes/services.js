const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT s.service_id AS "id", s.category_id AS "categoryId",
        c.name AS "categoryName", s.name, s.base_price AS "basePrice",
        s.unit, s.is_active AS "isActive"
      FROM services s JOIN service_categories c ON c.category_id=s.category_id
      ORDER BY s.category_id, s.service_id`);
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { categoryId, name, basePrice, unit = 'шт' } = req.body;
    const r = await query(
      `INSERT INTO services(category_id,name,base_price,unit) VALUES($1,$2,$3,$4)
       RETURNING service_id AS "id", category_id AS "categoryId", name, base_price AS "basePrice", unit, is_active AS "isActive"`,
      [categoryId, name, basePrice, unit]);
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/price', requireAuth, async (req, res, next) => {
  try {
    const r = await query(
      `UPDATE services SET base_price=$1 WHERE service_id=$2
       RETURNING service_id AS "id", name, base_price AS "basePrice", unit, is_active AS "isActive"`,
      [req.body.basePrice, req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

router.patch('/:id/toggle', requireAuth, async (req, res, next) => {
  try {
    const r = await query(
      `UPDATE services SET is_active=NOT is_active WHERE service_id=$1
       RETURNING service_id AS "id", name, is_active AS "isActive"`,
      [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Не знайдено' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
