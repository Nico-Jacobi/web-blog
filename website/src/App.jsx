import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import { Trip } from './model/Trip';
import { useLeaflet } from './controller/useLeaflet.js';
import PasswordGate from "./components/PasswortGate.jsx";
import { registerServiceWorker, setupPushNotifications } from './controller/usePushNotifications.js';

const AUTH_COOKIE = 'trip_auth_key';

const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
};
const setCookie = (name, value) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${30 * 24 * 60 * 60}; SameSite=Strict; Secure`;
};
const deleteCookie = (name) => {
    document.cookie = `${name}=; max-age=0; SameSite=Strict; Secure`;
};

export default function App() {
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [flyToCounter, setFlyToCounter] = useState(0);
    const [detailId, setDetailId] = useState(null);
    const [token, setToken] = useState(getCookie(AUTH_COOKIE));
    const [mobileShowMap, setMobileShowMap] = useState(false);
    const [newPointIds, setNewPointIds] = useState(new Set());

    const leafletReady = useLeaflet();
    const mapViewRef = useRef(null);

    // Register service worker once on mount
    useEffect(() => { registerServiceWorker(); }, []);

    // Use refs so the popstate handler always sees current state
    const detailIdRef = useRef(detailId);
    const mobileShowMapRef = useRef(mobileShowMap);
    detailIdRef.current = detailId;
    mobileShowMapRef.current = mobileShowMap;

    // Track previous state to determine if we are Opening or Closing
    const prevDetailId = useRef(detailId);
    const prevMobileShowMap = useRef(mobileShowMap);

    // Flag to skip pushState when navigating via popstate
    const isPopping = useRef(false);

    // 1. Handle Back Button (PopState)
    useEffect(() => {
        const handlePopState = (event) => {
            isPopping.current = true;

            // If we land on a 'detail' state, keep detail open (e.g. back from lightbox)
            if (event.state?.view === 'detail') {
                isPopping.current = false;
                return;
            }

            // Priority 1: Close Detail if open
            if (detailIdRef.current) {
                setDetailId(null);
                isPopping.current = false;
                return;
            }

            // Priority 2: Go from map back to list on mobile
            if (mobileShowMapRef.current) {
                setMobileShowMap(false);
                setActiveId(null);
                isPopping.current = false;
                return;
            }

            isPopping.current = false;
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 2. Manage History Stack (PushState)
    useEffect(() => {
        if (isPopping.current) {
            prevDetailId.current = detailId;
            return;
        }
        if (detailId && !prevDetailId.current) {
            window.history.pushState({ view: 'detail' }, '', window.location.href);
        }
        prevDetailId.current = detailId;
    }, [detailId]);

    useEffect(() => {
        if (isPopping.current) {
            prevMobileShowMap.current = mobileShowMap;
            return;
        }
        if (mobileShowMap && !prevMobileShowMap.current) {
            window.history.pushState({ view: 'map' }, '', window.location.href);
        }
        prevMobileShowMap.current = mobileShowMap;
    }, [mobileShowMap]);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setError(null);

        Trip.getInstance(token)
            .then(loadedTrip => {
                setTrip(loadedTrip);

                const lastKnown = parseInt(localStorage.getItem('lastKnownPointOrder')) || 0;
                const orders = loadedTrip.points.map(p => p.order);
                const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;
                const newIds = new Set(
                    loadedTrip.points.filter(p => p.order > lastKnown).map(p => p.id)
                );
                setNewPointIds(newIds);

                // Focus on first new point, or most recent if none are new
                const sorted = [...loadedTrip.points].sort((a, b) => a.order - b.order);
                const firstNew = sorted.find(p => newIds.has(p.id));
                const target = firstNew || sorted[sorted.length - 1];
                if (target) setActiveId(target.id);

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

    const handleSelectStop = (id) => {
        setActiveId(id);
        if (id) {
            setFlyToCounter(c => c + 1);
            setMobileShowMap(true);
        }
    };

    const handleMobileBack = () => {
        setMobileShowMap(false);
        setActiveId(null);
    };

    const activePoint = detailId ? trip?.getPoint(detailId) : null;

    if (loading && token) {
        return (
            <div className="fixed inset-0 bg-orange-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!trip) {
        return (
            <PasswordGate
                onPasswordSubmit={(pw) => { setCookie(AUTH_COOKIE, pw); setToken(pw); }}
                authError={!!error}
                isLoading={loading}
            />
        );
    }

    return (
        <div className="flex flex-col h-dvh w-screen bg-slate-50 overflow-hidden">
            <Header trip={trip} onMapToggle={() => { mobileShowMap ? handleMobileBack() : setMobileShowMap(true); }} />
            <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                {/* Sidebar: always on desktop, toggleable on mobile */}
                <div className={`${mobileShowMap ? 'hidden' : 'block'} lg:block shrink-0 w-full lg:w-auto h-full`}>
                    <Sidebar activeId={activeId} onSelectStop={handleSelectStop} onOpenDetail={setDetailId} trip={trip} newPointIds={newPointIds}/>
                </div>
                {/* Map: always on desktop, toggleable on mobile */}
                <main className={`${mobileShowMap ? 'block' : 'hidden'} lg:block flex-1 relative min-h-0 min-w-0`}>
                    {/* Mobile back button */}
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
                        onOpenDetail={setDetailId}
                        onSelectStop={handleSelectStop}
                        leafletReady={leafletReady}
                        trip={trip}
                        newPointIds={newPointIds}
                    />
                </main>
            </div>
            {activePoint && <PointDetail point={activePoint} trip={trip} onClose={() => setDetailId(null)} />}
        </div>
    );
}