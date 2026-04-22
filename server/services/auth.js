'use strict';

const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const {
  JWT_SECRET,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  ARGON2_OPTS,
} = require('../config');
const { getDb } = require('../db');

function uuid() {
  return crypto.randomUUID();
}

async function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function plusSecondsIso(sec) {
  return new Date(Date.now() + sec * 1000).toISOString();
}

function signAccessToken({ userId, blogId }) {
  return jwt.sign(
    { uid: userId, bid: blogId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SEC }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
}

function issueRefreshToken(userId) {
  const db = getDb();
  const id = uuid();
  const expiresAt = plusSecondsIso(REFRESH_TOKEN_TTL_SEC);
  db.prepare(`
    INSERT INTO refresh_tokens (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(id, userId, expiresAt);

  const token = jwt.sign(
    { jti: id, uid: userId },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: REFRESH_TOKEN_TTL_SEC }
  );
  return { token, id, expiresAt };
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  if (!decoded.jti || !decoded.uid) {
    throw new Error('Malformed refresh token');
  }
  const db = getDb();
  const row = db.prepare(`
    SELECT id, user_id, expires_at, revoked_at
    FROM refresh_tokens WHERE id = ?
  `).get(decoded.jti);

  if (!row) throw new Error('Refresh token not found');
  if (row.revoked_at) throw new Error('Refresh token revoked');
  if (Date.parse(row.expires_at) < Date.now()) throw new Error('Refresh token expired');
  if (row.user_id !== decoded.uid) throw new Error('Refresh token mismatch');

  return { jti: row.id, userId: row.user_id };
}

function revokeRefreshToken(jti) {
  const db = getDb();
  db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?`)
    .run(nowIso(), jti);
}

function revokeAllRefreshTokensForUser(userId) {
  const db = getDb();
  db.prepare(`UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
    .run(nowIso(), userId);
}

module.exports = {
  uuid,
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
};
