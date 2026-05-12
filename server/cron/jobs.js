const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { query } = require('../db/pool');

async function createNotification(type, title, message) {
  try {
    await query(
      `INSERT INTO notifications(type, title, message) VALUES($1,$2,$3)`,
      [type, title, message]
    );
  } catch (e) { console.error('createNotification error:', e.message); }
}

function getMailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Щоденно о 9:00 — нагадування про замовлення що готові завтра
cron.schedule('0 9 * * *', async () => {
  console.log('[cron] Перевірка замовлень на завтра…');
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tStr = tomorrow.toISOString().split('T')[0];
    const r = await query(`
      SELECT o.order_number, c.full_name, c.phone
      FROM orders o JOIN clients c ON c.client_id=o.client_id
      WHERE o.date_promised=$1 AND o.status_id<4`, [tStr]);
    for (const o of r.rows) {
      await createNotification(
        'reminder',
        `Нагадування: ${o.order_number}`,
        `Замовлення ${o.order_number} клієнта ${o.full_name} (${o.phone}) — термін здачі завтра`
      );
    }
    if (r.rows.length) console.log(`[cron] Створено ${r.rows.length} нагадувань`);
  } catch (e) { console.error('[cron] reminder error:', e.message); }
});

// Щогодинно — перевірка хімікатів нижче мінімуму
cron.schedule('0 * * * *', async () => {
  try {
    const r = await query(`
      SELECT name, quantity, min_quantity, unit
      FROM chemicals WHERE quantity <= min_quantity`);
    for (const c of r.rows) {
      // Не дублюємо — перевіряємо чи вже є непрочитане за останні 24 год
      const exists = await query(`
        SELECT 1 FROM notifications
        WHERE type='chemical' AND title LIKE $1
          AND is_read=FALSE AND created_at > NOW()-INTERVAL '24 hours'`, [`%${c.name}%`]);
      if (!exists.rows.length) {
        await createNotification(
          'chemical',
          `⚠ Низький запас: ${c.name}`,
          `Залишок ${c.quantity} ${c.unit}, мінімальний поріг — ${c.min_quantity} ${c.unit}`
        );
      }
    }
  } catch (e) { console.error('[cron] chemical error:', e.message); }
});

// Щопонеділка о 8:00 — email-звіт
cron.schedule('0 8 * * 1', async () => {
  console.log('[cron] Генерація тижневого email-звіту…');
  try {
    const r = await query(`
      SELECT COUNT(*) AS total,
             COUNT(p.payment_id) AS paid,
             COALESCE(SUM(p.amount),0) AS revenue
      FROM orders o
      LEFT JOIN payments p ON p.order_id=o.order_id
      WHERE o.date_received >= NOW()-INTERVAL '7 days'`);
    const { total, paid, revenue } = r.rows[0];

    const top = await query(`
      SELECT s.name, COUNT(*) AS cnt, SUM(oi.subtotal) AS rev
      FROM order_items oi JOIN services s ON s.service_id=oi.service_id
      JOIN orders o ON o.order_id=oi.order_id
      WHERE o.date_received >= NOW()-INTERVAL '7 days'
      GROUP BY s.name ORDER BY rev DESC LIMIT 5`);

    const topHtml = top.rows.map((s,i)=>
      `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.cnt}</td><td>${Number(s.rev).toLocaleString('uk-UA')} ₴</td></tr>`
    ).join('');

    const html = `
      <h2>ChemClean Pro — Тижневий звіт</h2>
      <p>Період: минулі 7 днів</p>
      <table border="1" cellpadding="6" style="border-collapse:collapse">
        <tr><td>Всього замовлень</td><td><b>${total}</b></td></tr>
        <tr><td>Оплачено</td><td><b>${paid}</b></td></tr>
        <tr><td>Виручка</td><td><b>${Number(revenue).toLocaleString('uk-UA')} ₴</b></td></tr>
      </table>
      <h3>Топ послуг</h3>
      <table border="1" cellpadding="6" style="border-collapse:collapse">
        <tr><th>#</th><th>Послуга</th><th>К-ть</th><th>Виручка</th></tr>
        ${topHtml}
      </table>`;

    const mailer = getMailer();
    if (mailer && process.env.ADMIN_EMAIL) {
      await mailer.sendMail({
        from: `"ChemClean Pro" <${process.env.SMTP_USER}>`,
        to:   process.env.ADMIN_EMAIL,
        subject: `ChemClean — звіт за тиждень (${new Date().toLocaleDateString('uk-UA')})`,
        html,
      });
      console.log('[cron] Email-звіт надіслано');
    } else {
      console.log('[cron] Email не налаштовано (SMTP_USER/SMTP_PASS/ADMIN_EMAIL відсутні в .env)');
    }

    await createNotification('email', '📧 Тижневий звіт сформовано',
      `Замовлень: ${total}, оплачено: ${paid}, виручка: ${Number(revenue).toLocaleString('uk-UA')} ₴`);
  } catch (e) { console.error('[cron] email report error:', e.message); }
});

module.exports = {};
