import React, { useState, useEffect } from 'react';
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
                    <Sidebar activeId={activeId} onSelectStop={setActiveId} trip={trip}/>
                </div>
                <main className="flex-1 relative min-h-0 min-w-0">
                    <MapView
                        activeId={activeId}
                        onOpenDetail={setDetailId}
                        onSelectStop={setActiveId}
                        leafletReady={leafletReady}
                        trip={trip}
                    />
                </main>
            </div>
            {activePoint && <PointDetail point={activePoint} onClose={() => setDetailId(null)} />}
        </div>
    );
}