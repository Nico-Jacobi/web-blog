'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const { getDb } = require('../db');
const {
  uuid,
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} = require('../services/auth');
const { ensureBlogDirs, removeBlogDir } = require('../utils/paths');
const { isValidSlug, isReservedSlug } = require('../utils/slug');
const { blogSettingsSchema, withDefaults } = require('../schemas/blogSettings');
const {
  USERNAME_REGEX,
  PASSWORD_MIN_LENGTH,
  RATE_LIMITS,
} = require('../config');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.authWindowMs,
  max: RATE_LIMITS.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later' },
});

const registerSchema = z.object({
  username: z.string().regex(USERNAME_REGEX, 'Invalid username'),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  blogSlug: z.string(),
  blogTitle: z.string().min(1).max(120),
  readPassword: z.string().min(1).max(256).optional().nullable(),
  settings: blogSettingsSchema.partial().optional(),
}).strict();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
}).strict();

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
}).strict();

function presentBlog(row) {
  if (!row) return null;
  let settings = {};
  try { settings = JSON.parse(row.settings_json || '{}'); } catch { settings = {}; }
  return {
    id: row.id,
    slug: row.slug,
    settings: withDefaults(settings),
    hasReadPassword: Boolean(row.read_pw_hash),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function presentUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
  };
}

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
  }
  const { username, password, blogSlug, blogTitle, readPassword, settings } = parsed.data;

  const slug = blogSlug.toLowerCase();
  if (!isValidSlug(slug)) {
    const reason = isReservedSlug(slug) ? 'Slug is reserved' : 'Invalid slug format';
    return res.status(400).json({ error: reason });
  }

  const db = getDb();
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) return res.status(409).json({ error: 'Username already taken' });
  const existingBlog = db.prepare('SELECT id FROM blogs WHERE slug = ?').get(slug);
  if (existingBlog) return res.status(409).json({ error: 'Blog slug already taken' });

  const userId = uuid();
  const blogId = uuid();
  const passwordHash = await hashPassword(password);
  const readHash = readPassword ? await hashPassword(readPassword) : null;

  const mergedSettings = { ...(settings || {}), title: blogTitle };
  const settingsJson = JSON.stringify(mergedSettings);

  try {
    db.transaction(() => {
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)')
        .run(userId, username, passwordHash);
      db.prepare(`
        INSERT INTO blogs (id, user_id, slug, read_pw_hash, settings_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(blogId, userId, slug, readHash, settingsJson);
    })();
  } catch (err) {
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username or slug already taken' });
    }
    throw err;
  }

  await ensureBlogDirs(blogId);

  const accessToken = signAccessToken({ userId, blogId });
  const refresh = issueRefreshToken(userId);

  const userRow = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(userId);
  const blogRow = db.prepare('SELECT * FROM blogs WHERE id = ?').get(blogId);

  return res.status(201).json({
    user: presentUser(userRow),
    blog: presentBlog(blogRow),
    accessToken,
    refreshToken: refresh.token,
    accessTokenExpiresIn: require('../config').ACCESS_TOKEN_TTL_SEC,
  });
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { username, password } = parsed.data;
  const db = getDb();
  const userRow = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!userRow) {
    await verifyPassword(password, '$argon2id$v=19$m=16,t=1,p=1$YWJjZGVm$dummy');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await verifyPassword(password, userRow.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const blogRow = db.prepare('SELECT * FROM blogs WHERE user_id = ?').get(userRow.id);
  if (!blogRow) {
    return res.status(500).json({ error: 'User has no associated blog' });
  }

  const accessToken = signAccessToken({ userId: userRow.id, blogId: blogRow.id });
  const refresh = issueRefreshToken(userRow.id);

  return res.json({
    user: presentUser(userRow),
    blog: presentBlog(blogRow),
    accessToken,
    refreshToken: refresh.token,
    accessTokenExpiresIn: require('../config').ACCESS_TOKEN_TTL_SEC,
  });
});

router.post('/refresh', authLimiter, (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  let payload;
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const db = getDb();
  const blogRow = db.prepare('SELECT id FROM blogs WHERE user_id = ?').get(payload.userId);
  if (!blogRow) return res.status(401).json({ error: 'User or blog no longer exists' });

  const accessToken = signAccessToken({ userId: payload.userId, blogId: blogRow.id });
  return res.json({
    accessToken,
    accessTokenExpiresIn: require('../config').ACCESS_TOKEN_TTL_SEC,
  });
});

router.post('/logout', (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    try {
      const payload = verifyRefreshToken(parsed.data.refreshToken);
      revokeRefreshToken(payload.jti);
    } catch {
      // Silent — logout is idempotent.
    }
  }
  return res.json({ ok: true });
});

module.exports = { router, _internal: { removeBlogDir } };
