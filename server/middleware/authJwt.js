'use strict';

const { verifyAccessToken } = require('../services/auth');
const { getDb } = require('../db');
const { blogRoot, blogPath } = require('../utils/paths');

function extractBearer(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth || typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function authJwt(req, res, next) {
  const token = extractBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    const code = err && err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ error: 'Invalid token', code });
  }

  const userId = decoded.uid;
  const blogId = decoded.bid;
  if (!userId || !blogId) {
    return res.status(401).json({ error: 'Malformed token payload' });
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT b.id AS blog_id, b.slug, b.user_id, u.username
    FROM blogs b JOIN users u ON u.id = b.user_id
    WHERE b.id = ? AND b.user_id = ?
  `).get(blogId, userId);

  if (!row) {
    return res.status(401).json({ error: 'User or blog no longer exists' });
  }

  req.user = { id: userId, username: row.username };
  req.blog = { id: blogId, slug: row.slug };
  req.tenantDir = blogRoot(blogId);
  req.blogPath = (rel) => blogPath(blogId, rel);
  next();
}

module.exports = { authJwt, extractBearer };
