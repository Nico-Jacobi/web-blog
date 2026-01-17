// Point.js

import {apiService} from "../controller/apiService.js";

export class Point {
    constructor(data) {
        this.id = data.id;
        this.title = data.name || 'Untitled'; // JSON uses "name"
        this.desc = data.shortDescription || '';
        this.description = data.description || '';
        this.date = data.date || '';
        this.lat = parseFloat(data.lat) || 0; // JSON uses "lat"
        this.lng = parseFloat(data.lon) || 0; // JSON uses "lon"
        this.order = data.tripOrder || 0;

        // JSON already includes "assets/images/", apiService handles the rest
        this.imagePath = data.titleImagePath || null;
        this.otherPaths = data.otherImagePaths || [];

        this._titleBlob = null;
        this._otherBlobs = null;
    }

    async getTitleImage() {
        if (this._titleBlob) return this._titleBlob;
        if (!this.imagePath) return null;
        this._titleBlob = await apiService.fetchBlob(this.imagePath);
        return this._titleBlob;
    }

    async getOtherImages() {
        if (this._otherBlobs) return this._otherBlobs;
        const blobs = await Promise.all(
            this.otherPaths.map(path => apiService.fetchBlob(path))
        );
        this._otherBlobs = blobs.filter(b => b !== null);
        return this._otherBlobs;
    }

    cleanup() {
        if (this._titleBlob) URL.revokeObjectURL(this._titleBlob);
        this._otherBlobs?.forEach(b => b && URL.revokeObjectURL(b));
    }
}