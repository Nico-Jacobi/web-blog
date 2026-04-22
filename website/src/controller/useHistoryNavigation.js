import { useEffect, useRef, useCallback } from 'react';
import { parseSlugAndPath, navigateTo, clearRoute, migrateLegacyHash } from './router.js';

/**
 * Syncs browser URL with app view state, scoped to one blog slug.
 *
 * - Opening a detail view → URL becomes /<slug>/stop/<pointSlug>
 * - Opening mobile map    → URL becomes /<slug>/map
 * - Closing / back        → URL is cleared to /<slug>
 *
 * On mount the current pathname is read so direct links / reloads work.
 * Old hash links (#/stop/<x>) are migrated to /<slug>/stop/<x>.
 */
function navDepth(detailId, mobileShowMap) {
  if (detailId) return 2;
  if (mobileShowMap) return 1;
  return 0;
}

export function useHistoryNavigation({
  slug,
  detailId, setDetailId,
  mobileShowMap, setMobileShowMap,
  setActiveId,
  resolveSlug, getSlug,
}) {
  const isNavigating = useRef(false);
  const hasAppliedInitialPath = useRef(false);
  const initialPathConsumed = useRef(false);
  const prevDepthRef = useRef(0);

  const applyInitialPath = useCallback(() => {
    if (hasAppliedInitialPath.current) return;
    hasAppliedInitialPath.current = true;
    initialPathConsumed.current = true;

    migrateLegacyHash(slug);

    const { route } = parseSlugAndPath();
    if (!route) return;

    if (route.name === 'stop') {
      const id = resolveSlug(route.params.pointSlug);
      if (id) setDetailId(id);
    } else if (route.name === 'map') {
      setMobileShowMap(true);
    }
  }, [slug, resolveSlug, setDetailId, setMobileShowMap]);

  useEffect(() => {
    if (!slug) return;
    if (!initialPathConsumed.current) return;
    if (isNavigating.current) return;

    const depth = navDepth(detailId, mobileShowMap);
    const replace = depth <= prevDepthRef.current;
    prevDepthRef.current = depth;

    if (detailId) {
      const pointSlug = getSlug(detailId);
      if (pointSlug) navigateTo(slug, 'stop', { pointSlug }, replace);
    } else if (mobileShowMap) {
      navigateTo(slug, 'map', {}, replace);
    } else {
      clearRoute(slug, replace);
    }
  }, [slug, detailId, mobileShowMap, getSlug]);

  useEffect(() => {
    const handlePopState = () => {
      isNavigating.current = true;
      const { route } = parseSlugAndPath();

      if (!route) {
        if (detailId) setDetailId(null);
        if (mobileShowMap) { setMobileShowMap(false); setActiveId(null); }
      } else if (route.name === 'stop') {
        const id = resolveSlug(route.params.pointSlug);
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
