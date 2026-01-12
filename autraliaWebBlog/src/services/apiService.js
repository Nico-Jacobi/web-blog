const API_BASE = 'https://api.1ej.de';
const READ_TOKEN = btoa('!Australien');

export const apiService = {
    async request(endpoint, options = {}) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'X-Auth-Token': READ_TOKEN,
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return response.json();
    },

    async fetchPoints() {
        const response = await fetch(`${API_BASE}/files/data/points.json`, {
            headers: { 'X-Auth-Token': READ_TOKEN }
        });
        return response.json();
    },

    async fetchTrips() {
        const response = await fetch(`${API_BASE}/files/data/trips.json`, {
            headers: { 'X-Auth-Token': READ_TOKEN }
        });
        return response.json();
    },

    getImageUrl(imagePath) {
        return `${API_BASE}/files/${imagePath}`;
    }
};