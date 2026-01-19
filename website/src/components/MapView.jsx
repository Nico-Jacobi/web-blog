import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import {ROUTE_STYLES} from "../model/routeStyles.js";


export default function MapView({ activeId, onOpenDetail, onSelectStop, leafletReady, trip }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const userClickedMarkerRef = useRef(false);

    const usedModes = trip ? [...new Set(trip.routes.map(r => r.mode))] : [];


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

            marker.on('click', () => {
                userClickedMarkerRef.current = true;
            });

            marker.on('popupopen', () => {
                onSelectStop(point.id);
            });

            marker.bindPopup(createPopupContent(point, null, onOpenDetail), {
                closeButton: false,
                className: 'modern-popup'
            });

            point.getTitleImage().then(img => {
                marker.setPopupContent(createPopupContent(point, img, onOpenDetail));
            });

            markersRef.current[point.id] = marker;
        });

        map.on('click', () => {
            onSelectStop(null);
        });

        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [leafletReady, trip, onOpenDetail, onSelectStop]);


    useEffect(() => {
        const marker = markersRef.current[activeId];
        const point = trip?.getPoint(activeId);

        if (mapInstance.current && marker && point) {
            // If user clicked the marker directly, just open popup without flying
            if (userClickedMarkerRef.current) {
                marker.openPopup();
                userClickedMarkerRef.current = false;
                return;
            }

            const map = mapInstance.current;
            const L = window.L;

            // Force layout update
            map.invalidateSize();

            const flyToPoint = () => {
                const isMobile = window.innerWidth < 768;
                const zoomLevel = isMobile ? 6 : 8;

                const pointLatLng = L.latLng(point.lat, point.lng);

                // Calculate offset at target zoom level
                const targetPoint = map.project(pointLatLng, zoomLevel);
                const offsetY = isMobile ? map.getSize().y * 0.2 : map.getSize().y * 0.1;

                // Move center down by subtracting from Y (pixels start from top)
                const newCenter = map.unproject(targetPoint.subtract([0, offsetY]), zoomLevel);

                map.flyTo(newCenter, zoomLevel, {
                    duration: 1,
                    easeLinearity: 0.25
                });

                marker.openPopup();
            };

            // Increased timeout to ensure container is stable
            const timer = setTimeout(flyToPoint, 100);
            return () => clearTimeout(timer);
        }
    }, [activeId, trip]);


    return (
        <div className="flex-1 relative bg-slate-100 p-4 h-full flex flex-col">
            <div className="flex-1 rounded-3xl overflow-hidden relative shadow-lg">
                <div ref={mapRef} className="w-full h-full z-10" />

            </div>

            {/* Transport Legend */}
            <div className="mt-3 bg-white rounded-xl shadow-sm p-2 px-3 flex flex-wrap gap-3 items-center justify-center">
                {usedModes.map(mode => {
                    const style = ROUTE_STYLES[mode];
                    if (!style) return null;

                    const Icon = style.icon;

                    return (
                        <div key={mode} className="flex items-center gap-2 text-xs text-slate-600" title={style.label || mode}>
                            {Icon && <Icon size={16} style={{ color: style.color }} />}
                            {!Icon && (
                                <div
                                    className="w-6 h-0.5"
                                    style={{
                                        backgroundColor: style.color,
                                        opacity: style.opacity,
                                        borderStyle: style.dashArray ? 'dashed' : 'solid'
                                    }}
                                />
                            )}
                            <span className="hidden sm:inline">{style.label || mode}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


const createPopupContent = (point, img, onOpenDetail) => {
    const isMobile = window.innerWidth < 768;
    const popupDiv = document.createElement('div');

    const width = isMobile ? '140px' : '160px';
    const imageHeight = isMobile ? '50px' : '70px';
    const titleSize = isMobile ? '11px' : '12px';
    const descSize = isMobile ? '10px' : '11px';
    const dateSize = isMobile ? '9px' : '10px';
    const buttonPadding = isMobile ? '4px 8px' : '6px 12px';
    const buttonSize = isMobile ? '10px' : '11px';

    popupDiv.style.cssText = `width:${width}; font-family:ui-sans-serif,system-ui,sans-serif; padding:2px;`;

    const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;

    popupDiv.innerHTML = `
        ${img ? `<img src="${img}" style="width:100%; height:${imageHeight}; object-fit:cover; border-radius:8px; margin-bottom:6px;"/>` : ''}
        <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="font-size:${titleSize}; font-weight:800;">${point.title}</strong>
            
            <div style="display:flex; align-items:center; gap:4px; font-size:${dateSize}; color:#94a3b8;">
                ${calendarIcon}
                <span>${point.date || 'No date'}</span>
            </div>
            
            <p style="margin:4px 0 0; font-size:${descSize}; line-height:1.2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${point.desc}
            </p>
            
            <button 
                id="detail-btn-${point.id}"
                style="margin-top:6px; padding:${buttonPadding}; background:#f97316; color:white; border:none; border-radius:6px; font-size:${buttonSize}; font-weight:600; width:100%; cursor:pointer;"
            >
                Details
            </button>
        </div>`;

    setTimeout(() => {
        const btn = popupDiv.querySelector(`#detail-btn-${point.id}`);
        if (btn) btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onOpenDetail(point.id);
        });
    }, 0);

    return popupDiv;
};