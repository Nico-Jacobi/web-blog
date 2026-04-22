'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const { resolveBlog, verifyReadPassword } = require('../middleware/authRead');
const { resolveMediaFilename } = require('../services/media');
const {
  THUMB_DIR,
  generateThumbnail,
  findOriginalForThumbRel,
} = require('../services/thumbnails');
const { buildRoutesForBlog } = require('../services/routing');

const router = express.Router({ mergeParams: true });

router.use(resolveBlog);

router.get('/meta', (req, res) => {
  const b = req.targetBlog;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    slug: b.slug,
    title: b.settings.title,
    settings: b.settings,
    requiresPassword: b.hasReadPassword,
  });
});

router.get('/files/data/:file', verifyReadPassword, async (req, res) => {
  const file = req.params.file;
  if (!file.endsWith('.json')) return res.status(404).json({ error: 'Not found' });

  let absPath;
  try { absPath = req.blogPath(`data/${file}`); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  let raw;
  try {
    raw = await fs.readFile(absPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Not found' });
    }
    throw err;
  }

  let data;
  try { data = JSON.parse(raw); }
  catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    return res.send(raw);
  }

  if (Array.isArray(data?.points)) {
    for (const pt of data.points) {
      if (pt.titleImagePath) {
        pt.titleImagePath = await resolveMediaFilename(req.tenantDir, pt.titleImagePath);
      }
      if (Array.isArray(pt.otherImagePaths)) {
        for (let i = 0; i < pt.otherImagePaths.length; i++) {
          pt.otherImagePaths[i] = await resolveMediaFilename(req.tenantDir, pt.otherImagePaths[i]);
        }
      }
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

const THUMB_RE = /^\.thumbs\/.+\.webp$/i;

router.get(/^\/files\/images\/(.+)$/, verifyReadPassword, async (req, res) => {
  const rel = decodeURIComponent(req.params[0]);

  let absPath;
  try { absPath = req.blogPath(`images/${rel}`); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }

  if (THUMB_RE.test(rel)) {
    try {
      await fs.access(absPath);
    } catch {
      const original = await findOriginalForThumbRel(req.tenantDir, `images/${rel}`);
      if (!original) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).json({ error: 'Original not found' });
      }
      const ok = await generateThumbnail(original, absPath);
      if (!ok) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(500).json({ error: 'Thumbnail generation failed' });
      }
    }
  }

  try {
    const stats = await fs.stat(absPath);
    if (!stats.isFile()) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Not found' });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'Not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(absPath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Send failed' });
    }
  });
});

router.get('/routes', verifyReadPassword, async (req, res) => {
  try {
    const out = await buildRoutesForBlog(req.tenantDir);
    res.setHeader('Cache-Control', 'no-store');
    res.json(out);
  } catch (err) {
    console.error(`ROUTES FAILED: ${err.message}`);
    res.status(500).json({ error: 'Routes failed' });
  }
});

module.exports = router;
