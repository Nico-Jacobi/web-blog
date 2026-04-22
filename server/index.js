'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const db = require('./db');
const { ensureSharedDirs } = require('./utils/paths');

const { router: authRouter } = require('./routes/auth');
const meRouter = require('./routes/me');
const editorRouter = require('./routes/editor');
const readerRouter = require('./routes/reader');
const pushRouter = require('./routes/push');

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: true,
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Read-Token'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
  }));
  app.use(express.json({ limit: '1mb' }));

  app.use(rateLimit({
    windowMs: config.RATE_LIMITS.globalWindowMs,
    max: config.RATE_LIMITS.globalMax,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  app.get('/health', (_req, res) => res.json({ ok: true, version: '0.1.0' }));

  app.use('/auth', authRouter);
  app.use('/me', meRouter);
  app.use('/me/blog', editorRouter);
  app.use('/blogs/:slug', readerRouter);
  app.use('/blogs/:slug/push', pushRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });

  app.use((err, req, res, _next) => {
    console.error('[error]', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function start() {
  db.init();
  await ensureSharedDirs();
  const app = buildApp();
  app.listen(config.PORT, () => {
    console.log(`✅ Server listening on port ${config.PORT}`);
    console.log(`   Storage: ${config.STORAGE_DIR}`);
    console.log(`   DB:      ${config.DB_PATH}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { buildApp, start };
