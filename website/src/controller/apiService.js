import exifr from 'exifr';
import { API_BASE } from '../constants.js';

// Cache-bust marker. Bump whenever response headers change in a way that
// caches would otherwise serve a stale version.
const CACHE_BUST = 'v3';

/** Build the canonical image URL for a stored path under a blog slug. */
export function imageUrl(slug, path) {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE}/blogs/${slug}/files/images/${clean}?${CACHE_BUST}`;
}

/**
 * Build the thumbnail URL for an image path. Mirrors the server-side
 * convention: `images/foo/bar.jpg` → `images/.thumbs/foo/bar.webp`.
 * Falls back to the original URL for paths not under `images/` or for
 * unsupported file types (HEIC, videos).
 */
export function thumbUrl(slug, path) {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  const rest = clean.replace(/^images\//, '');
  const ext = (rest.match(/\.([^./]+)$/)?.[1] || '').toLowerCase();
  const supported = ['jpg', 'jpeg', 'png', 'webp'];
  if (!supported.includes(ext)) return imageUrl(slug, clean);
  const stem = rest.replace(/\.[^.]+$/, '');
  return `${API_BASE}/blogs/${slug}/files/images/.thumbs/${stem}.webp?${CACHE_BUST}`;
}

function readHeaders(token) {
  return token ? { 'X-Read-Token': token } : {};
}

export const apiService = {
  /**
   * Fetches the blog metadata (title, settings, requiresPassword).
   * Public endpoint — no read token required.
   */
  async fetchMeta(slug) {
    const res = await fetch(`${API_BASE}/blogs/${slug}/meta`);
    if (res.status === 404) {
      const err = new Error('Blog not found');
      err.code = 'BLOG_NOT_FOUND';
      throw err;
    }
    if (!res.ok) throw new Error(`Failed to load blog meta (${res.status})`);
    return res.json();
  },

  async fetchJson(slug, file, token) {
    const res = await fetch(`${API_BASE}/blogs/${slug}/files/data/${file}`, {
      headers: readHeaders(token),
    });
    if (res.status === 401) {
      const err = new Error('Unauthorized');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (!res.ok) throw new Error(`Failed to fetch ${file} (${res.status})`);
    return res.json();
  },

  /**
   * Fetches an image as a blob solely to read EXIF GPS metadata.
   * Image rendering itself goes through plain <img> tags so the
   * service worker / browser cache can do their job.
   */
  async fetchImageGps(slug, path, token) {
    const res = await fetch(imageUrl(slug, path), {
      headers: readHeaders(token),
    });
    if (!res.ok) return null;
    try {
      const blob = await res.blob();
      const gps = await exifr.gps(blob);
      if (gps?.latitude && gps?.longitude) {
        return {
          lat: gps.latitude,
          lng: gps.longitude,
          blobUrl: URL.createObjectURL(blob),
        };
      }
    } catch { /* no EXIF data */ }
    return null;
  },
};
