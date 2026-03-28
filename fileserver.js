require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const rateLimit = require('express-rate-limit');
const busboy = require('busboy');
const fsSync = require('fs');
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
const SUBSCRIPTIONS_FILE = path.resolve('./push-subscriptions.json');

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
app.use(helmet());
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

// Ensure storage exists
(async () => {
    if (!existsSync(UPLOAD_DIR)) await fs.mkdir(UPLOAD_DIR, { recursive: true });
})();

// --- HELPERS ---
const sanitizePath = (userPath = '') => {
    const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(UPLOAD_DIR, normalized);
    if (!fullPath.startsWith(UPLOAD_DIR)) throw new Error('Invalid path');
    return fullPath;
};

// --- AUTH MIDDLEWARE ---
const checkAuth = (req, res, next) => {
    let token = req.headers['x-auth-token'];

    if (!token) {
        console.log(`❌ AUTH FAILED: No token provided`);
        console.log(`   Expected READ_PASS: ${READ_PASS}`);
        console.log(`   Expected WRITE_PASS: ${WRITE_PASS}`);
        return res.status(401).json({ error: "Unauthorized" });
    }

    let decoded;
    try {
        decoded = Buffer.from(token, 'base64').toString('utf8');
    } catch (err) {
        console.log(`❌ AUTH FAILED: Invalid token encoding - ${err.message}`);
        console.log(`   Provided token: ${token}`);
        console.log(`   Expected READ_PASS: ${READ_PASS}`);
        console.log(`   Expected WRITE_PASS: ${WRITE_PASS}`);
        return res.status(400).json({ error: "Invalid token encoding" });
    }

    if (decoded === WRITE_PASS) {
        req.isAdmin = true;
        console.log(`✅ AUTH SUCCESS: Admin access granted`);
        return next();
    }
    if (decoded === READ_PASS) {
        req.isAdmin = false;
        if (req.method !== 'GET') {
            console.log(`❌ AUTH FAILED: Read-only user attempted ${req.method}`);
            return res.status(403).json({ error: "Write denied" });
        }
        console.log(`✅ AUTH SUCCESS: Read-only access granted`);
        return next();
    }

    console.log(`❌ AUTH FAILED: Invalid credentials`);
    console.log(`   Provided token: ${decoded}`);
    console.log(`   Expected READ_PASS: ${READ_PASS}`);
    console.log(`   Expected WRITE_PASS: ${WRITE_PASS}`);
    res.status(401).json({ error: "Unauthorized" });
};


// --- MULTER STORAGE ---
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const folder = path.dirname(req.body.path || '');
            const uploadPath = sanitizePath(folder === '.' ? '' : folder);
            if (!existsSync(uploadPath)) await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (err) { cb(err); }
    },
    filename: (req, file, cb) => {
        const filename = path.basename(req.body.path || file.originalname);
        cb(null, filename);
    }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- ROUTES ---
app.use('/files', checkAuth, express.static(UPLOAD_DIR));

app.get('/list', checkAuth, async (req, res) => {
    const queryPath = req.query.path || '/';
    try {
        const targetPath = sanitizePath(req.query.path);
        const items = await fs.readdir(targetPath, { withFileTypes: true });
        
        const result = { files: [], folders: [] };
        for (const item of items) {
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
        
        if (existsSync(fullPath)) {
            const stats = await fs.stat(fullPath);
            console.log(`✅ VERIFY: "${filePath}" exists (${stats.size} bytes)`);
            res.json({ 
                exists: true, 
                size: stats.size,
                path: filePath 
            });
        } else {
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
            
            if (existsSync(fullPath)) {
                const stats = await fs.stat(fullPath);
                results[filePath] = { 
                    exists: true, 
                    size: stats.size 
                };
            } else {
                results[filePath] = { exists: false };
            }
        } catch (err) {
            console.log(`❌ Verify error for "${filePath}": ${err.message}`);
            results[filePath] = { exists: false, error: err.message };
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

    bb.on('file', (fieldname, file, info) => {
        // 2. Fallback to filename if no path field was provided yet
        if (!uploadPath) {
            uploadPath = sanitizePath(info.filename);
        }
        
        console.log(`📥 Receiving: ${uploadPath.replace(UPLOAD_DIR, '')}`);
        
        // 3. Ensure subdirectories exist (e.g., 'storage/images/')
        const dir = path.dirname(uploadPath);
        if (!existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }
        
        writeStream = fsSync.createWriteStream(uploadPath);
        
        file.on('data', (chunk) => {
            totalBytes += chunk.length;
        });
        
        file.pipe(writeStream);

        writeStream.on('finish', () => {
            console.log(`✅ Upload complete: ${uploadPath.replace(UPLOAD_DIR, '')} (${totalBytes} bytes)`);
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                res.json({ message: 'Uploaded', size: totalBytes });
            }
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
        
        await fs.writeFile(fullPath, data);
        const size = Buffer.byteLength(data);
        console.log(`✅ WRITE SUCCESS: "${filePath}" (${size} bytes)`);
        res.json({ message: "Written", path: filePath });

        // Auto-notify subscribers when points data is updated
        if (filePath.endsWith('points.json')) {
            try {
                const points = typeof content === 'string' ? JSON.parse(content) : content;
                const latest = Array.isArray(points) && points.length > 0
                    ? points.reduce((a, b) => (b.tripOrder > a.tripOrder ? b : a))
                    : null;
                sendPushToAll({
                    title: 'Jenny hat was Neues gepostet! 🇦🇺',
                    body: latest?.name || 'Schau dir an, wo es als nächstes hingeht!'
                }).catch(err => console.error('Push notify error:', err.message));
            } catch {
                sendPushToAll({
                    title: 'Jenny hat was Neues gepostet! 🇦🇺',
                    body: 'Schau dir an, wo es als nächstes hingeht!'
                }).catch(err => console.error('Push notify error:', err.message));
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

const server = app.listen(PORT, () => console.log(`Server on ${PORT}`));
server.setTimeout(600000); // 10 minutes