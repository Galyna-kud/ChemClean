function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Такий запис вже існує' });
  if (err.code === '23503') return res.status(409).json({ error: 'Порушення зв\'язку між таблицями' });
  res.status(err.status || 500).json({ error: err.message || 'Помилка сервера' });
}
module.exports = errorHandler;
