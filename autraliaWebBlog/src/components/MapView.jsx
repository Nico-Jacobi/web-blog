import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {ROUTE_STYLES} from "../model/routeStyles.js";


export default function MapView({ activeId, onClearActive, onOpenDetail, leafletReady, trip }) { // NEW: add onOpenDetail prop
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    useEffect(() => {
        if (!leafletReady || !mapRef.current || mapInstance.current || !trip) return;

        const L = window.L;
        const map = L.map(mapRef.current, { center: [-25.27, 133.77], zoom: 4 });
        mapInstance.current = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

        trip.routes.forEach(route => {
            const p1 = trip.getPoint(route.from);
            const p2 = trip.getPoint(route.to);

            if (p1.lat && p2.lat) {
                const style = ROUTE_STYLES[route.mode] || ROUTE_STYLES.car;
                L.polyline(
                    [[p1.lat, p1.lng], [p2.lat, p2.lng]],
                    { ...style, lineJoin: 'round' }
                ).addTo(map);
            }
        });

        trip.points.forEach(point => {
            if (!point.lat || !point.lng) return;

            const marker = L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="background:#F97316; width:18px; height:18px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9]
                })
            }).addTo(map);

            // CHANGED: pass onOpenDetail to createPopupContent
            marker.bindPopup(createPopupContent(point, null, onOpenDetail), {
                closeButton: false,
                className: 'modern-popup'
            });

            // CHANGED: pass onOpenDetail when updating with image
            point.getTitleImage().then(img => {
                marker.setPopupContent(createPopupContent(point, img, onOpenDetail));
            });

            markersRef.current[point.id] = marker;
        });

        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [leafletReady, trip, onOpenDetail]); // CHANGED: add onOpenDetail to dependencies

    useEffect(() => {
        const marker = markersRef.current[activeId];
        const point = trip?.getPoint(activeId);

        if (mapInstance.current && marker && point) {
            mapInstance.current.flyTo([point.lat, point.lng], 8, { duration: 1 });
            marker.openPopup();
        }
    }, [activeId, trip]);

    return (
        <div className="flex-1 relative bg-slate-100 p-4 h-full">
            <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-lg">
                <div ref={mapRef} className="w-full h-full z-10" />
                {activeId && (
                    <button onClick={onClearActive} className="absolute bottom-4 right-4 z-[1000] bg-black text-white p-3 rounded-full">
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}


// CHANGED: add onOpenDetail parameter
const createPopupContent = (point, img, onOpenDetail) => {
    const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;

    // CHANGED: create DOM element instead of HTML string
    const popupDiv = document.createElement('div');
    popupDiv.style.cssText = 'width:200px; font-family: ui-sans-serif, system-ui, sans-serif; padding: 2px;';

    popupDiv.innerHTML = `
        ${img ? `<img src="${img}" style="width:100%; height:100px; object-fit:cover; border-radius:12px; margin-bottom:10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />` : ''}
        <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="color:#0f172a; font-size:14px; font-weight: 800; display:block;">${point.title}</strong>
            
            <div style="display:flex; align-items:center; gap:5px; color:#f97316; font-size:11px; font-weight: 600; margin-top:2px;">
                ${calendarIcon}
                <span>${point.date || 'No date'}</span>
            </div>
            
            <p style="margin:8px 0 0; color:#64748b; font-size:12px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${point.desc}
            </p>
            
            <button 
                id="detail-btn-${point.id}"
                style="margin-top:12px; padding:8px 16px; background:#f97316; color:white; border:none; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; width:100%; transition: background 0.2s;"
                onmouseover="this.style.background='#ea580c'"
                onmouseout="this.style.background='#f97316'"
            >
                Details anzeigen
            </button>
        </div>`;

    // NEW: add click handler to button
    setTimeout(() => {
        const btn = popupDiv.querySelector(`#detail-btn-${point.id}`);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onOpenDetail(point.id);
            });
        }
    }, 0);

    return popupDiv;
};