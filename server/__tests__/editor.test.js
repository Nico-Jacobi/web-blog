'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-editor-' + Math.random().toString(36).slice(2);
const tmpStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-editor-'));
process.env.STORAGE_DIR = tmpStorage;
process.env.DB_PATH = path.join(tmpStorage, 'test.db');

const { buildApp } = require('../index');
const db = require('../db');

let server;
let baseUrl;
let annaToken, annaBlog;
let bobToken, bobBlog;

function fetchJson(pathname, opts = {}) {
  return fetch(baseUrl + pathname, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
}

function authHeaders(token) {
  return { authorization: `Bearer ${token}` };
}

before(async () => {
  db.init();
  const app = buildApp();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const annaReg = await fetchJson('/auth/register', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123', blogSlug: 'anna-trip', blogTitle: 'Anna' },
  });
  annaToken = annaReg.body.accessToken;
  annaBlog = annaReg.body.blog;

  const bobReg = await fetchJson('/auth/register', {
    method: 'POST',
    body: { username: 'bob', password: 'secret123', blogSlug: 'bob-trip', blogTitle: 'Bob' },
  });
  bobToken = bobReg.body.accessToken;
  bobBlog = bobReg.body.blog;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(tmpStorage, { recursive: true, force: true });
});

test('POST /me/blog/write requires auth', async () => {
  const r = await fetchJson('/me/blog/write', {
    method: 'POST',
    body: { path: 'data/foo.json', content: { x: 1 } },
  });
  assert.equal(r.status, 401);
});

test('POST /me/blog/write writes plain JSON file', async () => {
  const r = await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: { path: 'data/notes.json', content: { hello: 'world' } },
  });
  assert.equal(r.status, 200);
  const fileContent = fs.readFileSync(
    path.join(tmpStorage, 'blogs', annaBlog.id, 'data', 'notes.json'),
    'utf8'
  );
  assert.deepEqual(JSON.parse(fileContent), { hello: 'world' });
});

test('POST /me/blog/write rejects path traversal', async () => {
  const r = await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: { path: '../../../etc/escape.json', content: { x: 1 } },
  });
  assert.equal(r.status, 400);
  assert.ok(!fs.existsSync(path.join(tmpStorage, 'etc', 'escape.json')));
});

test('POST /me/blog/write merges points.json (CRDT)', async () => {
  const round1 = await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: {
      path: 'data/points.json',
      content: [
        { id: 1, name: 'Sydney', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Melbourne', updatedAt: '2026-01-02T00:00:00Z' },
      ],
    },
  });
  assert.equal(round1.status, 200);
  assert.equal(round1.body.content.length, 2);

  const round2 = await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: {
      path: 'data/points.json',
      content: [
        { id: 2, name: 'Melbourne renamed', updatedAt: '2026-02-01T00:00:00Z' },
        { id: 3, name: 'Brisbane', updatedAt: '2026-02-01T00:00:00Z' },
      ],
    },
  });
  assert.equal(round2.status, 200);
  const merged = round2.body.content;
  assert.equal(merged.length, 3, 'point 1 (server-only), 2 (newer client), 3 (new) all survive');
  const m2 = merged.find(p => p.id === 2);
  assert.equal(m2.name, 'Melbourne renamed');
});

test('GET /me/blog/list lists tenant root', async () => {
  const r = await fetchJson('/me/blog/list?path=data', {
    headers: authHeaders(annaToken),
  });
  assert.equal(r.status, 200);
  const fileNames = r.body.files.map(f => f.name).sort();
  assert.ok(fileNames.includes('notes.json'));
  assert.ok(fileNames.includes('points.json'));
});

test('GET /me/blog/list returns empty for non-existent path (no error)', async () => {
  const r = await fetchJson('/me/blog/list?path=nonexistent', {
    headers: authHeaders(annaToken),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.files.length, 0);
  assert.equal(r.body.folders.length, 0);
});

test('POST /me/blog/verify-batch reports existence per file', async () => {
  const r = await fetchJson('/me/blog/verify-batch', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: { paths: ['data/notes.json', 'data/missing.json', 'data/points.json'] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body['data/notes.json'].exists, true);
  assert.equal(r.body['data/missing.json'].exists, false);
  assert.equal(r.body['data/points.json'].exists, true);
});

test('POST /me/blog/verify finds file with alternative extension', async () => {
  const fakeMp4 = path.join(tmpStorage, 'blogs', annaBlog.id, 'images', 'video.mp4');
  fs.mkdirSync(path.dirname(fakeMp4), { recursive: true });
  fs.writeFileSync(fakeMp4, 'fake video content');

  const r = await fetchJson('/me/blog/verify', {
    method: 'POST',
    headers: authHeaders(annaToken),
    body: { path: 'images/video.jpg' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.exists, true);
});

test('DELETE /me/blog/delete removes file', async () => {
  const r = await fetchJson('/me/blog/delete', {
    method: 'DELETE',
    headers: authHeaders(annaToken),
    body: { path: 'data/notes.json' },
  });
  assert.equal(r.status, 200);
  assert.ok(!fs.existsSync(path.join(tmpStorage, 'blogs', annaBlog.id, 'data', 'notes.json')));
});

test('cross-tenant isolation: bob cannot read anna data', async () => {
  const annaPoints = path.join(tmpStorage, 'blogs', annaBlog.id, 'data', 'points.json');
  assert.ok(fs.existsSync(annaPoints), 'Anna has data file');

  const bobList = await fetchJson('/me/blog/list?path=data', {
    headers: authHeaders(bobToken),
  });
  assert.equal(bobList.status, 200);
  const bobNames = bobList.body.files.map(f => f.name);
  assert.ok(!bobNames.includes('points.json'),
    'Bob list should not show Anna points.json');
});

test('cross-tenant isolation: bob writing same file path does not touch anna data', async () => {
  await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: authHeaders(bobToken),
    body: {
      path: 'data/points.json',
      content: [{ id: 99, name: 'Bobtown', updatedAt: '2026-03-01T00:00:00Z' }],
    },
  });
  const annaRaw = fs.readFileSync(
    path.join(tmpStorage, 'blogs', annaBlog.id, 'data', 'points.json'),
    'utf8'
  );
  const annaArr = JSON.parse(annaRaw);
  assert.ok(!annaArr.some(p => p.id === 99 && p.name === 'Bobtown'),
    "Bob's write must not appear in Anna's file");

  const bobRaw = fs.readFileSync(
    path.join(tmpStorage, 'blogs', bobBlog.id, 'data', 'points.json'),
    'utf8'
  );
  const bobArr = JSON.parse(bobRaw);
  assert.ok(bobArr.some(p => p.id === 99 && p.name === 'Bobtown'));
});

test('upload via multipart form-data writes file under tenant', async () => {
  const FormData = globalThis.FormData;
  const fd = new FormData();
  fd.append('path', 'images/test.txt');
  fd.append('file', new Blob(['hello upload']), 'test.txt');

  const r = await fetch(baseUrl + '/me/blog/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${annaToken}` },
    body: fd,
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.message, 'Uploaded');
  assert.equal(body.size, 12);

  const written = fs.readFileSync(
    path.join(tmpStorage, 'blogs', annaBlog.id, 'images', 'test.txt'),
    'utf8'
  );
  assert.equal(written, 'hello upload');
});

test('upload rejects path traversal in field path', async () => {
  const FormData = globalThis.FormData;
  const fd = new FormData();
  fd.append('path', '../../escape.txt');
  fd.append('file', new Blob(['evil']), 'evil.txt');

  const r = await fetch(baseUrl + '/me/blog/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${annaToken}` },
    body: fd,
  });
  assert.equal(r.status, 400);
  assert.ok(!fs.existsSync(path.join(tmpStorage, 'escape.txt')));
});

test('GET /me/blog (settings) still works alongside /me/blog/* editor routes', async () => {
  const r = await fetchJson('/me/blog', { headers: authHeaders(annaToken) });
  assert.equal(r.status, 200);
  assert.equal(r.body.blog.slug, 'anna-trip');
});

test('PATCH /me/blog (settings) still works alongside editor routes', async () => {
  const r = await fetchJson('/me/blog', {
    method: 'PATCH',
    headers: authHeaders(annaToken),
    body: { settings: { subtitle: 'New subtitle' } },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.blog.settings.subtitle, 'New subtitle');
});
