#!/usr/bin/env node
/**
 * Backfill thumbnails for every existing image in the storage tree.
 *
 * Walks <UPLOAD_DIR>/media/ recursively, generates a webp thumbnail
 * under <UPLOAD_DIR>/media/.thumbs/<same-relpath>.webp for any image
 * that doesn't already have one.  Idempotent — re-run safely.
 *
 * Usage:
 *   node scripts/backfill-thumbs.js                    # uses ./storage
 *   UPLOAD_DIR=/home/foo/storage node scripts/backfill-thumbs.js
 *
 * Run on the host (Pi) once after deploying the new fileserver.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;

let sharp;
try {
    sharp = require('sharp');
} catch {
    console.error('❌ sharp not installed.  Run: npm install sharp');
    process.exit(1);
}

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');
const IMAGES_DIR = path.join(UPLOAD_DIR, 'media');
const THUMB_DIR_NAME = '.thumbs';
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 75;
const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let generated = 0;
let skipped = 0;
let failed = 0;

async function walk(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
        console.error(`❌ Cannot read ${dir}: ${err.message}`);
        return;
    }
    for (const entry of entries) {
        if (entry.name === THUMB_DIR_NAME) continue; // never recurse into thumbs
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(full);
        } else if (entry.isFile()) {
            await processFile(full);
        }
    }
}

async function processFile(originalAbs) {
    const ext = path.extname(originalAbs).toLowerCase();
    if (!SUPPORTED.has(ext)) return;

    // Build thumb path: media/sydney/bar.jpg → media/.thumbs/sydney/bar.webp
    const relFromImages = path.relative(IMAGES_DIR, originalAbs).replace(/\\/g, '/');
    const stem = relFromImages.replace(/\.[^.]+$/, '');
    const thumbAbs = path.join(IMAGES_DIR, THUMB_DIR_NAME, `${stem}.webp`);

    try {
        await fs.access(thumbAbs);
        skipped++;
        return;
    } catch { /* missing — generate */ }

    try {
        await fs.mkdir(path.dirname(thumbAbs), { recursive: true });
        await sharp(originalAbs)
            .rotate()
            .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
            .webp({ quality: THUMB_QUALITY })
            .toFile(thumbAbs);
        generated++;
        if (generated % 25 === 0) console.log(`  ... ${generated} generated`);
    } catch (err) {
        failed++;
        console.error(`❌ ${relFromImages}: ${err.message}`);
    }
}

(async () => {
    console.log(`Backfilling thumbnails under ${IMAGES_DIR}`);
    try {
        await fs.access(IMAGES_DIR);
    } catch {
        console.error(`❌ ${IMAGES_DIR} does not exist. Run the migration script first.`);
        process.exit(1);
    }
    const start = Date.now();
    await walk(IMAGES_DIR);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Done in ${secs}s — generated: ${generated}, skipped: ${skipped}, failed: ${failed}`);
})();
