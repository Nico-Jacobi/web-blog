'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-static-' + Math.random().toString(36).slice(2);
const tmpStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-static-'));
const tmpWeb = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-web-'));
process.env.STORAGE_DIR = tmpStorage;
process.env.DB_PATH = path.join(tmpStorage, 'test.db');
process.env.WEB_DIR = tmpWeb;

// Lay out a fake build before requiring the app, so buildApp picks it up.
fs.writeFileSync(path.join(tmpWeb, 'index.html'), '<html><body>SPA root</body></html>');
fs.mkdirSync(path.join(tmpWeb, 'assets'));
fs.writeFileSync(path.join(tmpWeb, 'assets', 'main-abc123.js'), 'console.log(1);');
fs.writeFileSync(path.join(tmpWeb, 'sw.js'), '/* service worker */');

const { buildApp } = require('../index');
const db = require('../db');

let server, baseUrl;

before(async () => {
  db.init();
  const app = buildApp();
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(r => server.close(r));
  db.close();
  fs.rmSync(tmpStorage, { recursive: true, force: true });
  fs.rmSync(tmpWeb, { recursive: true, force: true });
});

test('GET / returns the SPA index.html with no-store', async () => {
  const r = await fetch(baseUrl + '/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/html/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const body = await r.text();
  assert.match(body, /SPA root/);
});

test('GET /any-blog-slug/stop/sydney falls back to index.html (deep link)', async () => {
  const r = await fetch(baseUrl + '/any-blog-slug/stop/sydney');
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.match(body, /SPA root/);
});

test('GET /assets/main-abc123.js gets long immutable cache', async () => {
  const r = await fetch(baseUrl + '/assets/main-abc123.js');
  assert.equal(r.status, 200);
  const cc = r.headers.get('cache-control') || '';
  assert.match(cc, /immutable/);
  assert.match(cc, /max-age=31536000/);
});

test('GET /sw.js gets no-store (SW updates must propagate)', async () => {
  const r = await fetch(baseUrl + '/sw.js');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('API still wins over SPA fallback (/health stays JSON)', async () => {
  const r = await fetch(baseUrl + '/health');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /json/);
  const body = await r.json();
  assert.equal(body.ok, true);
});

test('Unknown API path returns JSON 404, not the SPA', async () => {
  const r = await fetch(baseUrl + '/auth/totally-bogus');
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type') || '', /json/);
});

test('Unknown blog slug API path returns JSON 404, not the SPA', async () => {
  const r = await fetch(baseUrl + '/blogs/no-such-blog/meta');
  assert.equal(r.status, 404);
  assert.match(r.headers.get('content-type') || '', /json/);
});
