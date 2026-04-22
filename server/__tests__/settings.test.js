'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';

const {
  blogSettingsSchema,
  blogSettingsPatchSchema,
  withDefaults,
  parseSettingsJson,
  DEFAULT_SETTINGS,
} = require('../schemas/blogSettings');

test('blogSettingsSchema accepts minimal valid settings', () => {
  const result = blogSettingsSchema.safeParse({ title: 'My Trip' });
  assert.ok(result.success);
});

test('blogSettingsSchema rejects extra fields', () => {
  const result = blogSettingsSchema.safeParse({ title: 'X', bogus: 1 });
  assert.ok(!result.success);
});

test('blogSettingsSchema requires title', () => {
  const result = blogSettingsSchema.safeParse({ subtitle: 'hi' });
  assert.ok(!result.success);
});

test('patch schema allows partial updates', () => {
  const r = blogSettingsPatchSchema.safeParse({ subtitle: 'newsub' });
  assert.ok(r.success);
});

test('withDefaults fills missing fields', () => {
  const merged = withDefaults({ title: 'Anna' });
  assert.equal(merged.title, 'Anna');
  assert.equal(merged.language, DEFAULT_SETTINGS.language);
  assert.equal(merged.theme.primary, DEFAULT_SETTINGS.theme.primary);
});

test('withDefaults deep-merges theme and push', () => {
  const merged = withDefaults({ title: 'Anna', theme: { primary: 'purple' } });
  assert.equal(merged.theme.primary, 'purple');
  assert.equal(merged.theme.accent, DEFAULT_SETTINGS.theme.accent);
});

test('parseSettingsJson handles garbage gracefully', () => {
  assert.deepEqual(parseSettingsJson(''), {});
  assert.deepEqual(parseSettingsJson('not json'), {});
  assert.deepEqual(parseSettingsJson('null'), {});
  assert.deepEqual(parseSettingsJson('{"a":1}'), { a: 1 });
});
