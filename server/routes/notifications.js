const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT notification_id AS "id", type, title, message,
             is_read AS "isRead",
             TO_CHAR(created_at, 'DD.MM HH24:MI') AS "createdAt"
      FROM notifications ORDER BY created_at DESC LIMIT 50`);
    res.json(r.rows);
  } catch (e) { next(e); }
});

router.patch('/read-all', requireAuth, async (req, res, next) => {
  try {
    await query(`UPDATE notifications SET is_read=TRUE WHERE is_read=FALSE`);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await query(`UPDATE notifications SET is_read=TRUE WHERE notification_id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
