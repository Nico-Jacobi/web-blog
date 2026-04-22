// Service worker — push notifications + image cache.
//
// Multi-tenant aware: caches are scoped by blog slug so two blogs opened in
// the same browser don't pollute each other. The page sends `{ slug, token }`
// via postMessage on every load; both are persisted in IndexedDB so the SW
// can serve the right per-blog header on a cold start.
//
// Image strategy: cache-first under `images-v3-<slug>`. Image URLs match the
// new server prefix `/blogs/<slug>/files/images/`.

const IMAGE_CACHE_PREFIX = 'images-v3-';
const IMAGE_PATH_RE = /^\/blogs\/([^/]+)\/files\/images\//;

// ── per-slug auth token persistence (IndexedDB) ──────────────────────
const DB_NAME = 'sw-auth';
const STORE = 'tokens';

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            const db = req.result;
            // Re-create the store on upgrade — drops legacy single-token data.
            if (db.objectStoreNames.contains('kv')) db.deleteObjectStore('kv');
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(slug) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(slug);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbSet(slug, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, slug);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

const cachedTokens = new Map(); // slug -> token (or null for public blogs)

async function getAuthToken(slug) {
    if (cachedTokens.has(slug)) return cachedTokens.get(slug);
    try {
        const value = await idbGet(slug);
        cachedTokens.set(slug, value || null);
        return value || null;
    } catch (_) {
        return null;
    }
}

async function waitForAuthToken(slug, timeoutMs = 2000) {
    const existing = await getAuthToken(slug);
    if (existing) return existing;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 50));
        if (cachedTokens.get(slug)) return cachedTokens.get(slug);
    }
    return null;
}

// ── lifecycle ────────────────────────────────────────────────────────
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Drop any image caches that aren't from the current major version.
        const names = await caches.keys();
        await Promise.all(
            names.filter(n => n.startsWith('images-') && !n.startsWith(IMAGE_CACHE_PREFIX))
                 .map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

// ── auth message from page ───────────────────────────────────────────
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'auth' && typeof data.slug === 'string') {
        const token = typeof data.token === 'string' ? data.token : null;
        cachedTokens.set(data.slug, token);
        idbSet(data.slug, token).catch(() => {});
    }
});

// ── image fetch interception ─────────────────────────────────────────
function imageRequestSlug(url) {
    const m = url.pathname.match(IMAGE_PATH_RE);
    return m ? m[1] : null;
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    const slug = imageRequestSlug(url);
    if (!slug) return;
    event.respondWith(handleImageRequest(event.request, slug));
});

async function handleImageRequest(request, slug) {
    const url = new URL(request.url);
    const isVid = /\.(mp4|mov|webm)$/i.test(url.pathname);

    const cacheName = IMAGE_CACHE_PREFIX + slug;
    const cache = await caches.open(cacheName);

    // Cache-first for images. Videos are excluded so Range requests work.
    if (!isVid) {
        const cached = await cache.match(request);
        if (cached) return cached;
    }

    const token = await waitForAuthToken(slug);
    const headers = new Headers(request.headers);
    if (token) headers.set('X-Read-Token', token);

    let response;
    for (let attempt = 0; attempt <= 1; attempt++) {
        try {
            response = await fetch(request.url, {
                method: 'GET',
                headers,
                mode: 'cors',
                credentials: 'omit',
            });
            break;
        } catch (err) {
            if (attempt === 1) {
                return new Response('', { status: 504, statusText: 'Image fetch failed' });
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (response.ok && !isVid) {
        cache.put(request, response.clone()).catch(() => {});
    }
    return response;
}

// ── push notifications ───────────────────────────────────────────────
// Push payloads include `slug` so the click handler opens the right blog.
self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'New post';
    const slug = data.slug || '';
    const options = {
        body: data.body || 'Open the blog to see what\'s new.',
        icon: '/kangaroo.svg',
        badge: '/kangaroo_96.png',
        data: { slug, url: slug ? `${self.location.origin}/${slug}` : self.location.origin },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = event.notification.data?.url || self.location.origin;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.startsWith(target) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(target);
        })
    );
});
