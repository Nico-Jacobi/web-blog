import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Trip } from './Trip.js';
import { apiService } from '../controller/apiService.js';

beforeEach(() => {
  Trip.destroyInstance(); // clear the global Map between tests
  vi.restoreAllMocks();
});

function mockData(slug) {
  vi.spyOn(apiService, 'fetchJson').mockImplementation(async (_slug, file) => {
    if (file === 'points.json') {
      return [
        { id: 1, name: `${slug}-home`, lat: 10, lon: 20, tripOrder: 0, updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: `${slug}-next`, lat: 11, lon: 21, tripOrder: 1, updatedAt: '2026-01-02T00:00:00Z' },
      ];
    }
    if (file === 'trips.json') {
      return [
        { id: 100, pointId1: 1, pointId2: 2, method: 'car', updatedAt: '2026-01-02T00:00:00Z' },
      ];
    }
    return [];
  });
}

describe('Trip constructor', () => {
  test('filters tombstoned points and routes', () => {
    const points = [
      { id: 1, name: 'Live', lat: 1, lon: 2, tripOrder: 0 },
      { id: 2, name: 'Dead', lat: 3, lon: 4, tripOrder: 1, deletedAt: '2026-01-01T00:00:00Z' },
    ];
    const routes = [
      { pointId1: 1, pointId2: 2, method: 'car' },
      { pointId1: 1, pointId2: 2, method: 'foot', deletedAt: '2026-01-02T00:00:00Z' },
    ];
    const trip = new Trip('anna', points, routes, 'pw');
    expect(trip.points.length).toBe(1);
    expect(trip.points[0].id).toBe(1);
    expect(trip.routes.length).toBe(1);
    expect(trip.routes[0].mode).toBe('car');
  });

  test('sorts points by order', () => {
    const points = [
      { id: 3, name: 'C', lat: 1, lon: 2, tripOrder: 2 },
      { id: 1, name: 'A', lat: 1, lon: 2, tripOrder: 0 },
      { id: 2, name: 'B', lat: 1, lon: 2, tripOrder: 1 },
    ];
    const trip = new Trip('s', points, [], 'pw');
    expect(trip.points.map(p => p.id)).toEqual([1, 2, 3]);
  });

  test('passes slug to each Point', () => {
    const trip = new Trip('anna-trip', [
      { id: 1, name: 'x', lat: 1, lon: 2, tripOrder: 0 },
    ], [], 'pw');
    expect(trip.points[0].slug).toBe('anna-trip');
  });
});

describe('Trip.getInstance (multi-tenant Map)', () => {
  test('creates + caches a Trip per slug', async () => {
    mockData('anna');
    const t1 = await Trip.getInstance('anna-trip', 'pw');
    const t2 = await Trip.getInstance('anna-trip', 'pw');
    expect(t1).toBe(t2);
    expect(apiService.fetchJson).toHaveBeenCalledTimes(2); // points + trips, once
  });

  test('two slugs get independent Trip instances', async () => {
    const fetchMock = vi.spyOn(apiService, 'fetchJson').mockImplementation(
      async (slug, file) => {
        if (file === 'points.json') {
          return [{ id: 1, name: `${slug}-home`, lat: 1, lon: 2, tripOrder: 0 }];
        }
        return [];
      }
    );
    const anna = await Trip.getInstance('anna-trip', 'pw-a');
    const bob = await Trip.getInstance('bob-trip', 'pw-b');

    expect(anna).not.toBe(bob);
    expect(anna.slug).toBe('anna-trip');
    expect(bob.slug).toBe('bob-trip');
    expect(anna.points[0].title).toBe('anna-trip-home');
    expect(bob.points[0].title).toBe('bob-trip-home');
    expect(fetchMock).toHaveBeenCalledTimes(4); // 2 blogs × 2 files
  });

  test('destroyInstance(slug) clears only that blog', async () => {
    mockData('anna');
    const anna = await Trip.getInstance('anna-trip', 'pw');
    Trip.destroyInstance('anna-trip');
    const annaAgain = await Trip.getInstance('anna-trip', 'pw');
    expect(annaAgain).not.toBe(anna);
  });

  test('destroyInstance() without argument clears all', async () => {
    mockData('s');
    await Trip.getInstance('anna-trip', 'pw');
    await Trip.getInstance('bob-trip', 'pw');
    Trip.destroyInstance();
    const fresh = await Trip.getInstance('anna-trip', 'pw');
    // still cached from the first fetch? No — Map was cleared
    expect(apiService.fetchJson).toHaveBeenCalledTimes(6); // 2×2 before + 2×1 after
    expect(fresh.slug).toBe('anna-trip');
  });
});

describe('Trip methods', () => {
  test('getPoint returns correct point by id', () => {
    const trip = new Trip('s', [
      { id: 1, name: 'A', lat: 1, lon: 2, tripOrder: 0 },
      { id: 2, name: 'B', lat: 3, lon: 4, tripOrder: 1 },
    ], [], 'pw');
    expect(trip.getPoint(2).title).toBe('B');
    expect(trip.getPoint(99)).toBeUndefined();
  });

  test('getRouteBetween matches either direction', () => {
    const trip = new Trip('s', [
      { id: 1, name: 'A', lat: 1, lon: 2, tripOrder: 0 },
      { id: 2, name: 'B', lat: 1, lon: 2, tripOrder: 1 },
    ], [
      { pointId1: 1, pointId2: 2, method: 'car' },
    ], 'pw');
    expect(trip.getRouteBetween(1, 2)?.mode).toBe('car');
    expect(trip.getRouteBetween(2, 1)?.mode).toBe('car');
    expect(trip.getRouteBetween(1, 99)).toBeUndefined();
  });
});
