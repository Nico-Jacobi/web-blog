import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import PasswordGate from './components/PasswortGate.jsx';
import LandingPage from './components/LandingPage.jsx';
import { useLeaflet } from './controller/useLeaflet.js';
import { useTripLoader } from './controller/useTripLoader.js';
import { useHistoryNavigation } from './controller/useHistoryNavigation.js';
import { registerServiceWorker } from './controller/usePushNotifications.js';
import { parseSlugAndPath, slugify } from './controller/router.js';

function useCurrentSlug() {
  const [slug, setSlug] = useState(() => parseSlugAndPath().slug);
  useEffect(() => {
    const onPop = () => setSlug(parseSlugAndPath().slug);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return slug;
}

export default function App() {
  const slug = useCurrentSlug();
  const {
    meta, blogNotFound, trip, loading, error,
    newPointIds, initialActiveId, requiresPassword, login,
  } = useTripLoader(slug);

  const [activeId, setActiveId] = useState(null);
  const [flyToCounter, setFlyToCounter] = useState(0);
  const [detailId, setDetailId] = useState(null);
  const [mobileShowMap, setMobileShowMap] = useState(false);

  const leafletReady = useLeaflet();
  const mapViewRef = useRef(null);

  const resolveSlug = useCallback((pointSlug) => {
    if (!trip || !pointSlug) return null;
    return trip.points.find(p => !p.isWaypoint && slugify(p.title) === pointSlug)?.id ?? null;
  }, [trip]);

  const getSlug = useCallback((id) => {
    if (!trip) return null;
    const point = trip.getPoint(id);
    if (!point || point.isWaypoint) return null;
    return slugify(point.title);
  }, [trip]);

  const { applyInitialPath } = useHistoryNavigation({
    slug,
    detailId, setDetailId, mobileShowMap, setMobileShowMap, setActiveId,
    resolveSlug, getSlug,
  });

  useEffect(() => { registerServiceWorker(); }, []);

  useEffect(() => {
    if (!trip) return;
    applyInitialPath();
    if (!detailId && initialActiveId) setActiveId(initialActiveId);
  }, [trip, initialActiveId, applyInitialPath]);

  // Apply the per-blog theme as CSS variables on <html>. Phase 7 will style
  // components against these; for now setting them is harmless.
  useEffect(() => {
    if (!meta?.settings) return;
    const root = document.documentElement;
    const primary = meta.settings.theme?.primary;
    const accent = meta.settings.theme?.accent;
    if (primary) root.style.setProperty('--blog-primary', primary);
    if (accent) root.style.setProperty('--blog-accent', accent);
    if (meta.settings.title) {
      document.title = meta.settings.title;
    }
  }, [meta]);

  const handleSelectStop = (id) => {
    setActiveId(id);
    if (id) {
      setFlyToCounter(c => c + 1);
      setMobileShowMap(true);
    }
  };

  const handleMobileBack = () => {
    setDetailId(null);
    setMobileShowMap(false);
    setActiveId(null);
  };

  const handleOpenDetail = (id) => {
    if (detailId === id) setDetailId(null);
    else setDetailId(id);
  };

  const sidebarTouchRef = useRef(null);
  const edgeTouchRef = useRef(null);
  const SWIPE_MIN_DX = 60;

  const onSidebarTouchStart = (e) => {
    const t = e.touches[0];
    sidebarTouchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onSidebarTouchEnd = (e) => {
    const start = sidebarTouchRef.current;
    sidebarTouchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx < -SWIPE_MIN_DX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setMobileShowMap(true);
    }
  };

  const onEdgeTouchStart = (e) => {
    const t = e.touches[0];
    edgeTouchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onEdgeTouchEnd = (e) => {
    const start = edgeTouchRef.current;
    edgeTouchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (dx < -SWIPE_MIN_DX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      handleMobileBack();
    }
  };

  const activePoint = useMemo(
    () => detailId ? trip?.getPoint(detailId) : null,
    [detailId, trip]
  );

  // ── render branches ─────────────────────────────────────────────────
  if (!slug) return <LandingPage />;
  if (blogNotFound) return <LandingPage blogNotFound />;

  if (loading && !trip && !meta) {
    return (
      <div className="fixed inset-0 bg-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!trip) {
    if (requiresPassword) {
      return (
        <PasswordGate
          onPasswordSubmit={login}
          authError={error === 'unauthorized'}
          isLoading={loading}
        />
      );
    }
    if (error) {
      return (
        <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-slate-600 text-center px-6">
          {error}
        </div>
      );
    }
    return (
      <div className="fixed inset-0 bg-orange-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh w-screen bg-slate-50 overflow-hidden">
      <Header trip={trip} blogMeta={meta} onMapToggle={() => { mobileShowMap ? handleMobileBack() : setMobileShowMap(true); }} />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <div
          className={`${mobileShowMap ? 'hidden' : 'block'} lg:block shrink-0 w-full lg:w-auto h-full`}
          onTouchStart={onSidebarTouchStart}
          onTouchEnd={onSidebarTouchEnd}
        >
          <Sidebar activeId={activeId} onSelectStop={handleSelectStop} onOpenDetail={handleOpenDetail} trip={trip} newPointIds={newPointIds} />
        </div>
        <main className={`${mobileShowMap ? 'block' : 'hidden'} lg:block flex-1 relative min-h-0 min-w-0`}>
          <button
            onClick={handleMobileBack}
            className="lg:hidden absolute top-6 left-6 z-[1000] bg-white hover:bg-slate-50 p-2 rounded-full shadow-lg border border-slate-200 transition-all"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>
          <MapView
            ref={mapViewRef}
            activeId={activeId}
            flyToCounter={flyToCounter}
            onOpenDetail={handleOpenDetail}
            onSelectStop={handleSelectStop}
            leafletReady={leafletReady}
            trip={trip}
            newPointIds={newPointIds}
            meta={meta}
          />
          <div
            className="lg:hidden absolute top-0 right-0 bottom-0 w-4 z-[1500]"
            onTouchStart={onEdgeTouchStart}
            onTouchEnd={onEdgeTouchEnd}
          />
        </main>
      </div>
      {activePoint && <PointDetail point={activePoint} trip={trip} onClose={() => setDetailId(null)} />}
    </div>
  );
}
