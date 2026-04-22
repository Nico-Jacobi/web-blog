'use strict';

const path = require('path');
const fs = require('fs').promises;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);
const MEDIA_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm'];
const THUMB_SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function detectRealExt(absPath) {
  let fd;
  try {
    fd = await fs.open(absPath, 'r');
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, 12, 0);

    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return '.jpg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return '.png';
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return '.webp';
    if (buf.toString('ascii', 4, 8) === 'ftyp') return '.mp4';
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return '.webm';

    return null;
  } catch {
    return null;
  } finally {
    if (fd) await fd.close();
  }
}

async function fixExtensionIfNeeded(absPath) {
  const claimedExt = path.extname(absPath).toLowerCase();
  const realExt = await detectRealExt(absPath);
  if (!realExt || realExt === claimedExt) return absPath;
  if ((claimedExt === '.jpeg' && realExt === '.jpg') ||
      (claimedExt === '.jpg' && realExt === '.jpeg')) return absPath;

  const corrected = absPath.replace(/\.[^.]+$/, realExt);
  await fs.rename(absPath, corrected);
  return corrected;
}

async function resolveMediaFilename(tenantDir, filename) {
  const absPath = path.join(tenantDir, 'images', filename);
  try { await fs.access(absPath); return filename; } catch { /* missing */ }

  const stem = filename.replace(/\.[^.]+$/, '');
  for (const ext of MEDIA_EXTS) {
    const alt = stem + ext;
    try {
      await fs.access(path.join(tenantDir, 'images', alt));
      return alt;
    } catch { continue; }
  }
  return filename;
}

module.exports = {
  IMAGE_EXTS,
  VIDEO_EXTS,
  MEDIA_EXTS,
  THUMB_SUPPORTED_EXTS,
  detectRealExt,
  fixExtensionIfNeeded,
  resolveMediaFilename,
};
