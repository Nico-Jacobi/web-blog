import { apiService } from "../controller/apiService.js";
import { Point } from "./Point.js";
import { haversineDistance } from "./geo.js";

export class Trip {
    static #instance = null;

    constructor(pointsData, routesData, password) { // Added password
        this.password = password; // Save for image loading
        this.points = pointsData.map(p => new Point(p, password)).sort((a, b) => a.order - b.order);

        this.routes = routesData.map(r => ({
            from: r.pointId1,
            to: r.pointId2,
            mode: r.method
        }));
    }

    static async getInstance(password) { // Accept password
        if (!this.#instance) {
            const [p, r] = await Promise.all([
                apiService.fetchJson('points.json', password), // Pass password
                apiService.fetchJson('trips.json', password)   // Pass password
            ]);
            this.#instance = new Trip(p, r, password);
        }
        return this.#instance;
    }

    getPoint(id) {
        return this.points.find(p => p.id === id);
    }

    // NEW: Get date range of the trip
    getDateRange() {
        const dates = this.points
            .map(p => p.getParsedDate())
            .filter(d => d !== null)
            .sort((a, b) => a - b);

        if (dates.length === 0) return null;

        const start = dates[0];
        const end = dates[dates.length - 1];

        const formatDate = (date) => {
            const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
            return `${months[date.getMonth()]} ${date.getFullYear()}`; // getMonth() already returns 0-11
        };

        return `${formatDate(start)} - ${formatDate(end)}`;
    }

    // NEW: Calculate total distance using Haversine formula
    getTotalDistance() {
        let total = 0;

        this.routes.forEach(route => {
            const p1 = this.getPoint(route.from);
            const p2 = this.getPoint(route.to);

            if (p1?.lat && p2?.lat) {
                total += haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
            }
        });

        return Math.round(total);
    }

    static destroyInstance() {
        if (Trip.#instance) {
            Trip.#instance.points.forEach(p => p.cleanup());
            Trip.#instance = null;
        }
    }

    getRouteBetween(fromId, toId) {
        return this.routes.find(r =>
            (r.from === fromId && r.to === toId) ||
            (r.from === toId && r.to === fromId)
        );
    }

// NEW: Calculate distance between two points
    getDistanceBetween(fromId, toId) {
        const p1 = this.getPoint(fromId);
        const p2 = this.getPoint(toId);

        if (!p1?.lat || !p2?.lat) return null;

        return Math.round(haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng));
    }
}