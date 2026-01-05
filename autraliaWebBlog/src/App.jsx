import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';

export default function App() {
    const [activeId, setActiveId] = useState(null);
    const [leafletReady, setLeafletReady] = useState(false);

    useEffect(() => {
        if (window.L) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setLeafletReady(true); //this is not a problem, just makes the site slower and doesn't work without
            return;
        }

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => setLeafletReady(true);
        document.body.appendChild(script);
    }, []);

    return (
        <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-slate-50 to-orange-50 overflow-hidden">
            <style>{`
                /* Verhindert das Kollabieren von Leaflet */
                .leaflet-container {
                    width: 100% !important;
                    height: 100% !important;
                    display: block;
                }
                #root { height: 100vh; width: 100vw; }
            `}</style>

            <Header />

            <main className="flex-1 flex min-h-0 w-full overflow-hidden">
                {/* min-w-0 ist kritisch für Flex-Kinder, damit sie nicht kollabieren oder überlaufen */}
                <div className="flex shrink-0 min-w-0">
                    <Sidebar activeId={activeId} onSelectStop={setActiveId} />
                </div>

                <div className="flex-1 flex min-w-0 h-full">
                    <MapView
                        activeId={activeId}
                        onClearActive={() => setActiveId(null)}
                        leafletReady={leafletReady}
                    />
                </div>
            </main>
        </div>
    );
}