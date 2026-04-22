import { apiService } from "../controller/apiService.js";
import { Point } from "./Point.js";
import { haversineDistance } from "./geo.js";

export class Trip {
  /** Map<slug, Trip> — multi-tenant safe singleton-per-slug. */
  static #instances = new Map();

  constructor(slug, pointsData, routesData, password) {
    this.slug = slug;
    this.password = password;

    // Tombstones (deletedAt set) are preserved in storage for cross-device
    // sync but must not render on the site.
    const livePoints = pointsData.filter(p => !p.deletedAt);
    const liveRoutes = routesData.filter(r => !r.deletedAt);

    this.points = livePoints
      .map(p => new Point(p, slug, password))
      .sort((a, b) => a.order - b.order);

    this.routes = liveRoutes.map(r => ({
      from: r.pointId1,
      to: r.pointId2,
      mode: r.method,
    }));
  }

  static async getInstance(slug, password) {
    const cached = this.#instances.get(slug);
    if (cached) return cached;
    const [p, r] = await Promise.all([
      apiService.fetchJson(slug, 'points.json', password),
      apiService.fetchJson(slug, 'trips.json', password),
    ]);
    const trip = new Trip(slug, p, r, password);
    this.#instances.set(slug, trip);
    return trip;
  }

  static destroyInstance(slug) {
    if (slug == null) {
      Trip.#instances.clear();
    } else {
      Trip.#instances.delete(slug);
    }
  }

  getPoint(id) {
    return this.points.find(p => p.id === id);
  }

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
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    return `${formatDate(start)} - ${formatDate(end)}`;
  }

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

  getRouteBetween(fromId, toId) {
    return this.routes.find(r =>
      (r.from === fromId && r.to === toId) ||
      (r.from === toId && r.to === fromId)
    );
  }

  getDistanceBetween(fromId, toId) {
    const p1 = this.getPoint(fromId);
    const p2 = this.getPoint(toId);
    if (!p1?.lat || !p2?.lat) return null;
    return Math.round(haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng));
  }
}
