require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { pool } = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

// Логи запитів
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ===== TEST UTF8 ROUTE =====
app.get('/test', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT full_name FROM clients LIMIT 3'
    );

    res.json(result.rows);
  } catch (err) {
    console.error('TEST ERROR:', err);

    res.status(500).json({
      error: err.message,
    });
  }
});

// API Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/clients',       require('./routes/clients'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/services',      require('./routes/services'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/chemicals',     require('./routes/chemicals'));
app.use('/api/notifications', require('./routes/notifications'));

// Cron jobs
require('./cron/jobs');

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Production build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

// Error handler
app.use(require('./middleware/errorHandler'));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ChemClean Pro API → http://localhost:${PORT}`);
});