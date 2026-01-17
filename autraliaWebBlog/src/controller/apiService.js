const API_BASE = 'https://api.1ej.de';
const AUTH = btoa('!Australien');

export const apiService = {
    async fetchJson(file) {
        const res = await fetch(`${API_BASE}/files/data/${file}`, {
            headers: { 'X-Auth-Token': AUTH }
        });
        return res.json();
    },

    async fetchBlob(path) {
        const clean = path.startsWith('/') ? path.slice(1) : path;
        const res = await fetch(`${API_BASE}/files/images/${clean}`, {
            headers: { 'X-Auth-Token': AUTH }
        });
        return res.ok ? URL.createObjectURL(await res.blob()) : null;
    }
};