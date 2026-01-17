import { apiService } from "../controller/apiService.js";
import { Point } from "./Point.js";

export class Trip {
    static #instance = null;

    constructor(pointsData, routesData) {
        this.points = pointsData.map(p => new Point(p)).sort((a, b) => a.order - b.order);

        this.routes = routesData.map(r => ({
            from: r.pointId1,
            to: r.pointId2,
            mode: r.method
        }));
    }

    static async getInstance() {
        if (!this.#instance) {
            const [p, r] = await Promise.all([
                apiService.fetchJson('points.json'),
                apiService.fetchJson('trips.json')
            ]);
            this.#instance = new Trip(p, r);
        }
        return this.#instance;
    }

    getPoint(id) {
        return this.points.find(p => p.id === id);
    }

    destroy() {
        this.points.forEach(p => p.cleanup());
        Trip.#instance = null;
    }
}