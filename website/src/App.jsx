import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import { Trip } from './model/Trip';
import { useLeaflet } from './controller/useLeaflet.js';
import PasswordGate from "./components/PasswortGate.jsx";

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
    const [detailId, setDetailId] = useState(null);
    const [token, setToken] = useState(getCookie(AUTH_COOKIE));

    const leafletReady = useLeaflet();
    const mapViewRef = useRef(null);

    // Track previous state to determine if we are Opening or Closing
    const prevActiveId = useRef(activeId);
    const prevDetailId = useRef(detailId);

    // 1. Handle Back Button (PopState)
    useEffect(() => {
        const handlePopState = (event) => {
            // FIX: Check if we are landing on a 'detail' state.
            // If yes, it means we came back from the Lightbox, so we keep Detail open.
            if (event.state?.view === 'detail') {
                return;
            }

            // Priority 1: Close Detail if open (and state is not 'detail')
            if (detailId) {
                setDetailId(null);
                return;
            }

            // Priority 2: Close Popup
            if (activeId) {
                mapViewRef.current?.closePopup();
                return;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [detailId, activeId]);

    // 2. Manage History Stack (PushState)
    useEffect(() => {
        const isDetailOpening = detailId && !prevDetailId.current;
        const isActiveOpening = activeId && !prevActiveId.current;

        if (isDetailOpening) {
            // FIX: Tag this state as 'detail'
            window.history.pushState({ view: 'detail' }, '', window.location.href);
        } else if (isActiveOpening) {
            window.history.pushState({ view: 'map' }, '', window.location.href);
        }

        prevDetailId.current = detailId;
        prevActiveId.current = activeId;
    }, [detailId, activeId]);

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        setError(null);

        Trip.getInstance(token)
            .then(setTrip)
            .catch(err => {
                setError(err.message);
                setToken(null);
                deleteCookie(AUTH_COOKIE);
            })
            .finally(() => setLoading(false));

        return () => trip?.destroy();
    }, [token]);

    const handleSelectStop = (id) => {
        setActiveId(id);
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
            <Header trip={trip} />
            <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                <div className="hidden lg:block shrink-0">
                    <Sidebar activeId={activeId} onSelectStop={handleSelectStop} trip={trip}/>
                </div>
                <main className="flex-1 relative min-h-0 min-w-0">
                    <MapView
                        ref={mapViewRef}
                        activeId={activeId}
                        onOpenDetail={setDetailId}
                        onSelectStop={handleSelectStop}
                        leafletReady={leafletReady}
                        trip={trip}
                    />
                </main>
            </div>
            {activePoint && <PointDetail point={activePoint} trip={trip} onClose={() => setDetailId(null)} />}
        </div>
    );
}