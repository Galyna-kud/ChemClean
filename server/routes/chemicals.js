const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const r = await query(`SELECT chemical_id AS "id", name, quantity, unit,
      min_quantity AS "minQuantity", quantity <= min_quantity AS "isLow"
      FROM chemicals ORDER BY name`);
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const r = await query(
      `UPDATE chemicals SET quantity=$1, updated_at=NOW() WHERE chemical_id=$2
       RETURNING chemical_id AS "id", name, quantity, unit`,
      [req.body.quantity, req.params.id]);
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
