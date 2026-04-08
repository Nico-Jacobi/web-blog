import exifr from 'exifr';
import { API_BASE } from '../constants.js';

// Cache-bust marker.  Bump this whenever response headers change in a
// way that browsers / CDNs would otherwise serve a stale version (e.g.
// CORP header was wrong for v1).  All image URLs include it as a query
// param, which becomes part of the cache key everywhere — Cloudflare,
// browser HTTP cache, and our own service worker cache — so a bump
// invalidates everyone at once without touching the JSON schema.
const CACHE_BUST = 'v2';

/** Build the canonical image URL for a stored path. */
export function imageUrl(path) {
    const clean = path.startsWith('/') ? path.slice(1) : path;
    return `${API_BASE}/files/images/${clean}?${CACHE_BUST}`;
}

/**
 * Build the thumbnail URL for an image path.  Mirrors the server-side
 * convention: `images/foo/bar.jpg` → `images/.thumbs/foo/bar.webp`.
 * The server generates the thumb on first access if it doesn't exist
 * yet, so this URL is always safe to use for image paths.
 *
 * Returns the original URL for paths that don't live under `images/`
 * or for unsupported file types (videos), so callers can use it
 * uniformly without having to special-case.
 */
export function thumbUrl(path) {
    const clean = path.startsWith('/') ? path.slice(1) : path;
    const rest = clean.replace(/^images\//, '');
    const ext = (rest.match(/\.([^.\/]+)$/)?.[1] || '').toLowerCase();
    // Sharp without libheif can't decode HEIC/HEIF, so fall back.
    const supported = ['jpg', 'jpeg', 'png', 'webp'];
    if (!supported.includes(ext)) return imageUrl(clean);
    const stem = rest.replace(/\.[^.]+$/, '');
    return `${API_BASE}/files/images/.thumbs/${stem}.webp?${CACHE_BUST}`;
}

export const apiService = {
    async fetchJson(file, token) {
        const res = await fetch(`${API_BASE}/files/data/${file}`, {
            headers: { 'X-Auth-Token': btoa(token) }
        });
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
    },

    /**
     * Fetches an image as a blob solely to read EXIF GPS metadata.
     * Image rendering itself goes through plain <img> tags so the
     * service worker / browser cache can do their job.
     */
    async fetchImageGps(path, token) {
        const res = await fetch(imageUrl(path), {
            headers: { 'X-Auth-Token': btoa(token) }
        });
        if (!res.ok) return null;
        try {
            const blob = await res.blob();
            const gps = await exifr.gps(blob);
            if (gps?.latitude && gps?.longitude) {
                return {
                    lat: gps.latitude,
                    lng: gps.longitude,
                    blobUrl: URL.createObjectURL(blob)
                };
            }
        } catch (e) { /* no EXIF data */ }
        return null;
    }
};
