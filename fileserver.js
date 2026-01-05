require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises;
const { existsSync } = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();

// --- CONFIGURATION (Use Environment Variables) ---
const PORT = process.env.PORT || 3000;
const READ_PASS = process.env.READ_PASS;
const WRITE_PASS = process.env.WRITE_PASS;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');

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
    max: 100,
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
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        token = Buffer.from(token, 'base64').toString('utf8');
    } catch (err) {
        console.log(`❌ AUTH FAILED: Invalid token encoding - ${err.message}`);
        return res.status(400).json({ error: "Invalid token encoding" });
    }

    if (token === WRITE_PASS) {
        req.isAdmin = true;
        console.log(`✅ AUTH SUCCESS: Admin access granted`);
        return next();
    }
    if (token === READ_PASS) {
        req.isAdmin = false;
        if (req.method !== 'GET') {
            console.log(`❌ AUTH FAILED: Read-only user attempted ${req.method}`);
            return res.status(403).json({ error: "Write denied" });
        }
        console.log(`✅ AUTH SUCCESS: Read-only access granted`);
        return next();
    }
    console.log(`❌ AUTH FAILED: Invalid credentials`);
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

app.post('/upload', checkAuth, (req, res) => {
    if (!req.isAdmin) {
        console.log(`❌ UPLOAD FAILED: Admin access required`);
        return res.status(403).json({ error: "Admin only" });
    }
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.log(`❌ UPLOAD FAILED: ${err.message}`);
            return res.status(400).json({ error: err.message });
        }
        const relativePath = path.relative(UPLOAD_DIR, req.file.path);
        console.log(`✅ UPLOAD SUCCESS: "${relativePath}" (${req.file.size} bytes)`);
        res.json({ message: "Uploaded", path: relativePath });
    });
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

app.listen(PORT, () => console.log(`Server on ${PORT}`));
