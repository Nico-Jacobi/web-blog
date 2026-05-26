#!/usr/bin/env node
/**
 * One-time migration: move all images from storage/images/ into
 * stop-based subdirectories under storage/media/{slug}/.
 *
 * For each point in points.json:
 *   storage/images/foo.jpg  →  storage/media/sydney/foo.jpg
 *
 * Also moves matching thumbnails:
 *   storage/images/.thumbs/foo.webp  →  storage/media/.thumbs/sydney/foo.webp
 *
 * Updates points.json so that titleImagePath / otherImagePaths contain
 * '{slug}/filename' instead of just 'filename'.
 *
 * Idempotent: files already in media/ (paths containing '/') are skipped.
 *
 * Usage:
 *   node scripts/migrate-to-media-folders.js            # uses ./storage
 *   UPLOAD_DIR=/home/foo/storage node scripts/migrate-to-media-folders.js
 *   node scripts/migrate-to-media-folders.js --dry-run  # preview only
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs').promises;

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './storage');
const IMAGES_DIR = path.join(UPLOAD_DIR, 'images');
const MEDIA_DIR = path.join(UPLOAD_DIR, 'media');
const POINTS_FILE = path.join(UPLOAD_DIR, 'data', 'points.json');
const DRY_RUN = process.argv.includes('--dry-run');

function toSlug(name) {
    let s = name.toLowerCase();
    s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || 'stop';
}

async function moveFile(src, dst) {
    if (DRY_RUN) {
        console.log(`  would move: ${path.relative(UPLOAD_DIR, src)} → ${path.relative(UPLOAD_DIR, dst)}`);
        return;
    }
    await fs.mkdir(path.dirname(dst), { recursive: true });
    try {
        await fs.rename(src, dst);
    } catch (err) {
        if (err.code === 'EXDEV') {
            // Cross-device move: copy + delete
            await fs.copyFile(src, dst);
            await fs.rm(src, { force: true });
        } else {
            throw err;
        }
    }
    console.log(`  moved: ${path.relative(UPLOAD_DIR, src)} → ${path.relative(UPLOAD_DIR, dst)}`);
}

async function migrateFile(filename, slug) {
    if (!filename || filename.includes('/')) return filename; // already migrated

    const src = path.join(IMAGES_DIR, filename);
    const dst = path.join(MEDIA_DIR, slug, filename);

    try { await fs.access(src); } catch {
        console.warn(`  ⚠️  source not found, skipping: images/${filename}`);
        return filename; // leave unchanged if not found
    }

    // Check dst doesn't already exist
    try {
        await fs.access(dst);
        console.log(`  already exists at destination, skipping: media/${slug}/${filename}`);
        return `${slug}/${filename}`;
    } catch { /* proceed */ }

    await moveFile(src, dst);

    // Move matching thumbnail if it exists
    const stem = filename.replace(/\.[^.]+$/, '');
    const thumbSrc = path.join(IMAGES_DIR, '.thumbs', `${stem}.webp`);
    const thumbDst = path.join(MEDIA_DIR, '.thumbs', slug, `${stem}.webp`);
    try {
        await fs.access(thumbSrc);
        await moveFile(thumbSrc, thumbDst);
    } catch { /* no thumb to move */ }

    return `${slug}/${filename}`;
}

(async () => {
    console.log(`\n🚚 Migrating media: images/ → media/{stop}/${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

    // Load points.json
    let points;
    try {
        const raw = await fs.readFile(POINTS_FILE, 'utf8');
        points = JSON.parse(raw);
    } catch (err) {
        console.error(`❌ Cannot read ${POINTS_FILE}: ${err.message}`);
        process.exit(1);
    }

    if (!Array.isArray(points)) {
        console.error('❌ points.json is not an array');
        process.exit(1);
    }

    let movedFiles = 0;
    let updatedPaths = 0;

    for (const point of points) {
        const slug = toSlug(point.name || `point-${point.id}`);
        console.log(`\n📍 Stop: "${point.name}" → slug: "${slug}"`);

        // Title image
        if (point.titleImagePath) {
            const newPath = await migrateFile(point.titleImagePath, slug);
            if (newPath !== point.titleImagePath) {
                point.titleImagePath = newPath;
                updatedPaths++;
                movedFiles++;
            }
        }

        // Other media
        if (Array.isArray(point.otherImagePaths)) {
            for (let i = 0; i < point.otherImagePaths.length; i++) {
                const newPath = await migrateFile(point.otherImagePaths[i], slug);
                if (newPath !== point.otherImagePaths[i]) {
                    point.otherImagePaths[i] = newPath;
                    updatedPaths++;
                    movedFiles++;
                }
            }
        }
    }

    // Save updated points.json
    if (!DRY_RUN && updatedPaths > 0) {
        await fs.writeFile(POINTS_FILE, JSON.stringify(points, null, 2));
        console.log(`\n✅ points.json updated (${updatedPaths} paths rewritten)`);
    } else if (DRY_RUN) {
        console.log(`\n✅ Dry run complete — ${movedFiles} file(s) would be moved, ${updatedPaths} path(s) updated in points.json`);
    } else {
        console.log('\n✅ Nothing to migrate (all paths already updated)');
    }

    console.log(`\n📊 Summary: ${movedFiles} file(s) moved${DRY_RUN ? ' (dry run)' : ''}`);
    if (movedFiles > 0 && !DRY_RUN) {
        console.log('💡 Run `node scripts/backfill-thumbs.js` to generate thumbnails for migrated files.');
    }
})();
