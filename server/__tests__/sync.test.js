'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';

const { mergePoints, mergeTrips } = require('../services/sync');

const ts = (s) => s;

test('mergePoints: server-only items survive', () => {
  const server = [{ id: 1, name: 'A', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const client = [];
  const m = mergePoints(server, client);
  assert.equal(m.length, 1);
  assert.equal(m[0].id, 1);
});

test('mergePoints: client-only items get added', () => {
  const server = [];
  const client = [{ id: 2, name: 'B', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.equal(m.length, 1);
  assert.equal(m[0].id, 2);
});

test('mergePoints: newer client wins over older server', () => {
  const server = [{ id: 1, name: 'old', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const client = [{ id: 1, name: 'new', updatedAt: ts('2026-02-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.equal(m[0].name, 'new');
});

test('mergePoints: older client loses to newer server', () => {
  const server = [{ id: 1, name: 'new', updatedAt: ts('2026-02-01T00:00:00Z') }];
  const client = [{ id: 1, name: 'old', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.equal(m[0].name, 'new');
});

test('mergePoints: tombstone with newer ts marks deletion', () => {
  const server = [{ id: 1, name: 'live', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const client = [{ id: 1, name: 'live', updatedAt: ts('2026-02-01T00:00:00Z'), deletedAt: ts('2026-02-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.ok(m[0].deletedAt);
});

test('mergePoints: resurrection (newer non-deleted overrides tombstone)', () => {
  const server = [{ id: 1, name: 'gone', updatedAt: ts('2026-01-01T00:00:00Z'), deletedAt: ts('2026-01-01T00:00:00Z') }];
  const client = [{ id: 1, name: 'back', updatedAt: ts('2026-02-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.equal(m[0].name, 'back');
  assert.equal(m[0].deletedAt, undefined);
});

test('mergePoints: legacy items without timestamp lose to timestamped', () => {
  const server = [{ id: 1, name: 'legacy' }];
  const client = [{ id: 1, name: 'modern', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const m = mergePoints(server, client);
  assert.equal(m[0].name, 'modern');
});

test('mergeTrips: trips with explicit id are keyed by id', () => {
  const server = [{ id: 100, pointId1: 1, pointId2: 2, method: 'car', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const client = [{ id: 100, pointId1: 1, pointId2: 2, method: 'foot', updatedAt: ts('2026-02-01T00:00:00Z') }];
  const m = mergeTrips(server, client);
  assert.equal(m.length, 1);
  assert.equal(m[0].method, 'foot');
});

test('mergeTrips: legacy trips without id use synthetic key', () => {
  const server = [{ pointId1: 5, pointId2: 6, method: 'car' }];
  const client = [{ pointId1: 5, pointId2: 6, method: 'foot', updatedAt: ts('2026-02-01T00:00:00Z') }];
  const m = mergeTrips(server, client);
  assert.equal(m.length, 1);
  assert.equal(m[0].method, 'foot');
});

test('multi-client: device A adds #2, device B adds #4 — both survive', () => {
  const initial = [{ id: 1, name: 'home', updatedAt: ts('2026-01-01T00:00:00Z') }];
  const deviceA = [
    { id: 1, name: 'home', updatedAt: ts('2026-01-01T00:00:00Z') },
    { id: 2, name: 'A-stop', updatedAt: ts('2026-01-02T00:00:00Z') },
  ];
  const deviceB = [
    { id: 1, name: 'home', updatedAt: ts('2026-01-01T00:00:00Z') },
    { id: 4, name: 'B-stop', updatedAt: ts('2026-01-03T00:00:00Z') },
  ];
  const after_a = mergePoints(initial, deviceA);
  const after_b = mergePoints(after_a, deviceB);
  const ids = after_b.map(p => p.id).sort();
  assert.deepEqual(ids, [1, 2, 4]);
});
