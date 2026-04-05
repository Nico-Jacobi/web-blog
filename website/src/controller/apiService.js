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
        const headers = { 'X-Auth-Token': btoa(token) };
        try {
            const res = await fetch(url, { headers });
            if (res.ok) return URL.createObjectURL(await res.blob());
            if (res.status === 404) {
                const retry = await fetch(url, { headers, cache: 'reload' });
                if (retry.ok) return URL.createObjectURL(await retry.blob());
            }
        } catch (e) { /* network error */ }
        return null;
    },

    async fetchImageGps(path, token) {
        const clean = path.startsWith('/') ? path.slice(1) : path;
        const res = await fetch(`${API_BASE}/files/images/${clean}`, {
            headers: { 'X-Auth-Token': btoa(token) }
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