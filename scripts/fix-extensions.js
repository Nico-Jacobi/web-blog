#!/usr/bin/env node
/**
 * One-time migration: find files under images/ whose extension doesn't
 * match their actual content (magic bytes) and rename them.
 *
 * This fixes files uploaded by legacy Flutter apps that misdetect videos
 * as images (pickMultipleMedia returns temp paths without the original
 * video extension on some Android devices).
 *
 * Idempotent — re-run safely.  Only renames files that are mismatched.
 *
 * Usage:
 *   node scripts/fix-extensions.js                      # uses ./storage
 *   UPLOAD_DIR=/home/foo/storage node scripts/fix-extensions.js
 *   node scripts/fix-extensions.js --dry-run            # preview only
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');
const IMAGES_DIR = path.join(UPLOAD_DIR, 'images');
const DRY_RUN = process.argv.includes('--dry-run');

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
    } catch { return null; }
    finally { if (fd) await fd.close(); }
}

async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        if (e.name === '.thumbs') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...await walk(full));
        else files.push(full);
    }
    return files;
}

(async () => {
    console.log(`Scanning ${IMAGES_DIR}${DRY_RUN ? ' (dry run)' : ''}...\n`);
    let files;
    try { files = await walk(IMAGES_DIR); } catch (err) {
        console.error(`Cannot read ${IMAGES_DIR}: ${err.message}`);
        process.exit(1);
    }

    let renamed = 0;
    for (const absPath of files) {
        const claimedExt = path.extname(absPath).toLowerCase();
        const realExt = await detectRealExt(absPath);
        if (!realExt || realExt === claimedExt) continue;
        if ((claimedExt === '.jpeg' && realExt === '.jpg') ||
            (claimedExt === '.jpg' && realExt === '.jpeg')) continue;

        const corrected = absPath.replace(/\.[^.]+$/, realExt);
        const relOld = path.relative(UPLOAD_DIR, absPath);
        const relNew = path.relative(UPLOAD_DIR, corrected);

        if (DRY_RUN) {
            console.log(`  would rename: ${relOld} → ${relNew}`);
        } else {
            await fs.rename(absPath, corrected);
            console.log(`  renamed: ${relOld} → ${relNew}`);
        }
        renamed++;
    }

    console.log(`\nDone. ${renamed} file(s) ${DRY_RUN ? 'would be' : ''} renamed.`);
    if (renamed > 0 && !DRY_RUN) {
        console.log('Run `node scripts/backfill-thumbs.js` to generate thumbnails for renamed files.');
    }
})();
