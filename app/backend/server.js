'use strict';

const express   = require('express');
const cors      = require('cors');
const mysql     = require('mysql2/promise');
const rateLimit = require('express-rate-limit');
const { Client } = require('@elastic/elasticsearch');

const PORT      = process.env.PORT      || 3000;
const DB_HOST   = process.env.DB_HOST   || 'localhost';
const DB_PASS   = process.env.DB_PASS   || '';
const DB_USER   = process.env.DB_USER   || 'admin';
const DB_NAME   = process.env.DB_NAME   || 'appdb';
const ELK_HOST  = process.env.ELK_HOST  || null;

const app = express();
app.use(cors());
app.use(express.json());

// ── Elasticsearch client (optional — app works fine if ES is unavailable) ──

let esClient = null;

if (ELK_HOST) {
  esClient = new Client({ node: `http://${ELK_HOST}:9200` });
  console.log(`Elasticsearch logging enabled → http://${ELK_HOST}:9200`);
} else {
  console.log('ELK_HOST not set — Elasticsearch logging disabled.');
}

// ── ECS log builder ───────────────────────────────────────────────────────

function createEcsLog(req, res, durationMs) {
  const status = res.statusCode;
  return {
    '@timestamp': new Date().toISOString(),
    'source_type': 'todo-app',
    'event': {
      'dataset':  'todo-app',
      'kind':     'event',
      'category': 'web',
      'type':     'access',
      'action':   req.method.toLowerCase(),
      'outcome':  status < 400 ? 'success' : 'failure',
      'duration': durationMs,
    },
    'http': {
      'request':  { 'method': req.method },
      'response': { 'status_code': status },
    },
    'url': {
      'path':     req.path,
      'original': req.originalUrl,
    },
    'source': {
      // Respect X-Forwarded-For from ALB
      'ip': req.headers['x-forwarded-for']?.split(',')[0].trim()
           || req.socket.remoteAddress,
    },
    'user_agent': {
      'original': req.headers['user-agent'] || null,
    },
  };
}

// ── ECS logging middleware ────────────────────────────────────────────────

function ecsLogger(req, res, next) {
  if (!esClient) return next();

  const start = Date.now();

  res.on('finish', () => {
    // Skip health checks to avoid noise
    if (req.path === '/health') return;

    const log = createEcsLog(req, res, Date.now() - start);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

    // Fire-and-forget: ES failures never affect the app
    esClient.index({
      index: `todo-app-${today}`,
      document: log,
    }).catch(err => {
      console.error('ES log error:', err.message);
    });
  });

  next();
}

app.use(ecsLogger);

// ── Rate limiting ─────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// ── Database setup ────────────────────────────────────────────────────────

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

// ── Routes ────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/todos', async (_req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM todos ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/todos failed:', err);
    res.status(500).json({ error: 'Failed to retrieve todos' });
  }
});

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

// ── Start ─────────────────────────────────────────────────────────────────

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });