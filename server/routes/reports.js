const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const { period = 'all' } = req.query;
    let df = '';
    if (period === 'today') df = `AND DATE(o.date_received)=CURRENT_DATE`;
    if (period === 'week')  df = `AND o.date_received>=NOW()-INTERVAL '7 days'`;
    if (period === 'month') df = `AND DATE_TRUNC('month',o.date_received)=DATE_TRUNC('month',CURRENT_DATE)`;

    const [rev, sts, svcs, cls] = await Promise.all([
      query(`SELECT COALESCE(SUM(p.amount),0) AS revenue, COUNT(p.*) AS paid, COUNT(o.*) AS total
             FROM orders o LEFT JOIN payments p ON p.order_id=o.order_id WHERE 1=1 ${df}`),
      query(`SELECT o.status_id, st.name, COUNT(*) AS cnt
             FROM orders o JOIN order_statuses st ON st.status_id=o.status_id WHERE 1=1 ${df}
             GROUP BY o.status_id, st.name ORDER BY o.status_id`),
      query(`SELECT s.service_id, s.name, COUNT(i.item_id) AS cnt, SUM(i.subtotal) AS revenue
             FROM order_items i JOIN orders o ON o.order_id=i.order_id
             JOIN services s ON s.service_id=i.service_id WHERE 1=1 ${df}
             GROUP BY s.service_id, s.name ORDER BY revenue DESC LIMIT 10`),
      query(`SELECT c.client_id, c.full_name, COUNT(o.order_id) AS orders_count, SUM(p.amount) AS spent
             FROM clients c JOIN orders o ON o.client_id=c.client_id
             JOIN payments p ON p.order_id=o.order_id WHERE 1=1 ${df}
             GROUP BY c.client_id, c.full_name ORDER BY spent DESC LIMIT 5`),
    ]);

    res.json({
      revenue:     Number(rev.rows[0].revenue),
      paidCount:   Number(rev.rows[0].paid),
      totalOrders: Number(rev.rows[0].total),
      statuses:    sts.rows.map(r => ({ statusId: r.status_id, name: r.name, count: Number(r.cnt) })),
      topServices: svcs.rows.map(r => ({ id: r.service_id, name: r.name, count: Number(r.cnt), revenue: Number(r.revenue) })),
      topClients:  cls.rows.map(r => ({ id: r.client_id, fullName: r.full_name, ordersCount: Number(r.orders_count), spent: Number(r.spent) })),
    });
  } catch (e) { next(e); }
});

module.exports = router;
