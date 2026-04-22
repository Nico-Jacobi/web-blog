'use strict';

const path = require('path');
const fs = require('fs').promises;
const { IMAGE_EXTS, THUMB_SUPPORTED_EXTS } = require('./media');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const THUMB_DIR = '.thumbs';
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 75;

const PENDING_THUMBS = new Map();

function thumbRelPathFor(originalRel) {
  const m = originalRel.match(/^images[\\/](.+)$/i);
  if (!m) return null;
  const rest = m[1].replace(/\\/g, '/');
  if (rest.startsWith(THUMB_DIR + '/')) return null;
  const dir = path.posix.dirname(rest);
  const stem = path.posix.basename(rest, path.posix.extname(rest));
  const sub = dir === '.' ? '' : dir + '/';
  return `images/${THUMB_DIR}/${sub}${stem}.webp`;
}

async function findOriginalForThumbRel(tenantDir, thumbRel) {
  const m = thumbRel.match(/^images[\\/]\.thumbs[\\/](.+)\.webp$/i);
  if (!m) return null;
  const stem = m[1].replace(/\\/g, '/');
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP', 'heic', 'HEIC', 'heif', 'HEIF'];
  for (const ext of exts) {
    const candidate = path.join(tenantDir, 'images', `${stem}.${ext}`);
    try {
      await fs.access(candidate);
      return candidate;
    } catch { /* try next */ }
  }
  return null;
}

async function generateThumbnail(originalAbs, thumbAbs) {
  if (!sharp) return false;
  const ext = path.extname(originalAbs).toLowerCase();
  if (!THUMB_SUPPORTED_EXTS.has(ext)) return false;
  if (PENDING_THUMBS.has(thumbAbs)) return PENDING_THUMBS.get(thumbAbs);

  const promise = (async () => {
    try {
      await fs.mkdir(path.dirname(thumbAbs), { recursive: true });
      await sharp(originalAbs)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: THUMB_QUALITY })
        .toFile(thumbAbs);
      return true;
    } catch (err) {
      console.error(`THUMB FAILED: ${originalAbs} - ${err.message}`);
      return false;
    } finally {
      PENDING_THUMBS.delete(thumbAbs);
    }
  })();
  PENDING_THUMBS.set(thumbAbs, promise);
  return promise;
}

function maybeGenerateThumbForUpload(tenantDir, originalAbs) {
  const ext = path.extname(originalAbs).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return;
  const rel = path.relative(tenantDir, originalAbs).replace(/\\/g, '/');
  const thumbRel = thumbRelPathFor(rel);
  if (!thumbRel) return;
  const thumbAbs = path.join(tenantDir, thumbRel);
  generateThumbnail(originalAbs, thumbAbs).catch(() => {});
}

module.exports = {
  THUMB_DIR,
  THUMB_WIDTH,
  THUMB_QUALITY,
  thumbRelPathFor,
  findOriginalForThumbRel,
  generateThumbnail,
  maybeGenerateThumbForUpload,
  isAvailable: () => Boolean(sharp),
};
