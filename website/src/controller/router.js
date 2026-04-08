/**
 * Lightweight path-based router.
 *
 * Route definitions map a pattern to a name.  Patterns use `:param` for
 * dynamic segments.  Example:
 *
 *   { name: 'stop', pattern: '/stop/:slug' }
 *
 * Routes are resolved against `window.location.pathname`, with the app's
 * base path (e.g. `/website`) stripped first.  Reloading or sharing a deep
 * link works as long as the hosting reverse-proxy serves index.html as a
 * fallback for unknown paths under the base.
 */

const ROUTES = [
    { name: 'stop', pattern: '/stop/:slug' },
    { name: 'map',  pattern: '/map' },
];

// Vite injects BASE_URL (e.g. "/website/").  Normalise to "/website" (no trailing slash, "" for root).
const RAW_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
export const BASE_PATH = RAW_BASE; // "" or "/website"

// ── helpers ──────────────────────────────────────────────────────────

export function slugify(text) {
    return text
        .toString()
        .normalize('NFD')                   // decompose accents
        .replace(/[\u0300-\u036f]/g, '')    // strip accent marks
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')       // non-alphanum → dash
        .replace(/^-+|-+$/g, '');           // trim leading/trailing dashes
}

/** Strip the app base path off a pathname.  "/website/stop/x" → "/stop/x" */
function stripBase(pathname) {
    if (!BASE_PATH) return pathname || '/';
    if (pathname === BASE_PATH) return '/';
    if (pathname.startsWith(BASE_PATH + '/')) return pathname.slice(BASE_PATH.length);
    return pathname || '/';
}

/** Prepend the app base path.  "/stop/x" → "/website/stop/x" */
function withBase(path) {
    if (!BASE_PATH) return path;
    return BASE_PATH + path;
}

// ── parsing ──────────────────────────────────────────────────────────

/** Parse the current pathname and return { name, params } or null. */
export function parsePath(pathname = window.location.pathname) {
    const path = stripBase(pathname) || '/';
    for (const route of ROUTES) {
        const params = matchPattern(route.pattern, path);
        if (params) return { name: route.name, params };
    }
    return null;
}

function matchPattern(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts    = path.split('/').filter(Boolean);
    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}

// ── building ─────────────────────────────────────────────────────────

/** Build a full URL path for a named route.  e.g. buildPath('stop', { slug }) */
export function buildPath(name, params = {}) {
    const route = ROUTES.find(r => r.name === name);
    if (!route) return withBase('/');
    const path = route.pattern.replace(/:(\w+)/g, (_, key) =>
        encodeURIComponent(params[key] ?? '')
    );
    return withBase(path);
}

// ── navigation ───────────────────────────────────────────────────────

export function navigateTo(name, params = {}, replace = false) {
    const target = buildPath(name, params);
    const current = window.location.pathname;
    if (current === target) return; // already there
    const url = target + window.location.search;
    if (replace) {
        window.history.replaceState(null, '', url);
    } else {
        window.history.pushState(null, '', url);
    }
}

export function clearRoute(replace = false) {
    const home = withBase('/') || '/';
    if (window.location.pathname === home && !window.location.hash) return;
    const url = home + window.location.search;
    if (replace) {
        window.history.replaceState(null, '', url);
    } else {
        window.history.pushState(null, '', url);
    }
}

// ── legacy hash-link migration ───────────────────────────────────────

/**
 * Old shared links used hash routing (e.g. "/website/#/stop/sydney").
 * If we detect such a hash on load, rewrite it to the canonical path
 * via replaceState so a normal parsePath() picks it up.  Returns true
 * if a migration happened.
 */
export function migrateLegacyHash() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#/')) return false;
    const path = hash.slice(1); // "/stop/sydney"
    for (const route of ROUTES) {
        const params = matchPattern(route.pattern, path);
        if (params) {
            const target = buildPath(route.name, params);
            window.history.replaceState(null, '', target + window.location.search);
            return true;
        }
    }
    return false;
}
