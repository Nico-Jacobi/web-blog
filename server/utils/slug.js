'use strict';

const { SLUG_REGEX } = require('../config');

const RESERVED_SLUGS = new Set([
  'auth', 'me', 'blogs', 'api', 'admin', 'static', 'assets', 'public',
  'login', 'logout', 'register', 'signup', 'signin', 'sign-in', 'sign-up',
  'settings', 'help', 'about', 'privacy', 'terms', 'tos', 'docs',
  'health', 'status', 'metrics', 'robots.txt', 'sitemap.xml', 'favicon.ico',
  'sw.js', 'manifest.json', 'index.html', 'index',
  '_', 'root', 'app', 'system',
]);

function slugify(input) {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 32);
}

function isReservedSlug(slug) {
  if (typeof slug !== 'string') return true;
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

function isValidSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (isReservedSlug(slug)) return false;
  return true;
}

module.exports = {
  RESERVED_SLUGS,
  slugify,
  isReservedSlug,
  isValidSlug,
};
