import { imageUrl, thumbUrl } from "../controller/apiService.js";

export class Point {
    constructor(data, password) {
        this.password = password;

        this.id = data.id;
        this.isWaypoint = data.isWaypoint === true;
        this.title = this.isWaypoint ? '' : (data.name || 'Untitled');
        this.desc = data.shortDescription || '';
        this.description = data.description || '';
        this.date = data.date || '';
        this.lat = parseFloat(data.lat) || 0;
        this.lng = parseFloat(data.lon) || 0;
        this.order = (data.tripOrder ?? -1) + 1;

        this.imagePath = data.titleImagePath || null;
        this.otherPaths = data.otherImagePaths || [];
    }

    getParsedDate() {
        if (!this.date) return null;

        // Format: DD/MM/YYYY (e.g., "16/01/2026")
        const parts = this.date.match(/(\d+)\/(\d+)\/(\d+)/);
        if (!parts) return null;

        const day = parseInt(parts[1]);
        const month = parseInt(parts[2]) - 1; // JavaScript months are 0-indexed!
        const year = parseInt(parts[3]);

        return new Date(year, month, day);
    }

    /** Direct URL for the title image (full size), or null if none. */
    get titleImageUrl() {
        return this.imagePath ? imageUrl(this.imagePath) : null;
    }

    /** Thumbnail URL for the title image (small, for cards/lists). */
    get titleThumbUrl() {
        return this.imagePath ? thumbUrl(this.imagePath) : null;
    }

    /** Direct URLs for the gallery images (full size, for lightbox). */
    get otherImageUrls() {
        return this.otherPaths.map(p => imageUrl(p));
    }

    /** Thumbnail URLs for gallery images (for the grid preview). */
    get otherThumbUrls() {
        return this.otherPaths.map(p => thumbUrl(p));
    }
}
