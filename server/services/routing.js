'use strict';

const path = require('path');
const fs = require('fs').promises;

const { SHARED_ROOT } = require('../utils/paths');

const ROUTES_CACHE_FILE = path.join(SHARED_ROOT, 'routes-cache.json');
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const ROUTE_MODE_TO_PROFILE = {
  car: 'driving', rv: 'driving', bus: 'driving',
  foot: 'foot', misc: 'driving',
};
const ROUTE_MAX_DETOUR_FACTOR = 5;
const ROUTE_MAX_SNAP_DISTANCE = 1000;

let routesCacheMem = null;
let routesCacheLoading = null;
let routesCacheDirty = false;
let routesCacheSaveTimer = null;

async function loadRoutesCache() {
  if (routesCacheMem) return routesCacheMem;
  if (routesCacheLoading) return routesCacheLoading;
  routesCacheLoading = (async () => {
    try {
      const raw = await fs.readFile(ROUTES_CACHE_FILE, 'utf8');
      routesCacheMem = JSON.parse(raw);
    } catch {
      routesCacheMem = {};
    }
    return routesCacheMem;
  })();
  return routesCacheLoading;
}

async function saveRoutesCacheNow() {
  if (routesCacheSaveTimer) {
    clearTimeout(routesCacheSaveTimer);
    routesCacheSaveTimer = null;
  }
  if (!routesCacheDirty || !routesCacheMem) return;
  routesCacheDirty = false;
  try {
    await fs.mkdir(path.dirname(ROUTES_CACHE_FILE), { recursive: true });
    await fs.writeFile(ROUTES_CACHE_FILE, JSON.stringify(routesCacheMem));
  } catch (err) {
    console.error('Failed to save routes cache:', err.message);
  }
}

function scheduleRoutesCacheSave() {
  routesCacheDirty = true;
  if (routesCacheSaveTimer) return;
  routesCacheSaveTimer = setTimeout(() => {
    routesCacheSaveTimer = null;
    saveRoutesCacheNow().catch(() => {});
  }, 500);
}

function routeKey(p1, p2, profile) {
  return `${p1.lat},${p1.lng};${p2.lat},${p2.lng};${profile}`;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function greatCircleArc(p1, p2, n = 100) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const lat1 = toRad(p1.lat), lng1 = toRad(p1.lng);
  const lat2 = toRad(p2.lat), lng2 = toRad(p2.lng);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat1 - lat2) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng1 - lng2) / 2) ** 2
  ));
  if (d < 1e-10) return [[p1.lat, p1.lng], [p2.lat, p2.lng]];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return out;
}

async function fetchOsrmRoute(p1, p2, profile) {
  try {
    const url = `${OSRM_BASE}/${profile}/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route');
    const wp = data.waypoints;
    if (wp?.length >= 2) {
      const [snapLng1, snapLat1] = wp[0].location;
      const [snapLng2, snapLat2] = wp[wp.length - 1].location;
      const d1 = haversineMeters(p1.lat, p1.lng, snapLat1, snapLng1);
      const d2 = haversineMeters(p2.lat, p2.lng, snapLat2, snapLng2);
      if (d1 > ROUTE_MAX_SNAP_DISTANCE || d2 > ROUTE_MAX_SNAP_DISTANCE) return null;
    }
    const routeDist = data.routes[0].distance;
    const direct = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    if (direct > 0 && routeDist / direct > ROUTE_MAX_DETOUR_FACTOR) return null;
    return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch (err) {
    console.warn(`OSRM failed (${profile}): ${err.message}`);
    return null;
  }
}

const PENDING_ROUTES = new Map();

async function getRouteCoords(p1, p2, method) {
  if (method === 'plane') {
    const key = routeKey(p1, p2, 'plane');
    const cache = await loadRoutesCache();
    if (key in cache) return cache[key];
    const arc = greatCircleArc(p1, p2);
    cache[key] = arc;
    scheduleRoutesCacheSave();
    return arc;
  }
  const profile = ROUTE_MODE_TO_PROFILE[method];
  if (!profile) return null;
  const key = routeKey(p1, p2, profile);
  const cache = await loadRoutesCache();
  if (key in cache) return cache[key];
  if (PENDING_ROUTES.has(key)) return PENDING_ROUTES.get(key);
  const promise = (async () => {
    const coords = await fetchOsrmRoute(p1, p2, profile);
    cache[key] = coords;
    scheduleRoutesCacheSave();
    return coords;
  })();
  PENDING_ROUTES.set(key, promise);
  try { return await promise; }
  finally { PENDING_ROUTES.delete(key); }
}

async function buildRoutesForBlog(tenantDir) {
  const pointsPath = path.join(tenantDir, 'data', 'points.json');
  const tripsPath = path.join(tenantDir, 'data', 'trips.json');
  let pointsRaw, tripsRaw;
  try {
    [pointsRaw, tripsRaw] = await Promise.all([
      fs.readFile(pointsPath, 'utf8'),
      fs.readFile(tripsPath, 'utf8'),
    ]);
  } catch {
    return [];
  }
  let points, trips;
  try { points = JSON.parse(pointsRaw); } catch { return []; }
  try { trips = JSON.parse(tripsRaw); } catch { return []; }

  const byId = new Map(points.map(p => [p.id, {
    lat: parseFloat(p.lat) || 0,
    lng: parseFloat(p.lon) || 0,
  }]));

  const out = [];
  for (const t of trips) {
    if (t.deletedAt) continue;
    const p1 = byId.get(t.pointId1);
    const p2 = byId.get(t.pointId2);
    if (!p1 || !p2 || !p1.lat || !p2.lat) continue;
    const coords = await getRouteCoords(p1, p2, t.method);
    const final = coords || [[p1.lat, p1.lng], [p2.lat, p2.lng]];
    out.push({ from: t.pointId1, to: t.pointId2, method: t.method, coords: final });
  }
  await saveRoutesCacheNow();
  return out;
}

module.exports = {
  ROUTES_CACHE_FILE,
  haversineMeters,
  greatCircleArc,
  getRouteCoords,
  buildRoutesForBlog,
  loadRoutesCache,
  saveRoutesCacheNow,
};
