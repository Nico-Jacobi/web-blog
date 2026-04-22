/**
 * Multi-tenant path router.
 *
 * URL shape: `/<blogSlug>/<route>` (e.g. `/anna-trip/stop/sydney`).
 * The first path segment is the active blog slug. All subsequent segments
 * match the route patterns below.
 *
 * `BASE_PATH` (Vite's `BASE_URL`) is stripped first so the same code works
 * whether the site is served from `/` or from a sub-path like `/website`.
 *
 * For a request without any blog slug (`/`), `parseSlugAndPath` returns
 * `{ slug: null, route: null }` so the App can render a landing page.
 */

const ROUTES = [
  { name: 'home', pattern: '/' },
  { name: 'stop', pattern: '/stop/:pointSlug' },
  { name: 'map', pattern: '/map' },
];

const RAW_BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
export const BASE_PATH = RAW_BASE;

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{2,31}$/;

export function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripBase(pathname) {
  if (!BASE_PATH) return pathname || '/';
  if (pathname === BASE_PATH) return '/';
  if (pathname.startsWith(BASE_PATH + '/')) return pathname.slice(BASE_PATH.length);
  return pathname || '/';
}

function withBase(path) {
  if (!BASE_PATH) return path;
  return BASE_PATH + path;
}

function isValidSlug(s) {
  return typeof s === 'string' && SLUG_RE.test(s);
}

/**
 * Splits the current pathname into `{ slug, route }`.
 * - `/` (or BASE_PATH) → `{ slug: null, route: null }` (landing page)
 * - `/anna-trip` → `{ slug: 'anna-trip', route: { name: 'home' } }`
 * - `/anna-trip/stop/sydney` → `{ slug, route: { name: 'stop', params: {…} } }`
 * - unknown route under a valid slug → `{ slug, route: null }`
 */
export function parseSlugAndPath(pathname = window.location.pathname) {
  const path = stripBase(pathname) || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { slug: null, route: null };

  const slug = parts[0].toLowerCase();
  if (!isValidSlug(slug)) return { slug: null, route: null };

  const rest = '/' + parts.slice(1).join('/');
  for (const r of ROUTES) {
    const params = matchPattern(r.pattern, rest);
    if (params) return { slug, route: { name: r.name, params } };
  }
  return { slug, route: null };
}

function matchPattern(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const sp = path.split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    } else if (pp[i] !== sp[i]) {
      return null;
    }
  }
  return params;
}

/** Build a URL path for `(slug, name)`, e.g. `buildPath('anna', 'stop', { pointSlug })`. */
export function buildPath(slug, name, params = {}) {
  const r = ROUTES.find(x => x.name === name);
  if (!r) return withBase('/' + slug);
  const sub = r.pattern.replace(/:(\w+)/g, (_, key) =>
    encodeURIComponent(params[key] ?? '')
  );
  const tail = sub === '/' ? '' : sub;
  return withBase('/' + slug + tail);
}

export function navigateTo(slug, name, params = {}, replace = false) {
  if (!slug) return;
  const target = buildPath(slug, name, params);
  if (window.location.pathname === target) return;
  const url = target + window.location.search;
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
}

/** Reset to the blog's home (`/<slug>`). */
export function clearRoute(slug, replace = false) {
  if (!slug) return;
  const home = withBase('/' + slug);
  if (window.location.pathname === home && !window.location.hash) return;
  const url = home + window.location.search;
  if (replace) {
    window.history.replaceState(null, '', url);
  } else {
    window.history.pushState(null, '', url);
  }
}

/**
 * Migrates legacy hash links (`/#/stop/sydney`) to canonical paths within the
 * current blog slug. Without a slug context (root visit), we can't rewrite,
 * so the landing page handles that instead.
 */
export function migrateLegacyHash(slug) {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#/') || !slug) return false;
  const path = hash.slice(1);
  for (const r of ROUTES) {
    const params = matchPattern(r.pattern, path);
    if (params) {
      const target = buildPath(slug, r.name, params);
      window.history.replaceState(null, '', target + window.location.search);
      return true;
    }
  }
  return false;
}
