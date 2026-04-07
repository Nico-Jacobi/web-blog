import { ROUTE_STYLES } from '../model/routeStyles.js';
import { fetchAllRoutes } from '../controller/routingService.js';
import { apiService } from '../controller/apiService.js';

export function createPopupContent(point, img, onOpenDetail) {
    const popupDiv = document.createElement('div');

    const width = 'clamp(160px, 18vw, 280px)';
    const imageHeight = 'clamp(70px, 10vw, 150px)';
    const titleSize = 'clamp(11px, 1.1vw, 15px)';
    const descSize = 'clamp(10px, 0.9vw, 13px)';
    const dateSize = 'clamp(9px, 0.8vw, 12px)';
    const buttonPadding = 'clamp(4px, 0.5vw, 10px) clamp(8px, 1vw, 16px)';
    const buttonSize = 'clamp(10px, 0.9vw, 13px)';

    const calendarIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`;

    popupDiv.style.cssText = `width:${width}; font-family:ui-sans-serif,system-ui,sans-serif; padding:2px;`;
    popupDiv.innerHTML = `
        ${img ? `<img src="${img}" style="width:100%; height:${imageHeight}; object-fit:cover; border-radius:8px; margin-bottom:6px; display:block;"/>` : `<div style="width:100%; height:${imageHeight}; background:#e2e8f0; border-radius:8px; margin-bottom:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:${descSize};">Loading...</div>`}
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
                style="margin-top:6px; padding:${buttonPadding}; background:transparent; color:#f97316; border:2px solid #fb923c; border-radius:6px; font-size:${buttonSize}; font-weight:600; width:100%; cursor:pointer;"
            >
                Details
            </button>
        </div>`;

    const btn = popupDiv.querySelector(`#detail-btn-${point.id}`);
    if (btn) btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpenDetail(point.id);
    });

    return popupDiv;
}

export function drawRoutes(map, trip) {
    const L = window.L;

    fetchAllRoutes(trip, (index, coords, mode) => {
        const style = ROUTE_STYLES[mode] || ROUTE_STYLES.car;
        L.polyline(coords, { ...style, lineJoin: 'round' }).addTo(map);
    });
}

export const IMAGE_MARKER_MIN_ZOOM = 9;

export function addImageGpsMarkers(map, trip, imageMarkersRef) {
    const L = window.L;

    const updateVisibility = () => {
        const show = map.getZoom() >= IMAGE_MARKER_MIN_ZOOM;
        imageMarkersRef.current.forEach(m => {
            const el = m.getElement();
            if (el) el.style.display = show ? '' : 'none';
        });
    };
    map.on('zoomend', updateVisibility);

    trip.points.forEach(point => {
        const allPaths = [
            ...(point.imagePath ? [point.imagePath] : []),
            ...point.otherPaths
        ];
        allPaths.forEach(path => {
            apiService.fetchImageGps(path, point.password).then(result => {
                if (result && map._container) {
                    const marker = L.circleMarker([result.lat, result.lng], {
                        radius: 4,
                        color: '#F97316',
                        fillColor: '#F97316',
                        fillOpacity: 0.7,
                        weight: 1,
                        bubblingMouseEvents: false
                    }).addTo(map);

                    marker.bindPopup(
                        `<img src="${result.blobUrl}" style="width:25vw; min-width:140px; max-width:300px; height:auto; border-radius:8px; display:block;"/>`,
                        { closeButton: false, className: 'image-gps-popup', maxWidth: 320, autoPan: false }
                    );

                    marker.on('mouseover', function () {
                        if (!this._suppressHover) this.openPopup();
                    });
                    marker.on('mouseout', function () {
                        this._suppressHover = false;
                        if (!this._clickOpen) this.closePopup();
                    });
                    marker.on('click', function () {
                        if (this._clickOpen) {
                            this._clickOpen = false;
                            this._suppressHover = true;
                            this.closePopup();
                        } else {
                            this._clickOpen = true;
                            this.openPopup();
                        }
                    });

                    imageMarkersRef.current.push(marker);
                    const el = marker.getElement();
                    if (el && map.getZoom() < IMAGE_MARKER_MIN_ZOOM) el.style.display = 'none';
                }
            });
        });
    });
}

export function buildMarkerHtml(isNew) {
    const dot = `<div style="background:#F97316; width:18px; height:18px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`;
    if (isNew) {
        return `<div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
                     <div style="position:absolute; width:28px; height:28px; border-radius:50%; border:2px solid #F97316; opacity:0.6; animation:pulse-ring 2s ease-out infinite;"></div>
                     ${dot}
                   </div>`;
    }
    return `<div style="width:36px; height:36px; display:flex; align-items:center; justify-content:center;">${dot}</div>`;
}

/**
 * Finds the closest point or image marker within maxPx of a click.
 * Returns { type: 'stop'|'image', target, distance } or null.
 */
export function findClosestMarker(map, containerPoint, trip, markersRef, imageMarkersRef, maxPx = 80) {
    let closestStop = null;
    let closestStopDist = Infinity;

    trip.points.forEach(point => {
        if (!point.lat || !point.lng) return;
        const px = map.latLngToContainerPoint([point.lat, point.lng]);
        const dist = px.distanceTo(containerPoint);
        if (dist < closestStopDist) {
            closestStopDist = dist;
            closestStop = point;
        }
    });

    let closestImg = null;
    let closestImgDist = Infinity;

    const imagesVisible = map.getZoom() >= IMAGE_MARKER_MIN_ZOOM;
    if (imagesVisible) imageMarkersRef.current.forEach(marker => {
        const px = map.latLngToContainerPoint(marker.getLatLng());
        const dist = px.distanceTo(containerPoint);
        if (dist < closestImgDist) {
            closestImgDist = dist;
            closestImg = marker;
        }
    });

    const hasStop = closestStop && closestStopDist <= maxPx;
    const hasImg = closestImg && closestImgDist <= maxPx;

    if (hasStop && hasImg) {
        return closestStopDist < closestImgDist * 0.5
            ? { type: 'stop', target: closestStop, distance: closestStopDist }
            : { type: 'image', target: closestImg, distance: closestImgDist };
    }
    if (hasStop) return { type: 'stop', target: closestStop, distance: closestStopDist };
    if (hasImg) return { type: 'image', target: closestImg, distance: closestImgDist };

    return null;
}
