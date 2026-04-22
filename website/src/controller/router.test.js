import { describe, test, expect, beforeEach } from 'vitest';
import {
  parseSlugAndPath,
  buildPath,
  navigateTo,
  clearRoute,
  slugify,
} from './router.js';

function setUrl(pathname, search = '') {
  window.history.replaceState(null, '', pathname + search);
}

beforeEach(() => {
  setUrl('/');
});

describe('slugify', () => {
  test('lowercases + dashes special chars', () => {
    expect(slugify('Anna in Vietnam!')).toBe('anna-in-vietnam');
    expect(slugify('Jenny & Leon 2025')).toBe('jenny-leon-2025');
  });

  test('strips diacritics', () => {
    expect(slugify('Österreich')).toBe('osterreich');
    expect(slugify('café')).toBe('cafe');
  });

  test('trims leading/trailing dashes', () => {
    expect(slugify('  hello  ')).toBe('hello');
    expect(slugify('-x-')).toBe('x');
  });
});

describe('parseSlugAndPath', () => {
  test('root → no slug, no route', () => {
    setUrl('/');
    expect(parseSlugAndPath()).toEqual({ slug: null, route: null });
  });

  test('valid slug only → home route', () => {
    setUrl('/anna-trip');
    expect(parseSlugAndPath()).toEqual({
      slug: 'anna-trip',
      route: { name: 'home', params: {} },
    });
  });

  test('valid slug + stop route', () => {
    setUrl('/anna-trip/stop/sydney');
    expect(parseSlugAndPath()).toEqual({
      slug: 'anna-trip',
      route: { name: 'stop', params: { pointSlug: 'sydney' } },
    });
  });

  test('valid slug + map route', () => {
    setUrl('/anna-trip/map');
    expect(parseSlugAndPath()).toEqual({
      slug: 'anna-trip',
      route: { name: 'map', params: {} },
    });
  });

  test('slug too short → not a valid slug', () => {
    setUrl('/ab');
    expect(parseSlugAndPath().slug).toBe(null);
  });

  test('uppercase input is normalised to lowercase slug', () => {
    setUrl('/AnnaTrip');
    expect(parseSlugAndPath().slug).toBe('annatrip');
  });

  test('slug starting with dash is rejected', () => {
    setUrl('/-anna');
    expect(parseSlugAndPath().slug).toBe(null);
  });

  test('valid slug + unknown route → slug present, route null', () => {
    setUrl('/anna-trip/garbage/path');
    const r = parseSlugAndPath();
    expect(r.slug).toBe('anna-trip');
    expect(r.route).toBe(null);
  });

  test('decodes URI components in route params', () => {
    setUrl('/anna-trip/stop/' + encodeURIComponent('hue-vietnam'));
    expect(parseSlugAndPath().route.params.pointSlug).toBe('hue-vietnam');
  });
});

describe('buildPath', () => {
  test('builds /<slug> for home', () => {
    expect(buildPath('anna-trip', 'home')).toBe('/anna-trip');
  });

  test('builds /<slug>/stop/<pointSlug>', () => {
    expect(buildPath('anna-trip', 'stop', { pointSlug: 'sydney' }))
      .toBe('/anna-trip/stop/sydney');
  });

  test('builds /<slug>/map', () => {
    expect(buildPath('anna-trip', 'map')).toBe('/anna-trip/map');
  });

  test('encodes special chars in params', () => {
    expect(buildPath('anna-trip', 'stop', { pointSlug: 'hue/danang' }))
      .toBe('/anna-trip/stop/hue%2Fdanang');
  });
});

describe('navigateTo + clearRoute', () => {
  test('navigateTo updates pathname', () => {
    setUrl('/anna-trip');
    navigateTo('anna-trip', 'stop', { pointSlug: 'sydney' });
    expect(window.location.pathname).toBe('/anna-trip/stop/sydney');
  });

  test('navigateTo with replace=true does not push history', () => {
    setUrl('/anna-trip');
    const before = window.history.length;
    navigateTo('anna-trip', 'map', {}, true);
    expect(window.history.length).toBe(before);
    expect(window.location.pathname).toBe('/anna-trip/map');
  });

  test('navigateTo skipped when target already current', () => {
    setUrl('/anna-trip/map');
    const beforeLen = window.history.length;
    navigateTo('anna-trip', 'map');
    expect(window.history.length).toBe(beforeLen);
  });

  test('clearRoute resets to /<slug>', () => {
    setUrl('/anna-trip/stop/sydney');
    clearRoute('anna-trip');
    expect(window.location.pathname).toBe('/anna-trip');
  });

  test('navigateTo with no slug is a no-op (defensive)', () => {
    setUrl('/anna-trip');
    navigateTo(null, 'stop', { pointSlug: 'x' });
    expect(window.location.pathname).toBe('/anna-trip');
  });
});
