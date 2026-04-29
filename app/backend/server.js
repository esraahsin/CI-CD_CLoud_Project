'use strict';

const express   = require('express');
const cors      = require('cors');
const mysql     = require('mysql2/promise');
const rateLimit = require('express-rate-limit');

const PORT      = process.env.PORT      || 3000;
const DB_HOST   = process.env.DB_HOST   || 'localhost';
const DB_PASS   = process.env.DB_PASS   || '';
const DB_USER   = process.env.DB_USER   || 'admin';
const DB_NAME   = process.env.DB_NAME   || 'appdb';

const app = express();
app.use(cors());
app.use(express.json());

// Apply rate limiting to all API routes (100 requests per minute per IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// ── Database setup ────────────────────────────────────────────────────────────

let pool;

async function initDB() {
  pool = mysql.createPool({
    host:     DB_HOST,
    user:     DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
  });

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      title      VARCHAR(255) NOT NULL,
      completed  TINYINT(1)   NOT NULL DEFAULT 0,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// List all todos
app.get('/api/todos', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM todos ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/todos failed:', err);
    res.status(500).json({ error: 'Failed to retrieve todos' });
  }
});

// Create a todo
app.post('/api/todos', async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO todos (title) VALUES (?)',
      [title.trim()]
    );
    const [rows] = await pool.execute('SELECT * FROM todos WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/todos failed:', err);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

// Toggle completed
app.patch('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  if (completed == null || typeof completed !== 'boolean') {
    return res.status(400).json({ error: 'completed (boolean) is required' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE todos SET completed = ? WHERE id = ?',
      [completed ? 1 : 0, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    const [rows] = await pool.execute('SELECT * FROM todos WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(`PATCH /api/todos/${id} failed:`, err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

// Delete a todo
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM todos WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(`DELETE /api/todos/${id} failed:`, err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
