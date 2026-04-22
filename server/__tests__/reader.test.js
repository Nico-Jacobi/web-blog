'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-reader-' + Math.random().toString(36).slice(2);
const tmpStorage = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-reader-'));
process.env.STORAGE_DIR = tmpStorage;
process.env.DB_PATH = path.join(tmpStorage, 'test.db');

const { buildApp } = require('../index');
const db = require('../db');

let server;
let baseUrl;
let annaToken, annaBlog;
let bobToken, bobBlog;

const ANNA_READ_PW = 'friends2026';
const BOB_READ_PW = 'bob-secret';

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
    headers: r.headers,
  }));
}

before(async () => {
  db.init();
  const app = buildApp();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const annaReg = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'anna', password: 'secret123',
      blogSlug: 'anna-trip', blogTitle: 'Anna in Vietnam',
      readPassword: ANNA_READ_PW,
      settings: { subtitle: 'Annas Reise', theme: { primary: 'purple' } },
    },
  });
  annaToken = annaReg.body.accessToken;
  annaBlog = annaReg.body.blog;

  const bobReg = await fetchJson('/auth/register', {
    method: 'POST',
    body: {
      username: 'bob', password: 'secret123',
      blogSlug: 'bob-trip', blogTitle: 'Bob World',
      readPassword: BOB_READ_PW,
    },
  });
  bobToken = bobReg.body.accessToken;
  bobBlog = bobReg.body.blog;

  await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: { authorization: `Bearer ${annaToken}` },
    body: {
      path: 'data/points.json',
      content: [
        { id: 1, name: 'Hanoi', lat: 21.03, lon: 105.85, tripOrder: 0, titleImagePath: 'images/p1.jpg', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Hue', lat: 16.46, lon: 107.59, tripOrder: 1, titleImagePath: 'images/p2.jpg', otherImagePaths: ['images/p2b.jpg'], updatedAt: '2026-01-02T00:00:00Z' },
      ],
    },
  });
  await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: { authorization: `Bearer ${annaToken}` },
    body: {
      path: 'data/trips.json',
      content: [
        { id: 100, pointId1: 1, pointId2: 2, method: 'car', updatedAt: '2026-01-02T00:00:00Z' },
      ],
    },
  });

  const annaImages = path.join(tmpStorage, 'blogs', annaBlog.id, 'images');
  fs.writeFileSync(path.join(annaImages, 'p1.jpg'), Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]));

  await fetchJson('/me/blog/write', {
    method: 'POST',
    headers: { authorization: `Bearer ${bobToken}` },
    body: {
      path: 'data/points.json',
      content: [{ id: 1, name: 'Bobtown', lat: 0, lon: 0, tripOrder: 0, updatedAt: '2026-01-01T00:00:00Z' }],
    },
  });
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close();
  fs.rmSync(tmpStorage, { recursive: true, force: true });
});

test('GET /blogs/:slug/meta is public (no read token)', async () => {
  const r = await fetchJson('/blogs/anna-trip/meta');
  assert.equal(r.status, 200);
  assert.equal(r.body.slug, 'anna-trip');
  assert.equal(r.body.title, 'Anna in Vietnam');
  assert.equal(r.body.requiresPassword, true);
  assert.equal(r.body.settings.subtitle, 'Annas Reise');
  assert.equal(r.body.settings.theme.primary, 'purple');
});

test('GET /blogs/:slug/meta returns 404 for unknown slug', async () => {
  const r = await fetchJson('/blogs/nonexistent/meta');
  assert.equal(r.status, 404);
});

test('GET /blogs/:slug/files/data/points.json requires read token', async () => {
  const r = await fetchJson('/blogs/anna-trip/files/data/points.json');
  assert.equal(r.status, 401);
});

test('GET /blogs/:slug/files/data/points.json works with correct read token', async () => {
  const r = await fetchJson('/blogs/anna-trip/files/data/points.json', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 2);
  assert.equal(r.body[0].name, 'Hanoi');
});

test('GET /blogs/:slug/files/data/points.json rejects wrong read token', async () => {
  const r = await fetchJson('/blogs/anna-trip/files/data/points.json', {
    headers: { 'x-read-token': 'wrong-password' },
  });
  assert.equal(r.status, 401);
});

test("anna's read token does NOT unlock bob's blog (cross-tenant)", async () => {
  const r = await fetchJson('/blogs/bob-trip/files/data/points.json', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 401);
});

test('GET /blogs/:slug/files/images/<file> serves with long cache', async () => {
  const r = await fetch(baseUrl + '/blogs/anna-trip/files/images/p1.jpg', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 200);
  const cc = r.headers.get('cache-control');
  assert.ok(cc && cc.includes('max-age'), 'long-lived cache header');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf[0], 0xFF, 'starts with JPEG magic');
  assert.equal(buf[1], 0xD8, 'starts with JPEG magic');
});

test('GET /blogs/:slug/files/images/<missing> returns 404 with no-store', async () => {
  const r = await fetch(baseUrl + '/blogs/anna-trip/files/images/missing.jpg', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 404);
  const cc = r.headers.get('cache-control');
  assert.ok(cc && cc.includes('no-store'));
});

test('GET /blogs/:slug/files/images blocks path traversal', async () => {
  const r = await fetch(baseUrl + '/blogs/anna-trip/files/images/..%2F..%2Fapp.db', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.ok(r.status === 400 || r.status === 404);
});

test('thumbnail endpoint returns 404 when original is missing', async () => {
  const r = await fetch(baseUrl + '/blogs/anna-trip/files/images/.thumbs/missing.webp', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 404);
});

test('thumbnail endpoint generates on-the-fly from real image', async () => {
  let sharp;
  try { sharp = require('sharp'); } catch { return; }

  const annaImages = path.join(tmpStorage, 'blogs', annaBlog.id, 'images');
  const realImg = path.join(annaImages, 'real.png');
  await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
  }).png().toFile(realImg);

  const r = await fetch(baseUrl + '/blogs/anna-trip/files/images/.thumbs/real.webp', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 200);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.ok(buf.length > 0);
  const thumbAbs = path.join(annaImages, '.thumbs', 'real.webp');
  assert.ok(fs.existsSync(thumbAbs));
});

test('GET /blogs/:slug/routes returns array per trip', async () => {
  const r = await fetchJson('/blogs/anna-trip/routes', {
    headers: { 'x-read-token': ANNA_READ_PW },
  });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  if (r.body.length > 0) {
    const seg = r.body[0];
    assert.equal(seg.from, 1);
    assert.equal(seg.to, 2);
    assert.equal(seg.method, 'car');
    assert.ok(Array.isArray(seg.coords));
    assert.ok(seg.coords.length >= 2);
  }
});

test('public blog (no read password): no token needed', async () => {
  await fetchJson('/me/blog', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${bobToken}` },
    body: { readPassword: null },
  });

  const meta = await fetchJson('/blogs/bob-trip/meta');
  assert.equal(meta.status, 200);
  assert.equal(meta.body.requiresPassword, false);

  const data = await fetchJson('/blogs/bob-trip/files/data/points.json');
  assert.equal(data.status, 200);
});

test('POST /blogs/:slug/push/subscribe requires read token (when blog is protected)', async () => {
  const r = await fetchJson('/blogs/anna-trip/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: 'https://fcm.example.com/send/abc',
      keys: { p256dh: 'p1', auth: 'a1' },
    },
  });
  assert.equal(r.status, 401);
});

test('POST /blogs/:slug/push/subscribe accepts valid subscription', async () => {
  const r = await fetchJson('/blogs/anna-trip/push/subscribe', {
    method: 'POST',
    headers: { 'x-read-token': ANNA_READ_PW },
    body: {
      endpoint: 'https://fcm.example.com/send/abc',
      keys: { p256dh: 'p1', auth: 'a1' },
    },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  const subsFile = path.join(tmpStorage, 'blogs', annaBlog.id, 'push-subscriptions.json');
  assert.ok(fs.existsSync(subsFile));
  const subs = JSON.parse(fs.readFileSync(subsFile, 'utf8'));
  assert.equal(subs.length, 1);
  assert.equal(subs[0].endpoint, 'https://fcm.example.com/send/abc');
});

test('push subscription file is per-blog (no cross-tenant pollution)', async () => {
  await fetchJson('/blogs/bob-trip/push/subscribe', {
    method: 'POST',
    body: {
      endpoint: 'https://fcm.example.com/send/bob',
      keys: { p256dh: 'pB', auth: 'aB' },
    },
  });
  const annaSubs = JSON.parse(fs.readFileSync(
    path.join(tmpStorage, 'blogs', annaBlog.id, 'push-subscriptions.json'), 'utf8'
  ));
  assert.ok(!annaSubs.some(s => s.endpoint.includes('/send/bob')));
});
