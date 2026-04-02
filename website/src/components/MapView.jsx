import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Legend from "./Legend.jsx";
import { createPopupContent, drawRoutes, addImageGpsMarkers, buildMarkerHtml } from './mapHelpers.js';

const MapView = forwardRef(({ activeId, flyToCounter, onOpenDetail, onSelectStop, leafletReady, trip, newPointIds }, ref) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});
    const imageMarkersRef = useRef([]);
    const mapInteractionRef = useRef(false);

    const [containerReady, setContainerReady] = useState(false);
    const usedModes = trip ? [...new Set(trip.routes.map(r => r.mode))] : [];

    useImperativeHandle(ref, () => ({
        closePopup: () => {
            if (mapInstance.current) {
                mapInstance.current.closePopup();
                onSelectStop(null);
            }
        }
    }));

    // Wait until container has actual dimensions before initializing map
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
        const map = L.map(mapRef.current, {
            zoomControl: false
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

        drawRoutes(map, trip);
        addImageGpsMarkers(map, trip, imageMarkersRef);

        // Add point markers
        trip.points.forEach(point => {
            if (!point.lat || !point.lng) return;

            const marker = L.marker([point.lat, point.lng], {
                zIndexOffset: 1000,
                icon: L.divIcon({
                    className: 'custom-marker',
                    html: buildMarkerHtml(newPointIds.has(point.id)),
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                })
            }).addTo(map);

            marker.on('click', () => { mapInteractionRef.current = true; });
            marker.on('mouseover', function () {
                mapInteractionRef.current = true;
                this.openPopup();
            });
            marker.on('popupopen', () => { onSelectStop(point.id); });

            marker.bindPopup(createPopupContent(point, null, onOpenDetail), {
                closeButton: false,
                className: 'modern-popup',
                autoPan: false
            });

            point.getTitleImage().then(img => {
                marker.setPopupContent(createPopupContent(point, img, onOpenDetail));
            });

            markersRef.current[point.id] = marker;
        });

        map.on('click', (e) => {
            const maxPx = 60;

            // Check stop points first (they take priority)
            let closestStop = null;
            let closestStopDist = Infinity;
            trip.points.forEach(point => {
                if (!point.lat || !point.lng) return;
                const px = map.latLngToContainerPoint([point.lat, point.lng]);
                const dist = px.distanceTo(e.containerPoint);
                if (dist < closestStopDist) {
                    closestStopDist = dist;
                    closestStop = point;
                }
            });

            if (closestStop && closestStopDist <= maxPx) {
                mapInteractionRef.current = true;
                const marker = markersRef.current[closestStop.id];
                if (marker) {
                    const popup = marker.getPopup();
                    if (popup) popup.options.autoPan = true;
                    marker.openPopup();
                    if (popup) popup.options.autoPan = false;
                }
                onSelectStop(closestStop.id);
                return;
            }

            // Then check image points
            let closestImg = null;
            let closestImgDist = Infinity;
            imageMarkersRef.current.forEach(marker => {
                const px = map.latLngToContainerPoint(marker.getLatLng());
                const dist = px.distanceTo(e.containerPoint);
                if (dist < closestImgDist) {
                    closestImgDist = dist;
                    closestImg = marker;
                }
            });

            if (closestImg && closestImgDist <= maxPx) {
                const imgPopup = closestImg.getPopup();
                if (imgPopup) imgPopup.options.autoPan = true;
                closestImg.openPopup();
                if (imgPopup) imgPopup.options.autoPan = false;
                return;
            }

            onSelectStop(null);
        });

        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [leafletReady, containerReady, trip, onOpenDetail, onSelectStop]);

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

                map.once('moveend', () => marker.openPopup());
                map.flyTo(newCenter, zoomLevel, { duration: 1, easeLinearity: 0.25 });
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [activeId, flyToCounter, trip]);

    return (
        <div className="flex flex-col h-full bg-slate-100 p-2 sm:p-4 gap-2 sm:gap-3">
            <div className="flex-1 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-lg">
                <div ref={mapRef} className="w-full h-full z-10" />
            </div>
            <div className="shrink-0">
                <Legend usedModes={usedModes} />
            </div>
        </div>
    );
});

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
