require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const rateLimit = require('express-rate-limit');
const busboy = require('busboy');

// sharp is a native module — fail loud if missing so we don't silently
// stop generating thumbnails.  Run `npm install sharp` on the host.
let sharp = null;
try {
    sharp = require('sharp');
    console.log('✅ sharp loaded — thumbnail generation enabled');
} catch (err) {
    console.warn('⚠️  sharp not installed — thumbnails disabled. Run: npm install sharp');
}

let exifr = null;
try {
    exifr = require('exifr');
    console.log('✅ exifr loaded — server-side GPS extraction enabled');
} catch {
    console.warn('⚠️  exifr not installed — image GPS markers disabled. Run: npm install exifr');
}

const { spawn } = require('child_process');

const app = express();
app.set('trust proxy', 1); // 1 = trust first proxy

// --- WEB PUSH ---
let webpush = null;
try {
    webpush = require('web-push');
    webpush.setVapidDetails(
        'mailto:' + (process.env.VAPID_CONTACT || 'admin@example.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
    console.log('✅ Web Push initialized');
} catch {
    console.warn('⚠️  web-push not installed — push notifications disabled. Run: npm install web-push');
}

// --- CONFIGURATION (Use Environment Variables) ---
const PORT = process.env.PORT || 3000;
const READ_PASS = process.env.READ_PASS;
const WRITE_PASS = process.env.WRITE_PASS;
const ADMIN_PANEL_PASS = process.env.ADMIN_PANEL_PASS;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');
const SETTINGS_FILE = path.join(UPLOAD_DIR, 'data', 'settings.json');
const ROUTE_STYLES_FILE = path.join(UPLOAD_DIR, 'data', 'route-styles.json');

// Mutable — updated when admin changes settings without restart
let currentReadPass = READ_PASS;
let currentTitleMain = "Jennys & Leons";
let currentTitleAccent = "Australien Trip";
let currentTabTitle = "Jennys & Leons Australien Trip";
let currentAccentColor = "#ea580c";
let currentSiteIcon = "🦘";
let currentRouteStyles = {};

async function loadRouteStyles() {
    try {
        const raw = await fs.readFile(ROUTE_STYLES_FILE, 'utf8');
        currentRouteStyles = JSON.parse(raw);
    } catch { /* no route-styles file yet, use client defaults */ }
}
loadRouteStyles();

async function loadSettings() {
    try {
        const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
        const s = JSON.parse(raw);
        if (s.readPass)      currentReadPass    = s.readPass;
        if (s.titleMain)     currentTitleMain   = s.titleMain;
        if (s.titleAccent !== undefined) currentTitleAccent = s.titleAccent;
        if (s.tabTitle)      currentTabTitle    = s.tabTitle;
        if (s.accentColor)   currentAccentColor = s.accentColor;
        if (s.siteIcon)      currentSiteIcon    = s.siteIcon;
    } catch { /* no settings file yet, use defaults */ }
}
loadSettings();
const WEB_DIR = path.resolve(process.env.WEB_DIR || './react-site');
const SUBSCRIPTIONS_FILE = path.resolve('./push-subscriptions.json');

// --- THUMBNAIL CONFIG ---
// Thumbnails live next to originals in a hidden ".thumbs" directory:
//   storage/media/sydney/bar.jpg  →  storage/media/.thumbs/sydney/bar.webp
// Generated on upload, on-demand on first request, or via the backfill
// script (scripts/backfill-thumbs.js).  Legacy clients ignore them.
const THUMB_DIR = '.thumbs';
const THUMB_WIDTH = 480;       // px, longer edge ish
const THUMB_QUALITY = 75;      // webp quality
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);
const MEDIA_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm'];
const THUMB_SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']); // sharp w/o libheif

// --- PUSH HELPERS ---
async function loadSubscriptions() {
    try {
        const data = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveSubscriptions(subs) {
    await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2));
}

async function sendPushToAll(payload) {
    if (!webpush) return;
    const subs = await loadSubscriptions();
    const dead = [];
    await Promise.allSettled(subs.map(async (sub, i) => {
        try {
            await webpush.sendNotification(sub, JSON.stringify(payload));
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) dead.push(i);
        }
    }));
    if (dead.length) {
        const pruned = subs.filter((_, i) => !dead.includes(i));
        await saveSubscriptions(pruned);
        console.log(`🧹 Removed ${dead.length} expired push subscription(s)`);
    }
}

// --- MIDDLEWARE ---
// helmet's default Cross-Origin-Resource-Policy is "same-origin", which
// blocks <img src="api.1ej.de/..."> when the page is on 1ej.de.  We need
// cross-origin so the website can embed images served by this API.
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: ['https://1ej.de', /^http:\/\/localhost(:\d+)?$/],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'x-admin-token'],
}));
app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Rate limiting to prevent brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 3000,
    message: { error: "Too many requests, please try again later." }
});
app.use(limiter);

// Ensure storage exists (mkdir recursive is a no-op if it already exists)
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(err =>
    console.error('Failed to create upload dir:', err.message));

// --- HELPERS ---
const sanitizePath = (userPath = '') => {
    const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(UPLOAD_DIR, normalized);
    if (!fullPath.startsWith(UPLOAD_DIR)) throw new Error('Invalid path');
    return fullPath;
};

// ── MAGIC-BYTE CONTENT DETECTION ─────────────────────────────────────
// Legacy Flutter apps sometimes upload videos with .jpg extensions
// (pickMultipleMedia returns temp paths without original extension).
// Detect the real type from file header bytes so we can rename on upload.
async function detectRealExt(absPath) {
    let fd;
    try {
        fd = await fs.open(absPath, 'r');
        const buf = Buffer.alloc(12);
        await fd.read(buf, 0, 12, 0);

        // JPEG: FF D8 FF
        if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return '.jpg';
        // PNG: 89 50 4E 47
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return '.png';
        // WebP: RIFF....WEBP
        if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
        // MP4/MOV: ftyp at bytes 4-7
        if (buf.toString('ascii', 4, 8) === 'ftyp') return '.mp4';
        // WebM/MKV: EBML header 1A 45 DF A3
        if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return '.webm';

        return null; // unknown
    } catch {
        return null;
    } finally {
        if (fd) await fd.close();
    }
}

// Check whether the claimed extension matches the real content.
// Returns the correct absolute path (renamed) or the original if fine.
async function fixExtensionIfNeeded(absPath) {
    const claimedExt = path.extname(absPath).toLowerCase();
    const realExt = await detectRealExt(absPath);
    if (!realExt || realExt === claimedExt) return absPath;
    // .jpeg and .jpg are equivalent
    if ((claimedExt === '.jpeg' && realExt === '.jpg') ||
        (claimedExt === '.jpg' && realExt === '.jpeg')) return absPath;

    const corrected = absPath.replace(/\.[^.]+$/, realExt);
    await fs.rename(absPath, corrected);
    const relOld = path.relative(UPLOAD_DIR, absPath).replace(/\\/g, '/');
    const relNew = path.relative(UPLOAD_DIR, corrected).replace(/\\/g, '/');
    console.log(`🔄 Renamed mismatched file: ${relOld} → ${relNew}`);
    return corrected;
}

// Given a path relative to media/ (e.g. 'sydney/foo.jpg'), find the actual
// file on disk even if the extension was corrected.  Returns the original
// relative path or the corrected one if the extension was renamed.
async function resolveMediaFilename(filename) {
    const absPath = path.join(UPLOAD_DIR, 'media', filename);
    try { await fs.access(absPath); return filename; } catch { /* missing */ }

    const stem = filename.replace(/\.[^.]+$/, '');
    for (const ext of MEDIA_EXTS) {
        const alt = stem + ext;
        try {
            await fs.access(path.join(UPLOAD_DIR, 'media', alt));
            return alt;
        } catch { continue; }
    }
    return filename; // not found anywhere, return original
}

// ── THUMBNAIL HELPERS ─────────────────────────────────────────────────
// Map an original image rel path to its thumbnail rel path:
//   media/sydney/bar.jpg → media/.thumbs/sydney/bar.webp
function thumbRelPathFor(originalRel) {
    const m = originalRel.match(/^media[\\/](.+)$/i);
    if (!m) return null;
    const rest = m[1].replace(/\\/g, '/');
    const dir = path.posix.dirname(rest);
    const stem = path.posix.basename(rest, path.posix.extname(rest));
    const sub = dir === '.' ? '' : dir + '/';
    return `media/${THUMB_DIR}/${sub}${stem}.webp`;
}

// Reverse: from thumb rel path, find the original on disk by trying
// likely extensions.  Returns absolute path or null.
async function findOriginalForThumbRel(thumbRel) {
    const m = thumbRel.match(/^media[\\/]\.thumbs[\\/](.+)\.webp$/i);
    if (!m) return null;
    const stem = m[1].replace(/\\/g, '/'); // sydney/bar
    const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP', 'heic', 'HEIC', 'heif', 'HEIF'];
    for (const ext of exts) {
        const candidate = path.join(UPLOAD_DIR, 'media', `${stem}.${ext}`);
        try {
            await fs.access(candidate);
            return candidate;
        } catch { /* try next */ }
    }
    return null;
}

// Concurrent requests for the same thumb share one generation promise
// so we don't fight ourselves on disk.
const PENDING_THUMBS = new Map();

async function generateThumbnail(originalAbs, thumbAbs) {
    if (!sharp) return false;
    const ext = path.extname(originalAbs).toLowerCase();
    if (!THUMB_SUPPORTED_EXTS.has(ext)) {
        // HEIC/HEIF skipped — sharp w/o libheif can't decode them.
        return false;
    }
    if (PENDING_THUMBS.has(thumbAbs)) return PENDING_THUMBS.get(thumbAbs);

    const promise = (async () => {
        try {
            await fs.mkdir(path.dirname(thumbAbs), { recursive: true });
            await sharp(originalAbs)
                .rotate() // honour EXIF orientation
                .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
                .webp({ quality: THUMB_QUALITY })
                .toFile(thumbAbs);
            console.log(`🖼️  Thumb generated: ${path.relative(UPLOAD_DIR, thumbAbs)}`);
            return true;
        } catch (err) {
            console.log(`❌ THUMB FAILED: ${path.relative(UPLOAD_DIR, originalAbs)} - ${err.message}`);
            return false;
        } finally {
            PENDING_THUMBS.delete(thumbAbs);
        }
    })();
    PENDING_THUMBS.set(thumbAbs, promise);
    return promise;
}

// Fire-and-forget: generate the thumbnail for a freshly uploaded original.
function maybeGenerateThumbForUpload(originalAbs) {
    const ext = path.extname(originalAbs).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) return;
    const rel = path.relative(UPLOAD_DIR, originalAbs).replace(/\\/g, '/');
    const thumbRel = thumbRelPathFor(rel);
    if (!thumbRel) return;
    const thumbAbs = path.join(UPLOAD_DIR, thumbRel);
    generateThumbnail(originalAbs, thumbAbs).catch(() => {});
}

// Fire-and-forget: extract GPS from a newly uploaded image and add it to the cache.
function maybeAddGpsToCache(originalAbs) {
    const ext = path.extname(originalAbs).toLowerCase();
    if (!IMAGE_EXTS.has(ext) || !exifr) return;
    const relFull = path.relative(UPLOAD_DIR, originalAbs).replace(/\\/g, '/');
    // Only handle paths under media/
    if (!relFull.startsWith('media/')) return;
    const imgRel = relFull.replace(/^media\//, '');

    (async () => {
        try {
            const gps = await exifr.gps(originalAbs);
            if (!gps?.latitude || !gps?.longitude) return;

            let cache = {};
            try {
                const raw = await fs.readFile(GPS_CACHE_FILE, 'utf8');
                cache = JSON.parse(raw);
            } catch { /* no cache yet */ }

            cache[imgRel] = { lat: gps.latitude, lng: gps.longitude };
            await fs.writeFile(GPS_CACHE_FILE, JSON.stringify(cache, null, 2));
            console.log(`📍 GPS cached for: ${imgRel}`);
        } catch { /* no GPS or parse error */ }
    })();
}

// ── ROUTE PRECOMPUTATION ─────────────────────────────────────────────
// The website draws polylines along OSRM-routed roads/tracks for each
// trip segment.  Doing this client-side hammered OSRM (one request per
// segment per visitor) and was slow on first paint.  The backend now
// resolves routes once, persists them on disk, and serves the lot as
// one JSON blob.  Cache key includes the actual lat/lng of each
// endpoint, so moving a point naturally invalidates its entry.
const ROUTES_CACHE_FILE = path.join(UPLOAD_DIR, 'data', 'routes-cache.json');
const GPS_CACHE_FILE = path.join(UPLOAD_DIR, 'data', 'image-gps-cache.json');
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const ROUTE_MODE_TO_PROFILE = {
    car: 'driving', rv: 'driving', bus: 'driving',
    foot: 'foot', misc: 'driving',
};
const ROUTE_MAX_DETOUR_FACTOR = 5;
const ROUTE_MAX_SNAP_DISTANCE = 1000; // meters

let routesCacheMem = null;
let routesCacheLoading = null;
let routesCacheDirty = false;
let routesCacheSaveTimer = null;

async function loadRoutesCache() {
    if (routesCacheMem) return routesCacheMem;
    if (routesCacheLoading) return routesCacheLoading;
    routesCacheLoading = (async () => {
        try {
            const raw = await fs.readFile(ROUTES_CACHE_FILE, 'utf8');
            routesCacheMem = JSON.parse(raw);
        } catch {
            routesCacheMem = {};
        }
        return routesCacheMem;
    })();
    return routesCacheLoading;
}

async function saveRoutesCacheNow() {
    if (routesCacheSaveTimer) {
        clearTimeout(routesCacheSaveTimer);
        routesCacheSaveTimer = null;
    }
    if (!routesCacheDirty || !routesCacheMem) return;
    routesCacheDirty = false;
    try {
        await fs.mkdir(path.dirname(ROUTES_CACHE_FILE), { recursive: true });
        await fs.writeFile(ROUTES_CACHE_FILE, JSON.stringify(routesCacheMem));
    } catch (err) {
        console.error('Failed to save routes cache:', err.message);
    }
}

function scheduleRoutesCacheSave() {
    routesCacheDirty = true;
    if (routesCacheSaveTimer) return;
    routesCacheSaveTimer = setTimeout(() => {
        routesCacheSaveTimer = null;
        saveRoutesCacheNow().catch(() => {});
    }, 500);
}

function routeKey(p1, p2, profile) {
    return `${p1.lat},${p1.lng};${p2.lat},${p2.lng};${profile}`;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keep one point per targetDistKm, always preserving start and end.
function simplifyCoords(coords, targetDistKm = 0.5) {
    if (coords.length <= 2) return coords;
    const targetMeters = targetDistKm * 1000;
    const out = [coords[0]];
    let distAcc = 0;
    for (let i = 1; i < coords.length - 1; i++) {
        const [lat1, lng1] = coords[i - 1];
        const [lat2, lng2] = coords[i];
        distAcc += haversineMeters(lat1, lng1, lat2, lng2);
        if (distAcc >= targetMeters) {
            out.push(coords[i]);
            distAcc = 0;
        }
    }
    out.push(coords[coords.length - 1]);
    return out;
}

function greatCircleArc(p1, p2, n = 20) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;
    const lat1 = toRad(p1.lat), lng1 = toRad(p1.lng);
    const lat2 = toRad(p2.lat), lng2 = toRad(p2.lng);
    const d = 2 * Math.asin(Math.sqrt(
        Math.sin((lat1 - lat2) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng1 - lng2) / 2) ** 2
    ));
    if (d < 1e-10) return [[p1.lat, p1.lng], [p2.lat, p2.lng]];
    const out = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
        const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
        const z = A * Math.sin(lat1) + B * Math.sin(lat2);
        out.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
    }
    return out;
}

async function fetchOsrmRoute(p1, p2, profile) {
    try {
        const url = `${OSRM_BASE}/${profile}/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route');
        const wp = data.waypoints;
        if (wp?.length >= 2) {
            const [snapLng1, snapLat1] = wp[0].location;
            const [snapLng2, snapLat2] = wp[wp.length - 1].location;
            const d1 = haversineMeters(p1.lat, p1.lng, snapLat1, snapLng1);
            const d2 = haversineMeters(p2.lat, p2.lng, snapLat2, snapLng2);
            if (d1 > ROUTE_MAX_SNAP_DISTANCE || d2 > ROUTE_MAX_SNAP_DISTANCE) return null;
        }
        const routeDist = data.routes[0].distance;
        const direct = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
        if (direct > 0 && routeDist / direct > ROUTE_MAX_DETOUR_FACTOR) return null;
        const raw = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        return simplifyCoords(raw);
    } catch (err) {
        console.warn(`OSRM failed (${profile}): ${err.message}`);
        return null;
    }
}

// In-flight de-duplication so concurrent /routes requests don't double-fetch
// the same segment from OSRM.
const PENDING_ROUTES = new Map();

async function getRouteCoords(p1, p2, method) {
    if (method === 'plane') {
        const key = routeKey(p1, p2, 'plane');
        const cache = await loadRoutesCache();
        if (key in cache) return cache[key];
        const arc = simplifyCoords(greatCircleArc(p1, p2));
        cache[key] = arc;
        scheduleRoutesCacheSave();
        return arc;
    }
    const profile = ROUTE_MODE_TO_PROFILE[method];
    if (!profile) return null; // boat etc → straight line
    const key = routeKey(p1, p2, profile);
    const cache = await loadRoutesCache();
    if (key in cache) {
        const coords = cache[key];
        if (!coords) return null;
        // Migrate full-res legacy cache entries once, then store the simplified version.
        const simplified = simplifyCoords(coords);
        if (simplified.length !== coords.length) {
            cache[key] = simplified;
            scheduleRoutesCacheSave();
        }
        return simplified;
    }
    if (PENDING_ROUTES.has(key)) return PENDING_ROUTES.get(key);
    const promise = (async () => {
        const coords = await fetchOsrmRoute(p1, p2, profile);
        cache[key] = coords; // null cached too — don't retry every request
        scheduleRoutesCacheSave();
        return coords;
    })();
    PENDING_ROUTES.set(key, promise);
    try { return await promise; }
    finally { PENDING_ROUTES.delete(key); }
}

// --- AUTH MIDDLEWARE ---
const checkAuth = (req, res, next) => {
    let token = req.headers['x-auth-token'];

    if (!token) {
        console.log(`❌ AUTH FAILED: No token provided`);
        return res.status(401).json({ error: "Unauthorized" });
    }

    let decoded;
    try {
        decoded = Buffer.from(token, 'base64').toString('utf8');
    } catch (err) {
        console.log(`❌ AUTH FAILED: Invalid token encoding - ${err.message}`);
        return res.status(400).json({ error: "Invalid token encoding" });
    }

    if (decoded === WRITE_PASS) {
        req.isAdmin = true;
        return next();
    }
    if (decoded === currentReadPass) {
        req.isAdmin = false;
        if (req.method !== 'GET') {
            console.log(`❌ AUTH FAILED: Read-only user attempted ${req.method}`);
            return res.status(403).json({ error: "Write denied" });
        }
        return next();
    }

    console.log(`❌ AUTH FAILED: Invalid credentials`);
    res.status(401).json({ error: "Unauthorized" });
};


// --- ROUTES ---
// Cache policy:
//   - media (non-JSON) successful responses: long cache
//   - JSON metadata: never cache (must always be fresh)
//   - errors (404 etc.): never cache (otherwise a transient miss sticks)
// setHeaders only fires on successful static responses, so the fallthrough
// handler below stamps no-store on anything that didn't match a file.
// Thumbnail interceptor: any GET to /files/media/.thumbs/* that doesn't
// have a file on disk yet triggers on-the-fly generation from the
// matching original, then falls through to the static handler below.
// Auth is enforced inline (same as the static handler).
app.get(/^\/files\/media\/\.thumbs\/.+\.webp$/i, checkAuth, async (req, res, next) => {
    const rel = decodeURIComponent(req.path.replace(/^\/files\//, ''));
    let thumbAbs;
    try {
        thumbAbs = sanitizePath(rel);
    } catch {
        return res.status(400).json({ error: 'Invalid path' });
    }
    try {
        await fs.access(thumbAbs);
        return next(); // already exists, let static serve it
    } catch { /* missing → generate */ }

    const originalAbs = await findOriginalForThumbRel(rel);
    if (!originalAbs) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).json({ error: 'Original not found' });
    }
    const ok = await generateThumbnail(originalAbs, thumbAbs);
    if (!ok) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(500).json({ error: 'Thumbnail generation failed' });
    }
    return next();
});

// ── DATA JSON PATH REWRITING ─────────────────────────────────────────
// Legacy apps upload videos with image extensions.  The upload handler
// renames them, but the JSON data file still references the old name.
// Intercept data-JSON responses and resolve every media path to the
// actual filename on disk so the website renders <video> vs <img>
// correctly based on the extension.
app.get('/files/data/:file', checkAuth, async (req, res, next) => {
    if (!req.params.file.endsWith('.json')) return next();
    let absPath;
    try { absPath = sanitizePath('data/' + req.params.file); } catch { return next(); }
    let raw;
    try { raw = await fs.readFile(absPath, 'utf8'); } catch { return next(); }

    let data;
    try { data = JSON.parse(raw); } catch { return next(); }

    if (Array.isArray(data.points)) {
        let changed = false;
        for (const pt of data.points) {
            if (pt.titleImagePath) {
                const resolved = await resolveMediaFilename(pt.titleImagePath);
                if (resolved !== pt.titleImagePath) { pt.titleImagePath = resolved; changed = true; }
            }
            if (Array.isArray(pt.otherImagePaths)) {
                for (let i = 0; i < pt.otherImagePaths.length; i++) {
                    const resolved = await resolveMediaFilename(pt.otherImagePaths[i]);
                    if (resolved !== pt.otherImagePaths[i]) { pt.otherImagePaths[i] = resolved; changed = true; }
                }
            }
        }
        if (changed) console.log(`🔄 Rewrote media paths in ${req.params.file}`);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
});

app.use('/files', checkAuth, express.static(UPLOAD_DIR, {
    dotfiles: 'allow',
    setHeaders: (res, filePath) => {
        if (path.extname(filePath).toLowerCase() === '.json') {
            res.setHeader('Cache-Control', 'no-store');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(404).json({ error: 'Not found' });
});

// --- WEBSITE (SPA) ---
// Serve the built React site at the root with a SPA fallback so that
// deep links like /stop/sydney work on reload.  Static assets (hashed
// by Vite) get long-cache; index.html must always be fresh so users
// pick up new builds.  Mounted before the API routes below — those
// live under distinct prefixes (/files, /list, /verify, ...) so there
// is no collision.
app.use(express.static(WEB_DIR, {
    index: false, // index.html is served by the fallback below
    setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        // index.html and the service worker must always be fresh so clients
        // pick up new builds and SW logic changes immediately (the SW spec
        // otherwise lets a cached sw.js linger for up to 24h).
        if (base === 'index.html' || base === 'sw.js') {
            res.setHeader('Cache-Control', 'no-store');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    },
}));

app.get('/list', checkAuth, async (req, res) => {
    const queryPath = req.query.path || '/';
    try {
        const targetPath = sanitizePath(req.query.path);
        const items = await fs.readdir(targetPath, { withFileTypes: true });
        
        const result = { files: [], folders: [] };
        for (const item of items) {
            // Hide the auto-generated thumbnail directory from listings —
            // it's an implementation detail of the image serving layer.
            if (item.isDirectory() && item.name === THUMB_DIR) continue;

            const fullPath = path.join(targetPath, item.name);
            const stats = await fs.stat(fullPath);
            const rel = path.relative(UPLOAD_DIR, fullPath).replace(/\\/g, '/');

            const entry = { name: item.name, path: rel, created: stats.birthtime, modified: stats.mtime };
            if (item.isDirectory()) result.folders.push(entry);
            else result.files.push({ ...entry, size: stats.size, url: `/files/${rel}` });
        }
        console.log(`✅ LIST SUCCESS: "${queryPath}" - ${result.files.length} files, ${result.folders.length} folders`);
        res.json({ path: queryPath, ...result });
    } catch (err) {
        console.log(`❌ LIST FAILED: "${queryPath}" - ${err.message}`);
        res.status(500).json({ error: "List failed" });
    }
});

// Single file verification — also checks alternative extensions so
// legacy apps that uploaded e.g. video.jpg (renamed to video.mp4 by
// the server) won't re-upload endlessly.
app.post('/verify', checkAuth, async (req, res) => {
    const { path: filePath } = req.body;
    try {
        const fullPath = sanitizePath(filePath);
        try {
            const stats = await fs.stat(fullPath);
            console.log(`✅ VERIFY: "${filePath}" exists (${stats.size} bytes)`);
            res.json({ exists: true, size: stats.size, path: filePath });
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            // Check if the file was renamed to a different extension.
            const stem = fullPath.replace(/\.[^.]+$/, '');
            for (const ext of MEDIA_EXTS) {
                try {
                    const stats = await fs.stat(stem + ext);
                    console.log(`✅ VERIFY: "${filePath}" found as ${path.basename(stem + ext)} (${stats.size} bytes)`);
                    return res.json({ exists: true, size: stats.size, path: filePath });
                } catch { continue; }
            }
            console.log(`❌ VERIFY: "${filePath}" not found`);
            res.json({ exists: false, path: filePath });
        }
    } catch (err) {
        console.log(`❌ VERIFY ERROR: "${filePath}" - ${err.message}`);
        res.status(500).json({ error: "Verify failed" });
    }
});

// Batch verification
app.post('/verify-batch', checkAuth, async (req, res) => {
    const { paths } = req.body;
    
    if (!Array.isArray(paths)) {
        return res.status(400).json({ error: "paths must be an array" });
    }
    
    console.log(`📋 Batch verifying ${paths.length} files...`);
    
    const results = {};
    
    for (const filePath of paths) {
        try {
            const fullPath = sanitizePath(filePath);
            let found = false;
            try {
                const stats = await fs.stat(fullPath);
                results[filePath] = { exists: true, size: stats.size };
                found = true;
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }
            // Check alternative extensions (file may have been renamed).
            if (!found) {
                const stem = fullPath.replace(/\.[^.]+$/, '');
                for (const ext of MEDIA_EXTS) {
                    try {
                        const stats = await fs.stat(stem + ext);
                        results[filePath] = { exists: true, size: stats.size };
                        found = true;
                        break;
                    } catch { continue; }
                }
            }
            if (!found) results[filePath] = { exists: false };
        } catch (err) {
            console.log(`❌ Verify error for "${filePath}": ${err.message}`);
            results[filePath] = { exists: false, error: err.message };
        }
    }
    
    const verified = Object.values(results).filter(r => r.exists).length;
    console.log(`✅ Batch verify complete: ${verified}/${paths.length} verified`);
    
    res.json(results);
});

// GET /routes — returns the polyline for every segment in trips.json,
// preserving trips.json order.  Each entry: { from, to, method, coords }
// with coords as [lat,lng] pairs.  Falls back to a straight line when the
// routing engine couldn't snap (boat segments, OSRM error, etc.) so the
// caller can always render a line per segment.
app.get('/routes', checkAuth, async (req, res) => {
    try {
        const pointsPath = path.join(UPLOAD_DIR, 'data', 'points.json');
        const tripsPath = path.join(UPLOAD_DIR, 'data', 'trips.json');
        const [pointsRaw, tripsRaw] = await Promise.all([
            fs.readFile(pointsPath, 'utf8'),
            fs.readFile(tripsPath, 'utf8'),
        ]);
        const points = JSON.parse(pointsRaw);
        const trips = JSON.parse(tripsRaw);
        const byId = new Map(points.map(p => [p.id, {
            lat: parseFloat(p.lat) || 0,
            lng: parseFloat(p.lon) || 0,
        }]));

        const out = [];
        for (const t of trips) {
            const p1 = byId.get(t.pointId1);
            const p2 = byId.get(t.pointId2);
            if (!p1 || !p2 || !p1.lat || !p2.lat) continue;
            const coords = await getRouteCoords(p1, p2, t.method);
            const final = coords || [[p1.lat, p1.lng], [p2.lat, p2.lng]];
            out.push({ from: t.pointId1, to: t.pointId2, method: t.method, coords: final });
        }
        await saveRoutesCacheNow(); // flush before responding
        console.log(`✅ ROUTES: ${out.length} segments served`);
        res.setHeader('Cache-Control', 'no-store');
        res.json(out);
    } catch (err) {
        console.log(`❌ ROUTES FAILED: ${err.message}`);
        res.status(500).json({ error: 'Routes failed' });
    }
});

// GET /image-gps — returns [{path, lat, lng}] for every image that has
// GPS EXIF data.  Results are cached in image-gps-cache.json so repeated
// requests don't re-read every file from disk.
app.get('/image-gps', checkAuth, async (req, res) => {
    try {
        const pointsPath = path.join(UPLOAD_DIR, 'data', 'points.json');
        const raw = await fs.readFile(pointsPath, 'utf8');
        const data = JSON.parse(raw);
        const pts = Array.isArray(data) ? data : (Array.isArray(data.points) ? data.points : []);

        let cache = {};
        try {
            const cacheRaw = await fs.readFile(GPS_CACHE_FILE, 'utf8');
            cache = JSON.parse(cacheRaw);
        } catch { /* no cache yet */ }

        const results = [];
        let dirty = false;

        for (const pt of pts) {
            const paths = [
                ...(pt.titleImagePath ? [pt.titleImagePath] : []),
                ...(Array.isArray(pt.otherImagePaths) ? pt.otherImagePaths : [])
            ];
            for (const p of paths) {
                const ext = path.extname(p).toLowerCase();
                if (!IMAGE_EXTS.has(ext)) continue;

                const resolved = await resolveMediaFilename(p);

                if (cache[resolved]) {
                    results.push({ path: resolved, lat: cache[resolved].lat, lng: cache[resolved].lng });
                    continue;
                }

                if (!exifr) continue;

                try {
                    const absPath = path.join(UPLOAD_DIR, 'media', resolved);
                    const gps = await exifr.gps(absPath);
                    if (gps?.latitude && gps?.longitude) {
                        cache[resolved] = { lat: gps.latitude, lng: gps.longitude };
                        dirty = true;
                        results.push({ path: resolved, lat: gps.latitude, lng: gps.longitude });
                    }
                } catch { /* no GPS or unreadable */ }
            }
        }

        if (dirty) {
            await fs.writeFile(GPS_CACHE_FILE, JSON.stringify(cache, null, 2)).catch(() => {});
        }

        console.log(`✅ IMAGE-GPS: ${results.length} markers served`);
        res.setHeader('Cache-Control', 'no-store');
        res.json(results);
    } catch (err) {
        console.error('❌ IMAGE-GPS FAILED:', err.message);
        res.status(500).json({ error: 'GPS extraction failed' });
    }
});

app.post('/upload', checkAuth, (req, res) => {
    if (!req.isAdmin) return res.status(403).json({ error: "Admin only" });

    const bb = busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
    let uploadPath = null;
    let writeStream = null;
    let totalBytes = 0;
    let responseSent = false;

    // 1. Capture the path from the form fields
    bb.on('field', (name, val) => {
        if (name === 'path') {
            try {
                // Use sanitizePath to handle subdirectories like 'media/sydney/file.jpg'
                uploadPath = sanitizePath(val);
            } catch (err) {
                console.error(`❌ Invalid path provided: ${val}`);
            }
        }
    });

    bb.on('file', async (fieldname, file, info) => {
        if (!uploadPath) {
            uploadPath = sanitizePath(info.filename);
        }

        console.log(`📥 Receiving: ${uploadPath.replace(UPLOAD_DIR, '')}`);

        file.pause();
        try {
            await fs.mkdir(path.dirname(uploadPath), { recursive: true });
        } catch (err) {
            console.error(`❌ mkdir failed: ${err.message}`);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.status(500).json({ error: 'Upload failed' });
            }
            return;
        }

        // Write to a temp file first so a dropped connection never leaves a
        // partial file at the final path.  Only rename to uploadPath on success.
        const tempPath = uploadPath + '.tmp';
        writeStream = createWriteStream(tempPath);

        file.on('data', (chunk) => {
            totalBytes += chunk.length;
        });

        file.pipe(writeStream);
        file.resume();

        writeStream.on('finish', async () => {
            // Atomically promote the temp file to the final path.
            try {
                await fs.rename(tempPath, uploadPath);
            } catch (renameErr) {
                console.error(`❌ Rename failed: ${renameErr.message}`);
                fs.rm(tempPath, { force: true }).catch(() => {});
                if (!responseSent && !res.headersSent) {
                    responseSent = true;
                    res.status(500).json({ error: 'Upload finalization failed' });
                }
                return;
            }
            console.log(`✅ Upload complete: ${uploadPath.replace(UPLOAD_DIR, '')} (${totalBytes} bytes)`);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.json({ message: 'Uploaded', size: totalBytes });
            }
            // Fix mismatched extensions (legacy apps upload videos as .jpg).
            const corrected = await fixExtensionIfNeeded(uploadPath).catch(() => uploadPath);
            // Async thumbnail generation — don't block the response.
            maybeGenerateThumbForUpload(corrected);
            // Async GPS cache update — extract and persist GPS for the new image.
            maybeAddGpsToCache(corrected);
        });

        writeStream.on('error', (err) => {
            console.error(`❌ Write error: ${err.message}`);
            fs.rm(tempPath, { force: true }).catch(() => {});
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.status(500).json({ error: 'Write failed' });
            }
        });
    });

    bb.on('error', (err) => {
        console.error(`❌ Busboy error: ${err.message}`);
        if (!responseSent && !res.headersSent) {
            responseSent = true;
            res.status(500).json({ error: 'Upload failed' });
        }
    });

    req.on('close', () => {
        if (!responseSent) {
            console.log(`⚠️ Client disconnected during upload`);
            // Clean up the partial temp file so the final path is never corrupted.
            if (uploadPath) fs.rm(uploadPath + '.tmp', { force: true }).catch(() => {});
        }
    });

    req.pipe(bb);
});



app.post('/write', checkAuth, async (req, res) => {
    if (!req.isAdmin) {
        console.log(`❌ WRITE FAILED: Admin access required`);
        return res.status(403).json({ error: "Admin only" });
    }
    const { path: filePath, content } = req.body;
    try {
        const fullPath = sanitizePath(filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        
        let data = content;
        if (typeof content === 'string' && content.startsWith('data:')) {
            data = Buffer.from(content.split(',')[1], 'base64');
        } else if (typeof content === 'object') {
            data = JSON.stringify(content, null, 2);
        }
        
        // Read previous content BEFORE overwriting (for new-point detection)
        let prevPoints = [];
        if (filePath.endsWith('points.json')) {
            try {
                const prevData = await fs.readFile(fullPath, 'utf8');
                const parsed = JSON.parse(prevData);
                if (Array.isArray(parsed)) prevPoints = parsed;
            } catch { /* file didn't exist before */ }
        }

        await fs.writeFile(fullPath, data);
        const size = Buffer.byteLength(data);
        console.log(`✅ WRITE SUCCESS: "${filePath}" (${size} bytes)`);
        res.json({ message: "Written", path: filePath });

        // Auto-notify subscribers only when a new point is added to points.json
        if (filePath.endsWith('points.json')) {
            try {
                const points = typeof content === 'string' ? JSON.parse(content) : content;
                if (Array.isArray(points) && points.length > prevPoints.length) {
                    const prevIds = new Set(prevPoints.map(p => p.id));
                    const newPoints = points.filter(p => !prevIds.has(p.id));
                    const latest = newPoints.reduce((a, b) =>
                        ((b.tripOrder ?? -1) > (a.tripOrder ?? -1) ? b : a), newPoints[0]);
                    sendPushToAll({
                        title: 'Jenny hat was Neues gepostet! 🇦🇺',
                        body: latest?.name || 'Schau dir an, wo es als nächstes hingeht!'
                    }).catch(err => console.error('Push notify error:', err.message));
                }
            } catch (err) {
                console.error('Push notify check failed:', err.message);
            }
        }
    } catch (err) {
        console.log(`❌ WRITE FAILED: "${filePath}" - ${err.message}`);
        res.status(500).json({ error: "Write failed" });
    }
});

app.delete('/delete', checkAuth, async (req, res) => {
    if (!req.isAdmin) {
        console.log(`❌ DELETE FAILED: Admin access required`);
        return res.status(403).json({ error: "Admin only" });
    }
    const { path: filePath } = req.body;
    try {
        const fullPath = sanitizePath(filePath);
        await fs.rm(fullPath, { recursive: true, force: true });
        console.log(`✅ DELETE SUCCESS: "${filePath}"`);
        res.json({ message: "Deleted", path: filePath });

        // Best-effort: also drop the matching thumbnail if any.
        const thumbRel = thumbRelPathFor(filePath);
        if (thumbRel) {
            const thumbAbs = path.join(UPLOAD_DIR, thumbRel);
            fs.rm(thumbAbs, { force: true }).catch(() => {});
        }
    } catch (err) {
        console.log(`❌ DELETE FAILED: "${filePath}" - ${err.message}`);
        res.status(500).json({ error: "Delete failed" });
    }
});

// --- PUSH SUBSCRIBE (allow read-only users) ---
app.post('/push/subscribe', (req, res, next) => {
    let token = req.headers['x-auth-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let decoded;
    try { decoded = Buffer.from(token, 'base64').toString('utf8'); } catch { return res.status(400).json({ error: 'Invalid token' }); }
    if (decoded !== READ_PASS && decoded !== WRITE_PASS) return res.status(401).json({ error: 'Unauthorized' });
    next();
}, async (req, res) => {
    const subscription = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

    try {
        const subs = await loadSubscriptions();
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            subs.push(subscription);
            await saveSubscriptions(subs);
            console.log(`✅ Push subscription added (total: ${subs.length})`);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('❌ Subscribe failed:', err.message);
        res.status(500).json({ error: 'Subscribe failed' });
    }
});

// --- ADMIN PANEL (separate password, separate header) ---
const checkAdminPanel = (req, res, next) => {
    if (!ADMIN_PANEL_PASS) return res.status(503).json({ error: 'Admin panel not configured' });
    const token = req.headers['x-admin-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let decoded;
    try { decoded = Buffer.from(token, 'base64').toString('utf8'); } catch {
        return res.status(400).json({ error: 'Invalid token' });
    }
    if (decoded !== ADMIN_PANEL_PASS) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

app.get('/admin/files', checkAdminPanel, async (req, res) => {
    try {
        const dataDir = path.join(UPLOAD_DIR, 'data');
        await fs.mkdir(dataDir, { recursive: true });
        const items = await fs.readdir(dataDir, { withFileTypes: true });
        const files = [];
        for (const item of items) {
            if (!item.isFile()) continue;
            const abs = path.join(dataDir, item.name);
            const stats = await fs.stat(abs);
            files.push({ name: item.name, size: stats.size, modified: stats.mtime });
        }
        res.setHeader('Cache-Control', 'no-store');
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list files' });
    }
});

app.get('/admin/download-media', checkAdminPanel, (req, res) => {
    const filename = `media-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');

    const zip = spawn('zip', ['-r', '-', 'media',
        '-x', 'media/.thumbs/*',
        '-x', 'media/.thumbs/*/*',
        '-x', 'media/.thumbs/*/*/*',
    ], { cwd: UPLOAD_DIR });
    zip.stdout.pipe(res);
    zip.stderr.on('data', d => console.error('zip stderr:', d.toString()));
    zip.on('error', err => {
        console.error('zip failed:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'zip not available on this server' });
        else res.destroy();
    });
    zip.on('close', code => {
        if (code !== 0) console.error(`zip exited with code ${code}`);
        else console.log(`✅ Media zip download complete`);
    });
    req.on('close', () => zip.kill());
});

app.get('/admin/download', checkAdminPanel, async (req, res) => {
    const fileName = req.query.file;
    if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    try {
        const abs = path.join(UPLOAD_DIR, 'data', fileName);
        if (!abs.startsWith(path.join(UPLOAD_DIR, 'data'))) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        await fs.access(abs);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        const data = await fs.readFile(abs);
        res.send(data);
    } catch {
        res.status(404).json({ error: 'File not found' });
    }
});

// Public: site config (title parts + tab title)
app.get('/site-config', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ titleMain: currentTitleMain, titleAccent: currentTitleAccent, tabTitle: currentTabTitle, accentColor: currentAccentColor, siteIcon: currentSiteIcon });
});

// Admin: read settings
app.get('/admin/settings', checkAdminPanel, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ titleMain: currentTitleMain, titleAccent: currentTitleAccent, tabTitle: currentTabTitle, accentColor: currentAccentColor, siteIcon: currentSiteIcon, readPass: currentReadPass });
});

// Admin: save settings
app.post('/admin/settings', checkAdminPanel, async (req, res) => {
    const { titleMain, titleAccent, tabTitle, readPass, accentColor, siteIcon } = req.body;
    try {
        const settings = {
            titleMain:   (typeof titleMain === 'string' && titleMain.trim()) ? titleMain.trim() : currentTitleMain,
            titleAccent: typeof titleAccent === 'string' ? titleAccent.trim() : currentTitleAccent,
            tabTitle:    (typeof tabTitle === 'string' && tabTitle.trim()) ? tabTitle.trim() : currentTabTitle,
            readPass:    (typeof readPass === 'string' && readPass.trim()) ? readPass.trim() : currentReadPass,
            accentColor: (typeof accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(accentColor)) ? accentColor : currentAccentColor,
            siteIcon:    (typeof siteIcon === 'string' && siteIcon.trim()) ? siteIcon.trim().slice(0, 8) : currentSiteIcon,
        };
        await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
        currentTitleMain   = settings.titleMain;
        currentTitleAccent = settings.titleAccent;
        currentTabTitle    = settings.tabTitle;
        currentReadPass    = settings.readPass;
        currentAccentColor = settings.accentColor;
        currentSiteIcon    = settings.siteIcon;
        console.log('✅ Settings updated');
        res.json({ ok: true, settings });
    } catch {
        res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }
});

// ── Route styles ──────────────────────────────────────────────────────────
app.get('/route-styles', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(currentRouteStyles);
});

app.get('/admin/route-styles', checkAdminPanel, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(currentRouteStyles);
});

app.post('/admin/route-styles', checkAdminPanel, async (req, res) => {
    const VALID_MODES = ['car', 'rv', 'bus', 'foot', 'boat', 'plane', 'misc'];
    const body = req.body || {};
    const styles = {};
    for (const mode of VALID_MODES) {
        const m = body[mode];
        if (!m) continue;
        const entry = {};
        if (typeof m.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.color)) entry.color = m.color;
        if (typeof m.weight === 'number' && m.weight >= 1 && m.weight <= 8) entry.weight = m.weight;
        if (typeof m.dashArray === 'string') entry.dashArray = m.dashArray;
        if (Object.keys(entry).length) styles[mode] = entry;
    }
    try {
        await fs.mkdir(path.dirname(ROUTE_STYLES_FILE), { recursive: true });
        await fs.writeFile(ROUTE_STYLES_FILE, JSON.stringify(styles, null, 2));
        currentRouteStyles = styles;
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Speichern fehlgeschlagen' });
    }
});

// SPA fallback: any GET that didn't match a static file or API route
// returns index.html so the client-side router can take over deep links
// like /stop/sydney on reload.  Registered last so API routes win.
app.get(/.*/, async (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
        const indexPath = path.join(WEB_DIR, 'index.html');
        const html = await fs.readFile(indexPath);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.log(`❌ SPA fallback failed: ${err.message}`);
        res.status(500).json({ error: 'Website not built' });
    }
});

const server = app.listen(PORT, () => console.log(`Server on ${PORT}`));
server.setTimeout(600000); // 10 minutes