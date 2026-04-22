'use strict';

const express = require('express');
const { z } = require('zod');

const { authJwt } = require('../middleware/authJwt');
const { getDb } = require('../db');
const { hashPassword } = require('../services/auth');
const {
  blogSettingsPatchSchema,
  withDefaults,
  parseSettingsJson,
} = require('../schemas/blogSettings');

const router = express.Router();

const patchBlogSchema = z.object({
  settings: blogSettingsPatchSchema.optional(),
  readPassword: z.string().min(1).max(256).nullable().optional(),
}).strict().refine(
  data => data.settings !== undefined || data.readPassword !== undefined,
  { message: 'Provide at least one of settings, readPassword' }
);

function presentUser(row) {
  return row ? { id: row.id, username: row.username, createdAt: row.created_at } : null;
}

function presentBlog(row) {
  if (!row) return null;
  const settings = parseSettingsJson(row.settings_json);
  return {
    id: row.id,
    slug: row.slug,
    settings: withDefaults(settings),
    hasReadPassword: Boolean(row.read_pw_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', authJwt, (req, res) => {
  const db = getDb();
  const userRow = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  const blogRow = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.blog.id);
  res.json({ user: presentUser(userRow), blog: presentBlog(blogRow) });
});

router.get('/blog', authJwt, (req, res) => {
  const db = getDb();
  const blogRow = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.blog.id);
  if (!blogRow) return res.status(404).json({ error: 'Blog not found' });
  res.json({ blog: presentBlog(blogRow) });
});

router.patch('/blog', authJwt, async (req, res) => {
  const parsed = patchBlogSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
  }
  const db = getDb();
  const current = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.blog.id);
  if (!current) return res.status(404).json({ error: 'Blog not found' });

  const updates = [];
  const params = [];

  if (parsed.data.settings !== undefined) {
    const currentSettings = parseSettingsJson(current.settings_json);
    const merged = { ...currentSettings, ...parsed.data.settings };
    if (parsed.data.settings.theme) {
      merged.theme = { ...(currentSettings.theme || {}), ...parsed.data.settings.theme };
    }
    if (parsed.data.settings.push) {
      merged.push = { ...(currentSettings.push || {}), ...parsed.data.settings.push };
    }
    updates.push('settings_json = ?');
    params.push(JSON.stringify(merged));
  }

  if (parsed.data.readPassword !== undefined) {
    const hash = parsed.data.readPassword === null
      ? null
      : await hashPassword(parsed.data.readPassword);
    updates.push('read_pw_hash = ?');
    params.push(hash);
  }

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  params.push(req.blog.id);

  db.prepare(`UPDATE blogs SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM blogs WHERE id = ?').get(req.blog.id);
  res.json({ blog: presentBlog(updated) });
});

module.exports = router;
