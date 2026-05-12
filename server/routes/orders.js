const express = require('express');
const { query, pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const STATUS_NAMES = { 1:'Прийнято', 2:'В обробці', 3:'Готове', 4:'Видано' };

async function notify(type, title, message) {
  try { await query(`INSERT INTO notifications(type,title,message) VALUES($1,$2,$3)`, [type, title, message]); } catch {}
}

async function fullOrder(id) {
  const r = await query(`
    SELECT o.order_id AS "id", o.order_number AS "orderNumber",
      o.client_id AS "clientId", o.employee_id AS "employeeId", o.status_id AS "statusId",
      TO_CHAR(o.date_received,'YYYY-MM-DD') AS "dateReceived",
      TO_CHAR(o.date_promised,'YYYY-MM-DD') AS "datePromised",
      TO_CHAR(o.date_completed,'YYYY-MM-DD') AS "dateCompleted",
      o.total_amount AS "totalAmount", o.discount_pct AS "discountPct", o.notes,
      c.full_name AS "clientName", c.phone AS "clientPhone"
    FROM orders o JOIN clients c ON c.client_id=o.client_id WHERE o.order_id=$1`, [id]);
  if (!r.rows.length) return null;
  const o = r.rows[0];
  const items = await query(`SELECT item_id AS "id", service_id AS "serviceId", description, qty, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id=$1 ORDER BY item_id`, [id]);
  const pay   = await query(`SELECT payment_method AS "method", amount, TO_CHAR(payment_date,'YYYY-MM-DD') AS "date", receipt_number AS "receipt" FROM payments WHERE order_id=$1`, [id]);
  o.items   = items.rows;
  o.payment = pay.rows[0] || null;
  return o;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let sql = `SELECT o.order_id AS "id", o.order_number AS "orderNumber",
      o.client_id AS "clientId", o.status_id AS "statusId",
      TO_CHAR(o.date_received,'YYYY-MM-DD') AS "dateReceived",
      TO_CHAR(o.date_promised,'YYYY-MM-DD') AS "datePromised",
      o.total_amount AS "totalAmount", o.discount_pct AS "discountPct", o.notes,
      c.full_name AS "clientName", c.phone AS "clientPhone",
      p.amount AS "paidAmount"
      FROM orders o JOIN clients c ON c.client_id=o.client_id
      LEFT JOIN payments p ON p.order_id=o.order_id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); sql += ` AND o.status_id=$${params.length}`; }
    if (search) { params.push(`%${search}%`); sql += ` AND (o.order_number ILIKE $${params.length} OR c.full_name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`; }
    sql += ' ORDER BY o.order_id DESC';
    const rows = (await query(sql, params)).rows;
    const result = await Promise.all(rows.map(async o => {
      const items = await query(`SELECT item_id AS "id", service_id AS "serviceId", description, qty, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id=$1`, [o.id]);
      const pay   = await query(`SELECT payment_method AS "method", amount, TO_CHAR(payment_date,'YYYY-MM-DD') AS "date", receipt_number AS "receipt" FROM payments WHERE order_id=$1`, [o.id]);
      return { ...o, items: items.rows, payment: pay.rows[0] || null };
    }));
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { clientId, datePromised, discountPct = 0, notes = '', items } = req.body;
    if (!clientId || !items?.length) return res.status(400).json({ error: 'clientId та items обов\'язкові' });
    await client.query('BEGIN');
    const cnt = await client.query('SELECT COUNT(*) FROM orders');
    const num = `ORD-${String(parseInt(cnt.rows[0].count) + 1).padStart(4, '0')}`;
    const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0);
    const total    = Math.round(subtotal * (1 - discountPct / 100) * 100) / 100;
    const oRes = await client.query(
      `INSERT INTO orders(order_number,client_id,employee_id,status_id,date_promised,total_amount,discount_pct,notes)
       VALUES($1,$2,$3,1,$4,$5,$6,$7) RETURNING order_id`,
      [num, clientId, req.user.id, datePromised || new Date().toISOString().split('T')[0], total, discountPct, notes]
    );
    const orderId = oRes.rows[0].order_id;
    for (const item of items) {
      const sub = Math.round(Number(item.qty) * Number(item.unitPrice) * 100) / 100;
      await client.query(
        `INSERT INTO order_items(order_id,service_id,description,qty,unit_price,subtotal) VALUES($1,$2,$3,$4,$5,$6)`,
        [orderId, item.serviceId, item.description, item.qty, item.unitPrice, sub]
      );
    }
    const pts = Math.floor(total / 10);
    if (pts > 0) await client.query(`UPDATE clients SET loyalty_points=loyalty_points+$1 WHERE client_id=$2`, [pts, clientId]);
    await client.query('COMMIT');
    res.status(201).json(await fullOrder(orderId));
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { statusId } = req.body;
    const completed = statusId === 3 ? new Date().toISOString() : null;
    await query(`UPDATE orders SET status_id=$1, date_completed=$2 WHERE order_id=$3`, [statusId, completed, req.params.id]);
    const o = await fullOrder(req.params.id);
    const statusName = STATUS_NAMES[statusId] || statusId;
    await notify('status',
      `Статус змінено: ${o.orderNumber}`,
      `Замовлення ${o.orderNumber} клієнта ${o.clientName} → "${statusName}"`);
    res.json(o);
  } catch (e) { next(e); }
});

router.post('/:id/pay', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { method = 'cash' } = req.body;
    await client.query('BEGIN');
    const r = await client.query(`SELECT total_amount FROM orders WHERE order_id=$1`, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Не знайдено' });
    const receipt = `CHK-${Math.floor(Math.random() * 90000 + 10000)}`;
    await client.query(`INSERT INTO payments(order_id,amount,payment_method,receipt_number) VALUES($1,$2,$3,$4)`, [req.params.id, r.rows[0].total_amount, method, receipt]);
    await client.query(`UPDATE orders SET status_id=4 WHERE order_id=$1`, [req.params.id]);
    await client.query('COMMIT');
    res.json(await fullOrder(req.params.id));
  } catch (e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

module.exports = router;
