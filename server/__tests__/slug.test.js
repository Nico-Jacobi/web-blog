'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';

const { slugify, isReservedSlug, isValidSlug } = require('../utils/slug');

test('slugify lowercases and replaces special chars', () => {
  assert.equal(slugify('Anna in Vietnam!'), 'anna-in-vietnam');
  assert.equal(slugify('Jenny & Leon 2025'), 'jenny-leon-2025');
  assert.equal(slugify('  multi   spaces  '), 'multi-spaces');
});

test('slugify strips accents', () => {
  assert.equal(slugify('Österreich'), 'osterreich');
  assert.equal(slugify('café'), 'cafe');
});

test('slugify caps length at 32', () => {
  const input = 'a'.repeat(100);
  assert.ok(slugify(input).length <= 32);
});

test('slugify returns empty for non-strings', () => {
  assert.equal(slugify(null), '');
  assert.equal(slugify(42), '');
});

test('isReservedSlug catches API paths', () => {
  assert.ok(isReservedSlug('auth'));
  assert.ok(isReservedSlug('me'));
  assert.ok(isReservedSlug('blogs'));
  assert.ok(isReservedSlug('admin'));
  assert.ok(isReservedSlug('favicon.ico'));
  assert.ok(!isReservedSlug('anna_blog'));
});

test('isValidSlug enforces regex + reserved check', () => {
  assert.ok(isValidSlug('anna_blog'));
  assert.ok(isValidSlug('jenny-australien'));
  assert.ok(!isValidSlug('ab'), 'too short');
  assert.ok(!isValidSlug('Anna_Blog'), 'uppercase not allowed');
  assert.ok(!isValidSlug('anna blog'), 'space not allowed');
  assert.ok(!isValidSlug('auth'), 'reserved');
  assert.ok(!isValidSlug('-anna'), 'cannot start with dash');
});
