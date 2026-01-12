import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import { useAppData } from './hooks/useAppData';
import { useLeaflet } from './hooks/useLeaflet';



// ========================================
// MAIN APP COMPONENT
// ========================================
export default function App() {
    const [activeId, setActiveId] = useState(null);
    const leafletReady = useLeaflet();
    const { stops, routes, loading, error } = useAppData();

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center">
                    <div className="text-red-500 text-lg font-bold mb-2">Fehler beim Laden der Daten</div>
                    <div className="text-slate-600 text-sm">{error}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                        Erneut versuchen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-slate-50 to-orange-50 overflow-hidden">
            <style>{`
        .leaflet-container {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
        #root { height: 100vh; width: 100vw; }
      `}</style>

            <Header />

            <main className="flex-1 flex min-h-0 w-full overflow-hidden">
                <div className="flex shrink-0 min-w-0">
                    <Sidebar
                        activeId={activeId}
                        onSelectStop={setActiveId}
                        stops={stops}
                        loading={loading}
                    />
                </div>

                <div className="flex-1 flex min-w-0 h-full">
                    <MapView
                        activeId={activeId}
                        onClearActive={() => setActiveId(null)}
                        leafletReady={leafletReady}
                        stops={stops}
                        routes={routes}
                    />
                </div>
            </main>
        </div>
    );
}