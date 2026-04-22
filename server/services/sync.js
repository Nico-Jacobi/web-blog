'use strict';

const fs = require('fs').promises;

const _writeLocks = new Map();

async function withFileLock(key, fn) {
  const prev = _writeLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise(r => { release = r; });
  const chain = prev.then(() => next);
  _writeLocks.set(key, chain);
  await prev;
  try { return await fn(); }
  finally {
    release();
    if (_writeLocks.get(key) === chain) _writeLocks.delete(key);
  }
}

function _ts(v) {
  if (!v) return -Infinity;
  const n = Date.parse(v);
  return Number.isNaN(n) ? -Infinity : n;
}

function mergeById(serverArr, clientArr, keyFn) {
  const by = new Map();
  for (const item of serverArr) by.set(keyFn(item), item);
  for (const item of clientArr) {
    const k = keyFn(item);
    const existing = by.get(k);
    if (!existing) { by.set(k, item); continue; }
    by.set(k, _ts(item.updatedAt) > _ts(existing.updatedAt) ? item : existing);
  }
  return Array.from(by.values());
}

const mergePoints = (s, c) => mergeById(s, c, p => p.id);
const _tripKey = t => t.id ?? (t.pointId1 * 1000000 + t.pointId2);
const mergeTrips = (s, c) => mergeById(s, c, _tripKey);

async function readJsonArrayOrEmpty(fullPath) {
  try {
    const raw = await fs.readFile(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  withFileLock,
  mergeById,
  mergePoints,
  mergeTrips,
  readJsonArrayOrEmpty,
};
