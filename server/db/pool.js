require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chemclean',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
});

pool.on('connect', client => {
  client.query("SET client_encoding = 'UTF8'");
});

pool.connect((err, client, release) => {
  if (err) { console.error('❌ Помилка PostgreSQL:', err.message); return; }
  console.log('✅ PostgreSQL підключено');
  release();
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};