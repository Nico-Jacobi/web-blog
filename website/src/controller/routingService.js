/**
 * Fetches real road/path routes from OSRM (free, no API key needed).
 * Falls back to straight lines for plane/boat or on error.
 */

import { haversineDistanceMeters } from '../model/geo.js';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

const MODE_TO_PROFILE = {
    car: 'driving',
    rv: 'driving',
    bus: 'driving',
    foot: 'foot',
    misc: 'driving',
};

// In-memory cache keyed by "lat1,lng1;lat2,lng2;profile"
const routeCache = new Map();

// If the OSRM route distance is more than this factor times the straight-line
// distance, the route is likely nonsensical (e.g. driving around a continent
// instead of a ferry) — fall back to a straight line instead.
const MAX_DETOUR_FACTOR = 5;

function cacheKey(p1, p2, profile) {
    return `${p1.lat},${p1.lng};${p2.lat},${p2.lng};${profile}`;
}


/**
 * Generate points along a great circle (geodesic) arc between two points.
 * This produces the curved lines you see on flight route maps.
 */
function greatCircleArc(p1, p2, numPoints = 100) {
    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;

    const lat1 = toRad(p1.lat), lng1 = toRad(p1.lng);
    const lat2 = toRad(p2.lat), lng2 = toRad(p2.lng);

    // Angular distance between the two points
    const d = 2 * Math.asin(Math.sqrt(
        Math.sin((lat1 - lat2) / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng1 - lng2) / 2) ** 2
    ));

    if (d < 1e-10) return [[p1.lat, p1.lng], [p2.lat, p2.lng]];

    const points = [];
    for (let i = 0; i <= numPoints; i++) {
        const f = i / numPoints;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
        const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
        const z = A * Math.sin(lat1) + B * Math.sin(lat2);
        points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
    }
    return points;
}

/**
 * Fetch a route between two points.
 * Returns an array of [lat, lng] pairs for the polyline.
 * Returns null if this mode shouldn't use road routing (boat).
 * Returns a great circle arc for plane routes.
 */
export async function fetchRoute(p1, p2, mode) {
    if (mode === 'plane') return greatCircleArc(p1, p2);

    const profile = MODE_TO_PROFILE[mode];
    if (!profile) return null; // boat → straight line

    const key = cacheKey(p1, p2, profile);
    if (routeCache.has(key)) return routeCache.get(key);

    try {
        const url = `${OSRM_BASE}/${profile}/${p1.lng},${p1.lat};${p2.lng},${p2.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM ${res.status}`);

        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');

        // OSRM snaps each waypoint to the nearest road. If it snaps too far
        // (e.g. point is on an island with no roads), the route is invalid.
        // Check that both snapped waypoints are within 1km of the requested ones.
        const MAX_SNAP_DISTANCE = 1000; // meters
        const waypoints = data.waypoints;
        if (waypoints?.length >= 2) {
            const [snapLng1, snapLat1] = waypoints[0].location;
            const [snapLng2, snapLat2] = waypoints[waypoints.length - 1].location;
            const snap1Dist = haversineDistanceMeters(p1, { lat: snapLat1, lng: snapLng1 });
            const snap2Dist = haversineDistanceMeters(p2, { lat: snapLat2, lng: snapLng2 });
            if (snap1Dist > MAX_SNAP_DISTANCE || snap2Dist > MAX_SNAP_DISTANCE) {
                routeCache.set(key, null);
                return null;
            }
        }

        const routeDistance = data.routes[0].distance; // meters
        const directDistance = haversineDistanceMeters(p1, p2);

        // If the road route is absurdly longer than straight-line (e.g. driving
        // around a continent instead of a ferry), fall back to the straight line.
        if (directDistance > 0 && routeDistance / directDistance > MAX_DETOUR_FACTOR) {
            routeCache.set(key, null);
            return null;
        }

        // GeoJSON coordinates are [lng, lat] → convert to [lat, lng] for Leaflet
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        routeCache.set(key, coords);
        return coords;
    } catch (e) {
        console.warn(`Route fetch failed (${mode}: ${p1.title} → ${p2.title}):`, e.message);
        routeCache.set(key, null); // cache the failure too so we don't retry
        return null;
    }
}

/**
 * Fetch routes for a trip one-by-one from latest to first.
 * Calls onRoute(index, coords) as each route resolves so it can be drawn immediately.
 */
export async function fetchAllRoutes(trip, onRoute) {
    for (let index = trip.routes.length - 1; index >= 0; index--) {
        const route = trip.routes[index];
        const p1 = trip.getPoint(route.from);
        const p2 = trip.getPoint(route.to);
        if (!p1?.lat || !p2?.lat) continue;

        const coords = await fetchRoute(p1, p2, route.mode);
        // Fall back to straight line if no accurate route available
        const finalCoords = coords || [[p1.lat, p1.lng], [p2.lat, p2.lng]];
        onRoute(index, finalCoords, route.mode);
    }
}
