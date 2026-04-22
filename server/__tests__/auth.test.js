'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-' + Math.random().toString(36).slice(2);
const tmpStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-auth-'));
process.env.STORAGE_DIR = tmpStorage;
process.env.DB_PATH = path.join(tmpStorage, 'test.db');

const { buildApp } = require('../index');
const db = require('../db');

let server;
let baseUrl;

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

before(async () => {
  db.init();
  const app = buildApp();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(tmpStorage, { recursive: true, force: true });
});

test('GET /health returns ok', async () => {
  const r = await fetchJson('/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

test('POST /auth/register creates user + blog', async () => {
  const r = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'anna',
      password: 'secret123',
      blogSlug: 'anna-trip',
      blogTitle: 'Anna in Vietnam',
      readPassword: 'friends2026',
    },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.username, 'anna');
  assert.equal(r.body.blog.slug, 'anna-trip');
  assert.equal(r.body.blog.settings.title, 'Anna in Vietnam');
  assert.equal(r.body.blog.hasReadPassword, true);
  assert.ok(r.body.accessToken);
  assert.ok(r.body.refreshToken);
  assert.ok(fs.existsSync(path.join(tmpStorage, 'blogs', r.body.blog.id, 'data')));
  assert.ok(fs.existsSync(path.join(tmpStorage, 'blogs', r.body.blog.id, 'images', '.thumbs')));
});

test('POST /auth/register rejects duplicate username', async () => {
  const r = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'anna',
      password: 'secret123',
      blogSlug: 'anna-other',
      blogTitle: 'Clash',
    },
  });
  assert.equal(r.status, 409);
});

test('POST /auth/register rejects duplicate slug', async () => {
  const r = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'someoneelse',
      password: 'secret123',
      blogSlug: 'anna-trip',
      blogTitle: 'Clash',
    },
  });
  assert.equal(r.status, 409);
});

test('POST /auth/register rejects reserved slug', async () => {
  const r = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'ben',
      password: 'secret123',
      blogSlug: 'admin',
      blogTitle: 'Clash',
    },
  });
  assert.equal(r.status, 400);
});

test('POST /auth/register rejects short password', async () => {
  const r = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'shorty',
      password: '1234',
      blogSlug: 'shorty-blog',
      blogTitle: 'x',
    },
  });
  assert.equal(r.status, 400);
});

test('POST /auth/login accepts valid credentials', async () => {
  const r = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.accessToken);
  assert.equal(r.body.user.username, 'anna');
});

test('POST /auth/login rejects wrong password', async () => {
  const r = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'wrongpass' },
  });
  assert.equal(r.status, 401);
});

test('POST /auth/login rejects unknown user (no leak)', async () => {
  const r = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'ghost', password: 'secret123' },
  });
  assert.equal(r.status, 401);
});

test('GET /me requires auth', async () => {
  const r = await fetchJson('/me');
  assert.equal(r.status, 401);
});

test('GET /me works with access token', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const token = login.body.accessToken;
  const r = await fetchJson('/me', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.username, 'anna');
  assert.equal(r.body.blog.slug, 'anna-trip');
});

test('GET /me rejects malformed token', async () => {
  const r = await fetchJson('/me', { headers: { authorization: 'Bearer garbage' } });
  assert.equal(r.status, 401);
});

test('PATCH /me/blog updates settings', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const token = login.body.accessToken;

  const r = await fetchJson('/me/blog', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
    body: {
      settings: {
        subtitle: 'Eine Reise durch Asien',
        theme: { primary: 'purple' },
      },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.blog.settings.subtitle, 'Eine Reise durch Asien');
  assert.equal(r.body.blog.settings.theme.primary, 'purple');
  assert.equal(r.body.blog.settings.theme.accent, 'slate', 'defaults preserved');
});

test('PATCH /me/blog rejects extra fields', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const token = login.body.accessToken;

  const r = await fetchJson('/me/blog', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
    body: { settings: { bogus: 'x' } },
  });
  assert.equal(r.status, 400);
});

test('PATCH /me/blog can clear read password', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const token = login.body.accessToken;

  const r = await fetchJson('/me/blog', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
    body: { readPassword: null },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.blog.hasReadPassword, false);
});

test('POST /auth/refresh issues new access token', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const refresh = login.body.refreshToken;

  const r = await fetchJson('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refresh },
  });
  assert.equal(r.status, 200);
  assert.ok(r.body.accessToken);
});

test('POST /auth/refresh rejects revoked token after logout', async () => {
  const login = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const refresh = login.body.refreshToken;

  const logout = await fetchJson('/auth/logout', {
    method: 'POST',
    body: { refreshToken: refresh },
  });
  assert.equal(logout.status, 200);

  const r = await fetchJson('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refresh },
  });
  assert.equal(r.status, 401);
});

test('two users are fully isolated', async () => {
  const reg = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'bob',
      password: 'secret123',
      blogSlug: 'bob-blog',
      blogTitle: 'Bob World',
    },
  });
  assert.equal(reg.status, 201);
  const bobToken = reg.body.accessToken;

  const annaLogin = await fetchJson('/auth/login', {
    method: 'POST',
    body: { username: 'anna', password: 'secret123' },
  });
  const annaToken = annaLogin.body.accessToken;

  const annaMe = await fetchJson('/me', { headers: { authorization: `Bearer ${annaToken}` } });
  const bobMe = await fetchJson('/me', { headers: { authorization: `Bearer ${bobToken}` } });

  assert.equal(annaMe.body.blog.slug, 'anna-trip');
  assert.equal(bobMe.body.blog.slug, 'bob-blog');
  assert.notEqual(annaMe.body.blog.id, bobMe.body.blog.id);

  const annaDir = path.join(tmpStorage, 'blogs', annaMe.body.blog.id);
  const bobDir = path.join(tmpStorage, 'blogs', bobMe.body.blog.id);
  assert.ok(fs.existsSync(annaDir));
  assert.ok(fs.existsSync(bobDir));
  assert.notEqual(annaDir, bobDir);
});
