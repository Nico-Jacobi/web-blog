import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { STOPS } from '../data/stops';
import {ROUTE_STYLES} from "../data/routeStyles.js";
import {ROUTES} from "../data/routes.js";

export default function MapView({ activeId, onClearActive, leafletReady }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const polylinesRef = useRef([]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current || mapInstance.current) return;

        const L = window.L;
        try {
            const map = L.map(mapRef.current, {
                center: [-25.27, 133.77],
                zoom: 4,
                zoomControl: true
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '© OSM',
                maxZoom: 19
            }).addTo(map);

            // Draw routes with different styles based on method
            ROUTES.forEach(route => {
                const startStop = STOPS.find(s => s.id === route.startId);
                const goalStop = STOPS.find(s => s.id === route.goalId);

                if (startStop && goalStop) {
                    const style = ROUTE_STYLES[route.method];
                    const polyline = L.polyline(
                        [[startStop.lat, startStop.lng], [goalStop.lat, goalStop.lng]],
                        { ...style, renderer: L.canvas() }
                    ).addTo(map);
                    polylinesRef.current.push(polyline);
                }
            });

            // Add markers for stops
            STOPS.forEach(stop => {
                const marker = L.marker([stop.lat, stop.lng], {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="background: #F97316; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);

                marker.bindPopup(`
                    <div style="width: 200px;">
                        <img src="${stop.image}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;" />
                            <div style="padding-top: 6px;">
                              <strong>${stop.title}</strong>
                                </div>
                                    <div style="font-size: 12px; color: #6b7280;">
                                      ${stop.date}
                                </div>
                            <div style="font-size: 13px; margin-top: 6px;">
                              ${stop.desc}
                        </div>
                      </div>
                `, { closeButton: false });
                markersRef.current[stop.id] = marker;
            });

            mapInstance.current = map;

            setTimeout(() => map.invalidateSize(), 300);

            const observer = new ResizeObserver(() => map.invalidateSize());
            observer.observe(mapRef.current);

            return () => observer.disconnect();
        } catch (e) {
            console.error(e);
        }
    }, [leafletReady]);

    useEffect(() => {
        if (!mapInstance.current || !activeId) return;
        const stop = STOPS.find(s => s.id === activeId);
        if (stop && markersRef.current[activeId]) {
            mapInstance.current.flyTo([stop.lat, stop.lng], 7, { duration: 1.5 });
            markersRef.current[activeId].openPopup();
        }
    }, [activeId]);

    return (
        <div className="flex-1 relative bg-slate-100 p-4 md:p-6 min-w-0">
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-xl border-4 border-white relative">
                {!leafletReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-[2000]">
                        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                <div ref={mapRef} className="w-full h-full z-10" />

                {activeId && (
                    <button
                        onClick={() => {
                            onClearActive();
                            mapInstance.current?.flyTo([-25.27, 133.77], 4);
                        }}
                        className="absolute bottom-6 right-6 z-[1000] bg-slate-900 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}