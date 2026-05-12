require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chemclean',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 10,
  client_encoding: 'UTF8',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Помилка PostgreSQL:', err.message);
    return;
  }

  console.log('✅ PostgreSQL підключено');

  client.query('SHOW client_encoding', (e, res) => {
    console.log('ENCODING:', res?.rows);
  });

  release();
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};