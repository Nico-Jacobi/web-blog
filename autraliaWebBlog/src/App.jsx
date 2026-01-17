import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import { Trip } from './model/Trip';
import { useLeaflet } from './controller/useLeaflet.js';

export default function App() {
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const [detailId, setDetailId] = useState(null); // NEW: separate state for detail view

    const leafletReady = useLeaflet();

    useEffect(() => {
        Trip.getInstance()
            .then(setTrip)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));

        return () => trip?.destroy();
    }, []);

    const activePoint = detailId ? trip?.getPoint(detailId) : null; // CHANGED: use detailId instead of activeId

    if (loading) return <div className="h-screen flex items-center justify-center">Laden...</div>;
    if (error) return <div className="h-screen flex items-center justify-center text-red-500">{error}</div>;

    return (
        <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden">
            <Header title={trip?.title} />

            <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                <Sidebar
                    activeId={activeId}
                    onSelectStop={setActiveId}
                    trip={trip}
                />

                <main className="flex-1 relative h-full">
                    <MapView
                        activeId={activeId}
                        onClearActive={() => setActiveId(null)}
                        onOpenDetail={setDetailId} // NEW: pass detail handler
                        leafletReady={leafletReady}
                        trip={trip}
                    />
                </main>
            </div>

            {activePoint && (
                <PointDetail
                    point={activePoint}
                    onClose={() => setDetailId(null)} // CHANGED: close detailId
                />
            )}
        </div>
    );
}