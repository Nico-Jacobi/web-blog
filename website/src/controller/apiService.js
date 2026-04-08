import exifr from 'exifr';
import { API_BASE } from '../constants.js';

export const apiService = {
    async fetchJson(file, token) {
        const res = await fetch(`${API_BASE}/files/data/${file}`, {
            headers: { 'X-Auth-Token': btoa(token) }
        });
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
    },

    async fetchBlob(path, token) {
        const clean = path.startsWith('/') ? path.slice(1) : path;
        const url = `${API_BASE}/files/images/${clean}`;
        try {
            // cache: 'no-cache' revalidates with the server every time, so a previously
            // cached 404 won't keep masking an image that exists now.
            const res = await fetch(url, {
                headers: { 'X-Auth-Token': btoa(token) },
                cache: 'no-cache'
            });
            if (res.ok) return URL.createObjectURL(await res.blob());
        } catch (e) { /* network error */ }
        return null;
    },

    async fetchImageGps(path, token) {
        const clean = path.startsWith('/') ? path.slice(1) : path;
        const res = await fetch(`${API_BASE}/files/images/${clean}`, {
            headers: { 'X-Auth-Token': btoa(token) },
            cache: 'no-cache'
        });
        if (!res.ok) return null;
        try {
            const blob = await res.blob();
            const gps = await exifr.gps(blob);
            if (gps?.latitude && gps?.longitude) {
                return {
                    lat: gps.latitude,
                    lng: gps.longitude,
                    blobUrl: URL.createObjectURL(blob)
                };
            }
        } catch (e) { /* no EXIF data */ }
        return null;
    }
};