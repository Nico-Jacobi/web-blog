import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import PointDetail from './components/PointDetail';
import PasswordGate from './components/PasswortGate.jsx';
import { useLeaflet } from './controller/useLeaflet.js';
import { useTripLoader } from './controller/useTripLoader.js';
import { useHistoryNavigation } from './controller/useHistoryNavigation.js';
import { registerServiceWorker } from './controller/usePushNotifications.js';

export default function App() {
    const { trip, loading, error, newPointIds, initialActiveId, login } = useTripLoader();

    const [activeId, setActiveId] = useState(null);
    const [flyToCounter, setFlyToCounter] = useState(0);
    const [detailId, setDetailId] = useState(null);
    const [mobileShowMap, setMobileShowMap] = useState(false);

    const leafletReady = useLeaflet();
    const mapViewRef = useRef(null);

    useHistoryNavigation({ detailId, setDetailId, mobileShowMap, setMobileShowMap, setActiveId });

    useEffect(() => { registerServiceWorker(); }, []);

    // Set initial active point once trip loads
    useEffect(() => {
        if (initialActiveId) setActiveId(initialActiveId);
    }, [initialActiveId]);

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

    const handleOpenDetail = (id) => setDetailId(prev => prev === id ? null : id);

    const activePoint = detailId ? trip?.getPoint(detailId) : null;

    if (loading && !trip) {
        return (
            <div className="fixed inset-0 bg-orange-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!trip) {
        return (
            <PasswordGate
                onPasswordSubmit={login}
                authError={!!error}
                isLoading={loading}
            />
        );
    }

    return (
        <div className="flex flex-col h-dvh w-screen bg-slate-50 overflow-hidden">
            <Header trip={trip} onMapToggle={() => { mobileShowMap ? handleMobileBack() : setMobileShowMap(true); }} />
            <div className="flex flex-1 min-h-0 w-full overflow-hidden">
                <div className={`${mobileShowMap ? 'hidden' : 'block'} lg:block shrink-0 w-full lg:w-auto h-full`}>
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
                    />
                </main>
            </div>
            {activePoint && <PointDetail point={activePoint} trip={trip} onClose={() => setDetailId(null)} />}
        </div>
    );
}
