import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Legend from './Legend.jsx';
import { createPopupContent, drawRoutes, addImageGpsMarkers, buildMarkerHtml, buildWaypointMarkerHtml, findClosestMarker } from './mapHelpers.js';

const MapView = forwardRef(({ activeId, flyToCounter, onOpenDetail, onSelectStop, leafletReady, trip, newPointIds, meta }, ref) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const imageMarkersRef = useRef([]);
    const mapInteractionRef = useRef(false);

    const [containerReady, setContainerReady] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const isGpsMode = meta?.settings?.pathMode === 'gps';
    const usedModes = (!isGpsMode && trip) ? [...new Set(trip.routes.map(r => r.mode))] : [];

    useImperativeHandle(ref, () => ({
        closePopup: () => {
            if (mapInstance.current) {
                mapInstance.current.closePopup();
                onSelectStop(null);
            }
        }
    }));

    // Wait until container has actual dimensions
    useEffect(() => {
        const el = mapRef.current;
        if (!el) return;
        if (el.offsetWidth && el.offsetHeight) {
            setContainerReady(true);
            return;
        }
        const obs = new ResizeObserver(() => {
            if (el.offsetWidth && el.offsetHeight) {
                setContainerReady(true);
                obs.disconnect();
            }
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    // Initialize map, markers, and routes
    useEffect(() => {
        if (!leafletReady || !containerReady || !mapRef.current || mapInstance.current || !trip) return;

        const L = window.L;
        const map = L.map(mapRef.current, { zoomControl: false, doubleClickZoom: false, closePopupOnClick: false });

        let lastClickTime = 0;
        map.on('click', (e) => {
            const now = Date.now();
            if (now - lastClickTime < 200) {
                map.zoomIn(1, { animate: true });
            }
            lastClickTime = now;
        });

        const initialBounds = calculateBounds(L, trip.points.filter(p => p.lat && p.lng));
        if (initialBounds?.isValid()) {
            map.fitBounds(initialBounds, { padding: [40, 40], maxZoom: 10 });
        } else {
            map.setView([-25.27, 133.77], 4);
        }
        mapInstance.current = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            updateWhenZooming: true,
            updateWhenIdle: false,
            keepBuffer: 8
        }).addTo(map);

        drawRoutes(map, trip, meta?.settings);
        addImageGpsMarkers(map, trip, imageMarkersRef, (src) => setFullscreenImage(src));
        addPointMarkers(L, map, trip, newPointIds, markersRef, mapInteractionRef, onSelectStop, onOpenDetail);
        setupClickHandler(map, trip, markersRef, imageMarkersRef, mapInteractionRef, activeId, onSelectStop);

        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);
        setMapReady(true);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leafletReady, containerReady, trip]);

    // Fly to active point
    useEffect(() => {
        if (!mapInstance.current || !trip) return;

        if (!activeId) {
            mapInstance.current.closePopup();
            return;
        }

        const marker = markersRef.current[activeId];
        const point = trip?.getPoint(activeId);

        if (marker && point) {
            if (mapInteractionRef.current) {
                mapInteractionRef.current = false;
                return;
            }

            const map = mapInstance.current;
            const L = window.L;
            map.invalidateSize();

            const timer = setTimeout(() => {
                const isMobile = window.innerWidth < 768;
                const zoomLevel = isMobile ? 10 : 12;
                const pointLatLng = L.latLng(point.lat, point.lng);
                const targetPoint = map.project(pointLatLng, zoomLevel);
                const offsetY = isMobile ? map.getSize().y * 0.2 : map.getSize().y * 0.1;
                const newCenter = map.unproject(targetPoint.subtract([0, offsetY]), zoomLevel);

                map.once('moveend', () => {
                    mapInteractionRef.current = true;
                    marker.openPopup();
                });
                map.flyTo(newCenter, zoomLevel, { duration: 1, easeLinearity: 0.25 });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [activeId, flyToCounter, trip, mapReady]);

    return (
        <div className="flex flex-col h-full bg-slate-100 p-2 sm:p-4 gap-2 sm:gap-3">
            <div className="flex-1 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-lg">
                <div ref={mapRef} className="w-full h-full z-10" />
            </div>
            <div className="shrink-0">
                <Legend usedModes={usedModes} />
            </div>
            {fullscreenImage && (
                <div
                    className="fixed inset-0 z-[6000] bg-black/95 backdrop-blur-md flex items-center justify-center"
                    onClick={() => setFullscreenImage(null)}
                >
                    <img
                        src={fullscreenImage}
                        alt="Fullscreen"
                        className="max-w-full max-h-full object-contain select-none"
                        draggable={false}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
});

function addPointMarkers(L, map, trip, newPointIds, markersRef, mapInteractionRef, onSelectStop, onOpenDetail) {
    trip.points.forEach(point => {
        if (!point.lat || !point.lng) return;

        if (point.isWaypoint) {
            // Small grey marker — no popup, no handler, not in markersRef
            L.marker([point.lat, point.lng], {
                zIndexOffset: 500,
                interactive: false,
                icon: L.divIcon({
                    className: 'waypoint-marker',
                    html: buildWaypointMarkerHtml(),
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                })
            }).addTo(map);
            return;
        }

        const marker = L.marker([point.lat, point.lng], {
            zIndexOffset: 1000,
            icon: L.divIcon({
                className: 'custom-marker',
                html: buildMarkerHtml(newPointIds.has(point.id)),
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            })
        }).addTo(map);

        marker.on('click', (e) => {
            mapInteractionRef.current = true;
            L.DomEvent.stopPropagation(e);
        });
        marker.on('mouseover', function () {
            mapInteractionRef.current = true;
            this.openPopup();
        });
        marker.on('popupopen', () => { onSelectStop(point.id); });

        marker.bindPopup(createPopupContent(point, point.titleThumbUrl, onOpenDetail), {
            closeButton: false,
            className: 'modern-popup',
            autoPan: false
        });

        markersRef.current[point.id] = marker;
    });
}

function setupClickHandler(map, trip, markersRef, imageMarkersRef, mapInteractionRef, activeId, onSelectStop) {
    map.on('click', (e) => {
        const hit = findClosestMarker(map, e.containerPoint, trip, markersRef, imageMarkersRef);

        if (hit?.type === 'stop') {
            const marker = markersRef.current[hit.target.id];
            if (marker) {
                if (marker.isPopupOpen()) {
                    marker.closePopup();
                    onSelectStop(null);
                    return;
                }
                mapInteractionRef.current = true;
                const popup = marker.getPopup();
                if (popup) popup.options.autoPan = true;
                marker.openPopup();
                if (popup) popup.options.autoPan = false;
                onSelectStop(hit.target.id);
            }
            return;
        }

        if (hit?.type === 'image') {
            hit.target.fire('click');
            return;
        }

        imageMarkersRef.current.forEach(m => {
            if (m._clickOpen) {
                m._clickOpen = false;
                m.closePopup();
            }
        });
        onSelectStop(null);
    });
}

function calculateBounds(L, validPoints) {
    if (validPoints.length > 2) {
        const avgLat = validPoints.reduce((s, p) => s + p.lat, 0) / validPoints.length;
        const avgLng = validPoints.reduce((s, p) => s + p.lng, 0) / validPoints.length;
        const distances = validPoints.map(p =>
            Math.sqrt((p.lat - avgLat) ** 2 + (p.lng - avgLng) ** 2)
        );
        const sorted = [...distances].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const threshold = Math.max(median * 3, 1);
        const corePoints = validPoints.filter((_, i) => distances[i] <= threshold);
        const pts = corePoints.length > 1 ? corePoints : validPoints;
        return L.latLngBounds(pts.map(p => [p.lat, p.lng]));
    } else if (validPoints.length > 0) {
        return L.latLngBounds(validPoints.map(p => [p.lat, p.lng]));
    }
    return null;
}

export default MapView;
