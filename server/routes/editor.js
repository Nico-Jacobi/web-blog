'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');
const busboy = require('busboy');
const { z } = require('zod');

const { authJwt } = require('../middleware/authJwt');
const { getDb } = require('../db');
const {
  withFileLock,
  mergePoints,
  mergeTrips,
  readJsonArrayOrEmpty,
} = require('../services/sync');
const {
  MEDIA_EXTS,
  fixExtensionIfNeeded,
} = require('../services/media');
const {
  THUMB_DIR,
  thumbRelPathFor,
  maybeGenerateThumbForUpload,
} = require('../services/thumbnails');
const { sendPushToBlogReaders } = require('../services/push');
const { parseSettingsJson, withDefaults } = require('../schemas/blogSettings');

const router = express.Router();

router.use(authJwt);

const writeSchema = z.object({
  path: z.string().min(1).max(512),
  content: z.union([z.string(), z.array(z.any()), z.record(z.any())]),
}).strict();

const deleteSchema = z.object({
  path: z.string().min(1).max(512),
}).strict();

const verifyBatchSchema = z.object({
  paths: z.array(z.string().min(1).max(512)).max(2000),
}).strict();

const verifySchema = z.object({
  path: z.string().min(1).max(512),
}).strict();

router.post('/write', express.json({ limit: '50mb' }), async (req, res) => {
  const parsed = writeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
  }
  const { path: filePath, content } = parsed.data;

  let fullPath;
  try { fullPath = req.blogPath(filePath); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const isPoints = filePath.endsWith('points.json');
    const isTrips = filePath.endsWith('trips.json');

    if (isPoints || isTrips) {
      const clientArr = typeof content === 'string' ? JSON.parse(content) : content;
      if (!Array.isArray(clientArr)) {
        return res.status(400).json({ error: 'Expected array for points/trips' });
      }

      const { merged, prevArr } = await withFileLock(fullPath, async () => {
        const serverArr = await readJsonArrayOrEmpty(fullPath);
        const out = isPoints ? mergePoints(serverArr, clientArr) : mergeTrips(serverArr, clientArr);
        await fs.writeFile(fullPath, JSON.stringify(out, null, 2));
        return { merged: out, prevArr: serverArr };
      });

      res.json({ message: 'Merged', path: filePath, content: merged });

      if (isPoints) {
        triggerPushIfNewPoints(req.blog.id, prevArr, merged).catch(err =>
          console.error('Push notify error:', err.message)
        );
      }
      return;
    }

    let data = content;
    if (typeof content === 'string' && content.startsWith('data:')) {
      data = Buffer.from(content.split(',')[1], 'base64');
    } else if (typeof content === 'object') {
      data = JSON.stringify(content, null, 2);
    }

    await fs.writeFile(fullPath, data);
    res.json({ message: 'Written', path: filePath });
  } catch (err) {
    console.error(`WRITE FAILED: ${filePath} - ${err.message}`);
    res.status(500).json({ error: 'Write failed' });
  }
});

router.delete('/delete', express.json(), async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  let fullPath;
  try { fullPath = req.blogPath(parsed.data.path); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    res.json({ message: 'Deleted', path: parsed.data.path });

    const thumbRel = thumbRelPathFor(parsed.data.path);
    if (thumbRel) {
      try {
        const thumbAbs = req.blogPath(thumbRel);
        fs.rm(thumbAbs, { force: true }).catch(() => {});
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.error(`DELETE FAILED: ${parsed.data.path} - ${err.message}`);
    res.status(500).json({ error: 'Delete failed' });
  }
});

router.get('/list', async (req, res) => {
  const queryPath = req.query.path || '/';
  let targetPath;
  try { targetPath = req.blogPath(String(queryPath)); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  try {
    let items;
    try {
      items = await fs.readdir(targetPath, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return res.json({ path: queryPath, files: [], folders: [] });
      throw err;
    }

    const result = { files: [], folders: [] };
    for (const item of items) {
      if (item.isDirectory() && item.name === THUMB_DIR) continue;

      const fullPath = path.join(targetPath, item.name);
      const stats = await fs.stat(fullPath);
      const rel = path.relative(req.tenantDir, fullPath).replace(/\\/g, '/');

      const entry = {
        name: item.name,
        path: rel,
        created: stats.birthtime,
        modified: stats.mtime,
      };
      if (item.isDirectory()) result.folders.push(entry);
      else result.files.push({ ...entry, size: stats.size });
    }
    res.json({ path: queryPath, ...result });
  } catch (err) {
    console.error(`LIST FAILED: ${queryPath} - ${err.message}`);
    res.status(500).json({ error: 'List failed' });
  }
});

async function statWithAltExtensions(absPath) {
  try {
    return await fs.stat(absPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const stem = absPath.replace(/\.[^.]+$/, '');
  for (const ext of MEDIA_EXTS) {
    try {
      return await fs.stat(stem + ext);
    } catch { continue; }
  }
  return null;
}

router.post('/verify', express.json(), async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  let fullPath;
  try { fullPath = req.blogPath(parsed.data.path); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  try {
    const stats = await statWithAltExtensions(fullPath);
    if (stats) return res.json({ exists: true, size: stats.size, path: parsed.data.path });
    res.json({ exists: false, path: parsed.data.path });
  } catch (err) {
    console.error(`VERIFY ERROR: ${parsed.data.path} - ${err.message}`);
    res.status(500).json({ error: 'Verify failed' });
  }
});

router.post('/verify-batch', express.json({ limit: '5mb' }), async (req, res) => {
  const parsed = verifyBatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const results = {};
  for (const filePath of parsed.data.paths) {
    let fullPath;
    try { fullPath = req.blogPath(filePath); }
    catch { results[filePath] = { exists: false, error: 'Invalid path' }; continue; }
    try {
      const stats = await statWithAltExtensions(fullPath);
      results[filePath] = stats ? { exists: true, size: stats.size } : { exists: false };
    } catch (err) {
      results[filePath] = { exists: false, error: err.message };
    }
  }
  res.json(results);
});

router.post('/upload', (req, res) => {
  const tenantDir = req.tenantDir;

  const bb = busboy({ headers: req.headers, limits: { fileSize: 50 * 1024 * 1024 } });
  let uploadPath = null;
  let writeStream = null;
  let totalBytes = 0;
  let responseSent = false;

  function safeRel(rel) {
    try { return req.blogPath(rel); }
    catch { return null; }
  }

  bb.on('field', (name, val) => {
    if (name === 'path') {
      uploadPath = safeRel(val);
      if (!uploadPath) {
        if (!responseSent && !res.headersSent) {
          responseSent = true;
          res.status(400).json({ error: 'Invalid path' });
        }
      }
    }
  });

  bb.on('file', async (_field, file, info) => {
    if (!uploadPath) {
      uploadPath = safeRel(info.filename);
      if (!uploadPath) {
        file.resume();
        if (!responseSent && !res.headersSent) {
          responseSent = true;
          res.status(400).json({ error: 'Invalid path' });
        }
        return;
      }
    }

    file.pause();
    try {
      await fs.mkdir(path.dirname(uploadPath), { recursive: true });
    } catch (err) {
      console.error(`mkdir failed: ${err.message}`);
      file.resume();
      if (!responseSent && !res.headersSent) {
        responseSent = true;
        res.status(500).json({ error: 'Upload failed' });
      }
      return;
    }

    const tempPath = uploadPath + '.tmp';
    writeStream = createWriteStream(tempPath);

    file.on('data', (chunk) => { totalBytes += chunk.length; });
    file.pipe(writeStream);
    file.resume();

    writeStream.on('finish', async () => {
      try {
        await fs.rename(tempPath, uploadPath);
      } catch (err) {
        console.error(`Rename failed: ${err.message}`);
        fs.rm(tempPath, { force: true }).catch(() => {});
        if (!responseSent && !res.headersSent) {
          responseSent = true;
          res.status(500).json({ error: 'Upload finalization failed' });
        }
        return;
      }
      if (!responseSent && !res.headersSent) {
        responseSent = true;
        res.json({ message: 'Uploaded', size: totalBytes });
      }
      const corrected = await fixExtensionIfNeeded(uploadPath).catch(() => uploadPath);
      maybeGenerateThumbForUpload(tenantDir, corrected);
    });

    writeStream.on('error', (err) => {
      console.error(`Write error: ${err.message}`);
      fs.rm(tempPath, { force: true }).catch(() => {});
      if (!responseSent && !res.headersSent) {
        responseSent = true;
        res.status(500).json({ error: 'Write failed' });
      }
    });
  });

  bb.on('error', (err) => {
    console.error(`Busboy error: ${err.message}`);
    if (!responseSent && !res.headersSent) {
      responseSent = true;
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  req.on('close', () => {
    if (!responseSent && uploadPath) {
      fs.rm(uploadPath + '.tmp', { force: true }).catch(() => {});
    }
  });

  req.pipe(bb);
});

router.get('/files/*', async (req, res) => {
  const rel = req.params[0];
  let absPath;
  try { absPath = req.blogPath(rel); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  try {
    const data = await fs.readFile(absPath);
    res.setHeader('Cache-Control', 'no-store, private');
    res.send(data);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
    throw err;
  }
});

async function triggerPushIfNewPoints(blogId, prevArr, mergedArr) {
  const realPrev = prevArr.filter(p => p.isWaypoint !== true && !p.deletedAt);
  const realNow = mergedArr.filter(p => p.isWaypoint !== true && !p.deletedAt);
  if (realNow.length <= realPrev.length) return;

  const prevIds = new Set(realPrev.map(p => p.id));
  const newPoints = realNow.filter(p => !prevIds.has(p.id));
  if (newPoints.length === 0) return;
  const latest = newPoints.reduce((a, b) =>
    ((b.tripOrder ?? -1) > (a.tripOrder ?? -1) ? b : a), newPoints[0]);

  const db = getDb();
  const blogRow = db.prepare('SELECT slug, settings_json FROM blogs WHERE id = ?').get(blogId);
  if (!blogRow) return;
  const settings = withDefaults(parseSettingsJson(blogRow.settings_json));
  const owner = settings.ownerDisplayName || settings.title;
  const tmpl = settings?.push?.notificationText || '{owner} hat etwas Neues gepostet!';
  const title = tmpl.replace(/\{owner\}/g, owner);

  await sendPushToBlogReaders(blogId, {
    title,
    body: latest?.name || 'Schau dir an, wo es als nächstes hingeht!',
    slug: blogRow.slug,
  });
}

module.exports = router;
