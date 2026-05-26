import { useState, useEffect } from 'react';
import { Trip } from '../model/Trip.js';
import { applyRouteStyles } from '../model/routeStyles.js';
import { setupPushNotifications, sendAuthToServiceWorker } from './usePushNotifications.js';
import { AUTH_COOKIE } from '../constants.js';
import { API_BASE } from '../constants.js';
import { getCookie, setCookie, deleteCookie } from '../utils.js';

/**
 * Handles authentication state and trip data loading.
 * Returns trip, loading state, auth error, login/logout, and new-point tracking.
 */
export function useTripLoader() {
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(getCookie(AUTH_COOKIE));
    const [newPointIds, setNewPointIds] = useState(new Set());
    const [initialActiveId, setInitialActiveId] = useState(null);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setError(null);

        sendAuthToServiceWorker(token);

        const routeStylesFetch = fetch(`${API_BASE}/route-styles`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);

        Promise.all([Trip.getInstance(token), routeStylesFetch])
            .then(([loadedTrip, routeStylesData]) => {
                if (routeStylesData) applyRouteStyles(routeStylesData);
                setTrip(loadedTrip);

                const lastKnown = parseInt(localStorage.getItem('lastKnownPointOrder')) || 0;
                const orders = loadedTrip.points.map(p => p.order);
                const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;
                const newIds = new Set(
                    loadedTrip.points.filter(p => p.order > lastKnown).map(p => p.id)
                );
                setNewPointIds(newIds);

                const sorted = [...loadedTrip.points].sort((a, b) => a.order - b.order);
                const firstNew = sorted.find(p => newIds.has(p.id));
                const target = firstNew || sorted[sorted.length - 1];
                if (target) setInitialActiveId(target.id);

                localStorage.setItem('lastKnownPointOrder', String(maxOrder));
                setupPushNotifications(token);
            })
            .catch(err => {
                setError(err.message);
                setToken(null);
                deleteCookie(AUTH_COOKIE);
            })
            .finally(() => setLoading(false));

        return () => Trip.destroyInstance();
    }, [token]);

    const login = (password) => {
        setCookie(AUTH_COOKIE, password);
        setToken(password);
    };

    return { trip, loading, error, newPointIds, initialActiveId, login };
}
