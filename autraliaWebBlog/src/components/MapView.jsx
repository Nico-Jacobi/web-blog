import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ROUTE_STYLES } from '../constants/routeStyles';

export default function MapView({ activeId, onClearActive, leafletReady, stops, routes }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const polylinesRef = useRef([]);

    useEffect(() => {
        if (!leafletReady || !mapRef.current || mapInstance.current || stops.length === 0) return;

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

            // Draw routes
            routes.forEach(route => {
                const startStop = stops.find(s => s.id === route.startId);
                const goalStop = stops.find(s => s.id === route.goalId);

                if (startStop && goalStop && startStop.lat && startStop.lng && goalStop.lat && goalStop.lng) {
                    const style = ROUTE_STYLES[route.method] || ROUTE_STYLES.car;
                    const polyline = L.polyline(
                        [[startStop.lat, startStop.lng], [goalStop.lat, goalStop.lng]],
                        { ...style, renderer: L.canvas() }
                    ).addTo(map);
                    polylinesRef.current.push(polyline);
                }
            });

            // Add markers for stops
            stops.forEach(stop => {
                if (!stop.lat || !stop.lng) return;

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
            <img src="${stop.image}" style="width: 100%; height: 80px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'" />
            <div style="padding-top: 6px;">
              <strong>${stop.title}</strong>
            </div>
            ${stop.date ? `<div style="font-size: 12px; color: #6b7280;">${stop.date}</div>` : ''}
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
    }, [leafletReady, stops, routes]);

    useEffect(() => {
        if (!mapInstance.current || !activeId) return;
        const stop = stops.find(s => s.id === activeId);
        if (stop && stop.lat && stop.lng && markersRef.current[activeId]) {
            mapInstance.current.flyTo([stop.lat, stop.lng], 7, { duration: 1.5 });
            markersRef.current[activeId].openPopup();
        }
    }, [activeId, stops]);

    return (
        <div className="flex-1 relative bg-slate-100 p-4 md:p-6 min-w-0">
            <div className="w-full h-full rounded-3xl overflow-hidden shadow-xl border-4 border-white relative">
                {(!leafletReady || stops.length === 0) && (
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