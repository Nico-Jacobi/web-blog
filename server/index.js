'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const db = require('./db');
const { ensureSharedDirs } = require('./utils/paths');

const { router: authRouter } = require('./routes/auth');
const meRouter = require('./routes/me');
const editorRouter = require('./routes/editor');
const readerRouter = require('./routes/reader');
const pushRouter = require('./routes/push');

const API_PREFIXES = ['/auth', '/me', '/blogs', '/health'];

function isApiPath(reqPath) {
  return API_PREFIXES.some(prefix =>
    reqPath === prefix || reqPath.startsWith(prefix + '/')
  );
}

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

  // ── Static website (SPA) ────────────────────────────────────────────
  // Serve the React build from WEB_DIR with a SPA fallback so deep links
  // like /anna-trip/stop/sydney resolve to index.html on hard reloads.
  // Hashed assets get a long immutable cache; index.html and other JSON
  // (locales) are no-store so updates are picked up immediately.
  const indexPath = path.join(config.WEB_DIR, 'index.html');
  const hasWebsite = fs.existsSync(indexPath);

  if (hasWebsite) {
    app.use(express.static(config.WEB_DIR, {
      index: false,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        if (base === 'index.html' || base === 'sw.js' || base === 'manifest.json') {
          res.setHeader('Cache-Control', 'no-store');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-store');
        }
      },
    }));

    // SPA fallback for any non-API path that didn't match a static file.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (isApiPath(req.path)) return next();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(indexPath);
    });
  }

  // 404 — only reached for non-GET API misses or when no website is mounted.
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
    if (fs.existsSync(path.join(config.WEB_DIR, 'index.html'))) {
      console.log(`   Web:     ${config.WEB_DIR} (SPA fallback active)`);
    } else {
      console.log(`   Web:     ${config.WEB_DIR} (no index.html — frontend not served)`);
    }
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { buildApp, start };
