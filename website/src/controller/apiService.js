const API_BASE = 'https://api.1ej.de';

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
        const res = await fetch(`${API_BASE}/files/images/${clean}`, {
            headers: { 'X-Auth-Token': btoa(token) }
        });
        return res.ok ? URL.createObjectURL(await res.blob()) : null;
    }
};