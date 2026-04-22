'use strict';

const path = require('path');
const fs = require('fs').promises;
const { STORAGE_DIR } = require('../config');

const BLOGS_ROOT = path.join(STORAGE_DIR, 'blogs');
const SHARED_ROOT = path.join(STORAGE_DIR, 'shared');

function blogRoot(blogId) {
  if (!blogId || typeof blogId !== 'string' || blogId.includes('/') || blogId.includes('\\') || blogId.includes('..')) {
    throw new Error('Invalid blogId');
  }
  return path.join(BLOGS_ROOT, blogId);
}

function blogPath(blogId, relative) {
  const root = blogRoot(blogId);
  const cleaned = String(relative || '').replace(/\\+/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(root, cleaned);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Path traversal attempt blocked');
  }
  return resolved;
}

async function ensureBlogDirs(blogId) {
  const root = blogRoot(blogId);
  await fs.mkdir(path.join(root, 'data'), { recursive: true });
  await fs.mkdir(path.join(root, 'images'), { recursive: true });
  await fs.mkdir(path.join(root, 'images', '.thumbs'), { recursive: true });
  return root;
}

async function ensureSharedDirs() {
  await fs.mkdir(SHARED_ROOT, { recursive: true });
  return SHARED_ROOT;
}

async function removeBlogDir(blogId) {
  const root = blogRoot(blogId);
  await fs.rm(root, { recursive: true, force: true });
}

module.exports = {
  BLOGS_ROOT,
  SHARED_ROOT,
  blogRoot,
  blogPath,
  ensureBlogDirs,
  ensureSharedDirs,
  removeBlogDir,
};
