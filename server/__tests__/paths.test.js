'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';
process.env.STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-paths-'));

const { blogPath, blogRoot, ensureBlogDirs } = require('../utils/paths');

const BLOG_ID = '11111111-1111-1111-1111-111111111111';

test('blogPath resolves valid relative paths under blog root', () => {
  const root = blogRoot(BLOG_ID);
  const p = blogPath(BLOG_ID, 'data/points.json');
  assert.equal(p, path.join(root, 'data', 'points.json'));
});

test('blogPath allows root itself', () => {
  const root = blogRoot(BLOG_ID);
  const p = blogPath(BLOG_ID, '');
  assert.equal(p, root);
});

test('blogPath blocks parent-dir traversal', () => {
  assert.throws(() => blogPath(BLOG_ID, '../../etc/passwd'), /Path traversal/);
  assert.throws(() => blogPath(BLOG_ID, '../other-blog/data'), /Path traversal/);
  assert.throws(() => blogPath(BLOG_ID, 'data/../../../escape'), /Path traversal/);
});

test('blogPath normalises backslashes', () => {
  const root = blogRoot(BLOG_ID);
  const p = blogPath(BLOG_ID, 'images\\sub\\file.jpg');
  assert.equal(p, path.join(root, 'images', 'sub', 'file.jpg'));
});

test('blogRoot rejects invalid blogIds', () => {
  assert.throws(() => blogRoot(''), /Invalid blogId/);
  assert.throws(() => blogRoot('../evil'), /Invalid blogId/);
  assert.throws(() => blogRoot('a/b'), /Invalid blogId/);
  assert.throws(() => blogRoot(null), /Invalid blogId/);
});

test('ensureBlogDirs creates data, images, thumbs', async () => {
  await ensureBlogDirs(BLOG_ID);
  const root = blogRoot(BLOG_ID);
  assert.ok(fs.statSync(path.join(root, 'data')).isDirectory());
  assert.ok(fs.statSync(path.join(root, 'images')).isDirectory());
  assert.ok(fs.statSync(path.join(root, 'images', '.thumbs')).isDirectory());
});
