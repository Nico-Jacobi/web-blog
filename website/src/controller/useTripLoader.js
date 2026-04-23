import { useState, useEffect } from 'react';
import { Trip } from '../model/Trip.js';
import { apiService } from './apiService.js';
import { setupPushNotifications, sendAuthToServiceWorker } from './usePushNotifications.js';
import { getAuthToken, setAuthToken, deleteAuthToken } from '../utils.js';

/**
 * Loads blog metadata + trip data for a given slug.
 *
 * Flow:
 *   1. Fetch `/blogs/:slug/meta` (public). 404 → return blogNotFound.
 *   2. If meta says `requiresPassword=false`, load trip immediately.
 *   3. Otherwise wait for the read-token (via cookie or PasswordGate).
 *   4. Try loading trip with the token. On 401, clear cookie + show gate.
 *
 * Returns the slug-scoped login() helper so PasswordGate doesn't need to
 * know about cookies.
 */
export function useTripLoader(slug) {
  const [meta, setMeta] = useState(null);
  const [blogNotFound, setBlogNotFound] = useState(false);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(() => slug ? getAuthToken(slug) : null);
  const [newPointIds, setNewPointIds] = useState(new Set());
  const [initialActiveId, setInitialActiveId] = useState(null);

  // Reset all state when slug changes (single-page app navigates between blogs).
  useEffect(() => {
    setMeta(null);
    setBlogNotFound(false);
    setTrip(null);
    setError(null);
    setToken(slug ? getAuthToken(slug) : null);
    setNewPointIds(new Set());
    setInitialActiveId(null);
    Trip.destroyInstance();
  }, [slug]);

  // 1. Load meta as soon as a slug is known.
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    setLoading(true);
    apiService.fetchMeta(slug)
      .then(m => { if (alive) setMeta(m); })
      .catch(err => {
        if (!alive) return;
        if (err.code === 'BLOG_NOT_FOUND') {
          setBlogNotFound(true);
        } else {
          setError(err.message);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  // 2. Once meta is loaded: load trip if either (a) blog is public or (b) we have a token.
  useEffect(() => {
    if (!slug || !meta) return;
    if (meta.requiresPassword && !token) return;

    setLoading(true);
    setError(null);

    if (token) sendAuthToServiceWorker(slug, token);

    Trip.getInstance(slug, token || '')
      .then(loadedTrip => {
        setTrip(loadedTrip);

        const realPoints = loadedTrip.points.filter(p => !p.isWaypoint);
        const lsKey = `lastKnownPointOrder_${slug}`;
        const lastKnown = parseInt(localStorage.getItem(lsKey)) || 0;
        const orders = realPoints.map(p => p.order);
        const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;
        const newIds = new Set(
          realPoints.filter(p => p.order > lastKnown).map(p => p.id)
        );
        setNewPointIds(newIds);

        const sorted = [...realPoints].sort((a, b) => a.order - b.order);
        const firstNew = sorted.find(p => newIds.has(p.id));
        const target = firstNew || sorted[sorted.length - 1];
        if (target) setInitialActiveId(target.id);

        localStorage.setItem(lsKey, String(maxOrder));
        if (token) setupPushNotifications(slug, token);
      })
      .catch(err => {
        if (err.code === 'UNAUTHORIZED') {
          setError('unauthorized');
          setToken(null);
          if (slug) deleteAuthToken(slug);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));

    return () => Trip.destroyInstance(slug);
  }, [slug, meta, token]);

  const login = (password) => {
    if (slug) setAuthToken(slug, password);
    setToken(password);
  };

  return {
    meta,
    blogNotFound,
    trip,
    loading,
    error,
    newPointIds,
    initialActiveId,
    requiresPassword: meta?.requiresPassword === true,
    login,
  };
}
