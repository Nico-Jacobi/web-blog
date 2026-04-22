'use strict';

const argon2 = require('argon2');
const { getDb } = require('../db');
const { blogRoot, blogPath } = require('../utils/paths');
const { parseSettingsJson, withDefaults } = require('../schemas/blogSettings');

function resolveBlog(req, res, next) {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!slug) return res.status(404).json({ error: 'Blog not found' });

  const db = getDb();
  const row = db.prepare(`
    SELECT id, slug, read_pw_hash, settings_json, created_at, updated_at
    FROM blogs WHERE slug = ?
  `).get(slug);

  if (!row) return res.status(404).json({ error: 'Blog not found' });

  const settings = withDefaults(parseSettingsJson(row.settings_json));
  req.targetBlog = {
    id: row.id,
    slug: row.slug,
    settings,
    hasReadPassword: Boolean(row.read_pw_hash),
    readPasswordHash: row.read_pw_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  req.tenantDir = blogRoot(row.id);
  req.blogPath = (rel) => blogPath(row.id, rel);
  next();
}

async function verifyReadPassword(req, res, next) {
  if (!req.targetBlog) return res.status(500).json({ error: 'Blog context missing' });
  if (!req.targetBlog.hasReadPassword) return next();

  const token = req.headers['x-read-token'];
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Read password required' });
  }
  let ok = false;
  try {
    ok = await argon2.verify(req.targetBlog.readPasswordHash, token);
  } catch {
    ok = false;
  }
  if (!ok) return res.status(401).json({ error: 'Invalid read password' });
  next();
}

module.exports = { resolveBlog, verifyReadPassword };
