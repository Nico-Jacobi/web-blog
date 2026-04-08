import { useEffect, useRef, useCallback } from 'react';
import { parsePath, navigateTo, clearRoute, migrateLegacyHash } from './router.js';

/**
 * Syncs browser URL with app view state.
 *
 * - Opening a detail view   → URL becomes /stop/<slug>
 * - Opening mobile map      → URL becomes /map
 * - Closing / back button   → URL is cleared to base
 *
 * On mount the current pathname is read so direct links / reloads work.
 * Old hash links (#/stop/<slug>) are migrated to the new path form.
 */
function navDepth(detailId, mobileShowMap) {
    if (detailId) return 2;   // detail open
    if (mobileShowMap) return 1; // map visible
    return 0;                    // list view
}

export function useHistoryNavigation({ detailId, setDetailId, mobileShowMap, setMobileShowMap, setActiveId, resolveSlug, getSlug }) {
    const isNavigating = useRef(false);
    const hasAppliedInitialPath = useRef(false);
    const initialPathConsumed = useRef(false);
    const prevDepthRef = useRef(0);

    // ── read initial path on mount ───────────────────────────────────
    const applyInitialPath = useCallback(() => {
        if (hasAppliedInitialPath.current) return;
        hasAppliedInitialPath.current = true;
        initialPathConsumed.current = true;

        // Migrate legacy "#/stop/x" links to "/stop/x" before parsing.
        migrateLegacyHash();

        const route = parsePath();
        if (!route) return;

        if (route.name === 'stop') {
            const id = resolveSlug(route.params.slug);
            if (id) setDetailId(id);
        } else if (route.name === 'map') {
            setMobileShowMap(true);
        }
    }, [resolveSlug, setDetailId, setMobileShowMap]);

    // ── sync state → URL ─────────────────────────────────────────────
    useEffect(() => {
        // Don't clear the URL before the initial path has been consumed
        if (!initialPathConsumed.current) return;
        if (isNavigating.current) return;

        const depth = navDepth(detailId, mobileShowMap);
        // Only push a new history entry when navigating "deeper";
        // otherwise replace so back/forward stays clean.
        const replace = depth <= prevDepthRef.current;
        prevDepthRef.current = depth;

        if (detailId) {
            const slug = getSlug(detailId);
            if (slug) navigateTo('stop', { slug }, replace);
        } else if (mobileShowMap) {
            navigateTo('map', {}, replace);
        } else {
            clearRoute(replace);
        }
    }, [detailId, mobileShowMap, getSlug]);

    // ── URL → state (back/forward, manual edit) ──────────────────────
    useEffect(() => {
        const handlePopState = () => {
            isNavigating.current = true;

            const route = parsePath();

            if (!route) {
                if (detailId)       setDetailId(null);
                if (mobileShowMap)  { setMobileShowMap(false); setActiveId(null); }
            } else if (route.name === 'stop') {
                const id = resolveSlug(route.params.slug);
                if (id && id !== detailId) setDetailId(id);
            } else if (route.name === 'map') {
                if (detailId) setDetailId(null);
                if (!mobileShowMap) setMobileShowMap(true);
            }

            isNavigating.current = false;
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [detailId, mobileShowMap, resolveSlug, setDetailId, setMobileShowMap, setActiveId]);

    return { applyInitialPath };
}
