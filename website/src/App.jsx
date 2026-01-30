import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import { Trip } from './model/Trip';
import { useLeaflet } from './controller/useLeaflet.js';
import PasswordGate from "./components/PasswortGate.jsx";

export default function App() {
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('trip_auth_key'));

    const leafletReady = useLeaflet();
    const mapViewRef = useRef(null);

    // Track previous state to determine if we are Opening or Closing
    const prevActiveId = useRef(activeId);
    const prevDetailId = useRef(detailId);

    // 1. Handle Back Button (PopState)
    useEffect(() => {
        const handlePopState = (event) => {
            // Priority 1: Close Detail if open
            if (detailId) {
                setDetailId(null);
                // Important: Stop here so we don't also close the popup in the same click
                return;
            }

            // Priority 2: Close Popup if open (and Detail was already closed)
            if (activeId) {
                // Call the map ref to physically close the leaflet popup
                mapViewRef.current?.closePopup();
                return;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [detailId, activeId]);

    // 2. Manage History Stack (PushState)
    useEffect(() => {
        // Only push state if we are OPENING a new UI element
        // (i.e., Current is set, Previous was null)
        const isDetailOpening = detailId && !prevDetailId.current;
        const isActiveOpening = activeId && !prevActiveId.current;

        if (isDetailOpening || isActiveOpening) {
            window.history.pushState(null, '', window.location.href);
        }

        // Update refs for next render
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
                sessionStorage.removeItem('trip_auth_key');
            })
            .finally(() => setLoading(false));

        return () => trip?.destroy();
    }, [token]);

    const handleSelectStop = (id) => {
        setActiveId(id);
    };

    const activePoint = detailId ? trip?.getPoint(detailId) : null;

    if (!trip) {
        return (
            <PasswordGate
                onPasswordSubmit={setToken}
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
            {activePoint && <PointDetail point={activePoint} onClose={() => setDetailId(null)} />}
        </div>
    );
}