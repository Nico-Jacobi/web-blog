// Service worker — push notifications + image cache.
//
// Image strategy: cache-first under `images-v1`.  Auth-Token is held in
// IndexedDB so it survives SW restarts and cold starts.  The main thread
// pushes the current token via postMessage on every load.
//
// Cross-origin: this SW is served from 1ej.de but proxies image requests
// to api.1ej.de.  CORS is enabled server-side without restrictions.

const IMAGE_CACHE = 'images-v1';
const API_HOST = 'api.1ej.de';
const IMAGE_PATH_PREFIX = '/files/images/';

// ── auth token persistence (IndexedDB) ───────────────────────────────
const DB_NAME = 'sw-auth';
const STORE = 'kv';
const KEY = 'auth_token';

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// In-memory cache so we don't hit IDB on every fetch.
let cachedAuthToken = null;
async function getAuthToken() {
    if (cachedAuthToken) return cachedAuthToken;
    try {
        cachedAuthToken = await idbGet(KEY);
    } catch (e) { /* ignore */ }
    return cachedAuthToken;
}

// On a fresh visit the page may still be loading the token from its
// cookie when the first <img> request hits us.  Wait briefly so the
// initial fetches don't fail with 401 before the postMessage arrives.
async function waitForAuthToken(timeoutMs = 2000) {
    const existing = await getAuthToken();
    if (existing) return existing;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 50));
        if (cachedAuthToken) return cachedAuthToken;
    }
    return null;
}

// ── lifecycle ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Drop old image caches if we ever bump the version.
        const names = await caches.keys();
        await Promise.all(
            names.filter(n => n.startsWith('images-') && n !== IMAGE_CACHE)
                 .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

// ── auth message from page ───────────────────────────────────────────
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'auth' && typeof data.token === 'string') {
        cachedAuthToken = data.token;
        idbSet(KEY, data.token).catch(() => {});
    }
});

// ── image fetch interception ─────────────────────────────────────────
function isImageRequest(url) {
    return url.hostname === API_HOST && url.pathname.startsWith(IMAGE_PATH_PREFIX);
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (!isImageRequest(url)) return;

    event.respondWith(handleImageRequest(event.request));
});

async function handleImageRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);

    // Cache-first: serve from cache without touching the network.
    // Images are content-addressed by path, so they're effectively immutable.
    const cached = await cache.match(request);
    if (cached) return cached;

    // Cache miss → fetch with injected auth header.  We can't pass the
    // page's <img> request through directly because <img> can't set
    // custom headers; we re-issue it here so the auth check passes.
    const token = await waitForAuthToken();
    const headers = new Headers(request.headers);
    if (token) headers.set('X-Auth-Token', token);

    let response;
    try {
        response = await fetch(request.url, {
            method: 'GET',
            headers,
            mode: 'cors',
            credentials: 'omit',
        });
    } catch (err) {
        // Network failure — return a synthetic error so <img> shows broken state.
        return new Response('', { status: 504, statusText: 'Image fetch failed' });
    }

    // Only cache successful, opaque-free responses.
    if (response.ok) {
        // Clone before caching — body can only be read once.
        cache.put(request, response.clone()).catch(() => {});
    }
    return response;
}

// ── push notifications (unchanged) ───────────────────────────────────
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'Jenny hat was Neues gepostet!';
    const options = {
        body: data.body || 'Ein neuer Ort wurde zur Reise hinzugefügt.',
        icon: '/kangaroo.svg',
        badge: '/kangaroo_96.png',
        data: { url: self.location.origin }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(self.location.origin);
        })
    );
});
