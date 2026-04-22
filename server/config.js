'use strict';

require('dotenv').config();
const path = require('path');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_TEST = NODE_ENV === 'test';

const PORT = parseInt(process.env.PORT, 10) || 3000;
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || './storage');
const WEB_DIR = path.resolve(process.env.WEB_DIR || './website/dist');
const DB_PATH = path.resolve(
  process.env.DB_PATH || path.join(STORAGE_DIR, 'app.db')
);

const JWT_SECRET = IS_TEST
  ? (process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod')
  : requireEnv('JWT_SECRET');

const ACCESS_TOKEN_TTL_SEC = parseInt(process.env.ACCESS_TOKEN_TTL_SEC, 10) || 15 * 60;
const REFRESH_TOKEN_TTL_SEC = parseInt(process.env.REFRESH_TOKEN_TTL_SEC, 10) || 30 * 24 * 60 * 60;

const ARGON2_OPTS = {
  type: 2,
  memoryCost: parseInt(process.env.ARGON2_MEMORY_KB, 10) || 19456,
  timeCost: parseInt(process.env.ARGON2_TIME_COST, 10) || 2,
  parallelism: parseInt(process.env.ARGON2_PARALLELISM, 10) || 1,
};

const RATE_LIMITS = {
  globalWindowMs: 15 * 60 * 1000,
  globalMax: 1000,
  authWindowMs: 15 * 60 * 1000,
  authMax: 30,
};

const VAPID = {
  contact: process.env.VAPID_CONTACT || 'admin@example.com',
  publicKey: process.env.VAPID_PUBLIC_KEY || null,
  privateKey: process.env.VAPID_PRIVATE_KEY || null,
};

const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/;
const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const PASSWORD_MIN_LENGTH = 8;

module.exports = {
  NODE_ENV,
  IS_TEST,
  PORT,
  STORAGE_DIR,
  WEB_DIR,
  DB_PATH,
  JWT_SECRET,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  ARGON2_OPTS,
  RATE_LIMITS,
  VAPID,
  USERNAME_REGEX,
  SLUG_REGEX,
  PASSWORD_MIN_LENGTH,
};
