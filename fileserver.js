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
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');
const WEB_DIR = path.resolve(process.env.WEB_DIR || './react-site');
const SUBSCRIPTIONS_FILE = path.resolve('./push-subscriptions.json');

// --- THUMBNAIL CONFIG ---
// Thumbnails live next to originals in a hidden ".thumbs" directory:
//   storage/images/foo/bar.jpg  →  storage/images/.thumbs/foo/bar.webp
// Generated on upload, on-demand on first request, or via the backfill
// script (scripts/backfill-thumbs.js).  Legacy clients ignore them.
const THUMB_DIR = '.thumbs';
const THUMB_WIDTH = 480;       // px, longer edge ish
const THUMB_QUALITY = 75;      // webp quality
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
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
app.use(cors());
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
    max: 1000,
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

// ── THUMBNAIL HELPERS ─────────────────────────────────────────────────
// Map an original image rel path to its thumbnail rel path:
//   images/foo/bar.jpg → images/.thumbs/foo/bar.webp
function thumbRelPathFor(originalRel) {
    const m = originalRel.match(/^images[\\/](.+)$/i);
    if (!m) return null;
    const rest = m[1].replace(/\\/g, '/');
    const dir = path.posix.dirname(rest);
    const stem = path.posix.basename(rest, path.posix.extname(rest));
    const sub = dir === '.' ? '' : dir + '/';
    return `images/${THUMB_DIR}/${sub}${stem}.webp`;
}

// Reverse: from thumb rel path, find the original on disk by trying
// likely extensions.  Returns absolute path or null.
async function findOriginalForThumbRel(thumbRel) {
    const m = thumbRel.match(/^images[\\/]\.thumbs[\\/](.+)\.webp$/i);
    if (!m) return null;
    const stem = m[1].replace(/\\/g, '/'); // foo/bar
    const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP', 'heic', 'HEIC', 'heif', 'HEIF'];
    for (const ext of exts) {
        const candidate = path.join(UPLOAD_DIR, 'images', `${stem}.${ext}`);
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
    if (decoded === READ_PASS) {
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
// Thumbnail interceptor: any GET to /files/images/.thumbs/* that doesn't
// have a file on disk yet triggers on-the-fly generation from the
// matching original, then falls through to the static handler below.
// Auth is enforced inline (same as the static handler).
app.get(/^\/files\/images\/\.thumbs\/.+\.webp$/i, checkAuth, async (req, res, next) => {
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

app.use('/files', checkAuth, express.static(UPLOAD_DIR, {
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
        if (path.basename(filePath) === 'index.html') {
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

// Single file verification
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
            const stats = await fs.stat(fullPath);
            results[filePath] = { exists: true, size: stats.size };
        } catch (err) {
            if (err.code === 'ENOENT') {
                results[filePath] = { exists: false };
            } else {
                console.log(`❌ Verify error for "${filePath}": ${err.message}`);
                results[filePath] = { exists: false, error: err.message };
            }
        }
    }
    
    const verified = Object.values(results).filter(r => r.exists).length;
    console.log(`✅ Batch verify complete: ${verified}/${paths.length} verified`);
    
    res.json(results);
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
                // Use sanitizePath to handle subdirectories like 'images/file.jpg'
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

        writeStream = createWriteStream(uploadPath);
        
        file.on('data', (chunk) => {
            totalBytes += chunk.length;
        });
        
        file.pipe(writeStream);
        file.resume();

        writeStream.on('finish', () => {
            console.log(`✅ Upload complete: ${uploadPath.replace(UPLOAD_DIR, '')} (${totalBytes} bytes)`);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.json({ message: 'Uploaded', size: totalBytes });
            }
            // Async thumbnail generation — don't block the response.
            maybeGenerateThumbForUpload(uploadPath);
        });

        writeStream.on('error', (err) => {
            console.error(`❌ Write error: ${err.message}`);
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
        if (!responseSent) console.log(`⚠️ Client disconnected during upload`);
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