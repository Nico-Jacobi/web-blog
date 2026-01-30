import {apiService} from "../controller/apiService.js";

export class Point {
    constructor(data, password) {

        this.password = password; // Store it here

        this.id = data.id;
        this.title = data.name || 'Untitled';
        this.desc = data.shortDescription || '';
        this.description = data.description || '';
        this.date = data.date || '';
        this.lat = parseFloat(data.lat) || 0;
        this.lng = parseFloat(data.lon) || 0;
        this.order = data.tripOrder +1 || 0;

        this.imagePath = data.titleImagePath || null;
        this.otherPaths = data.otherImagePaths || [];

        this._titleBlob = null;
        this._otherBlobs = null;
    }

    // NEW: Parse date string to Date object
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

    async getTitleImage() {
        if (this._titleBlob) return this._titleBlob;
        if (!this.imagePath) return null;
        // ADDED: this.password
        this._titleBlob = await apiService.fetchBlob(this.imagePath, this.password);
        return this._titleBlob;
    }

    async getOtherImages() {
        if (this._otherBlobs) return this._otherBlobs;
        const blobs = await Promise.all(
            // ADDED: this.password
            this.otherPaths.map(path => apiService.fetchBlob(path, this.password))
        );
        this._otherBlobs = blobs.filter(b => b !== null);
        return this._otherBlobs;
    }

    cleanup() {
        if (this._titleBlob) URL.revokeObjectURL(this._titleBlob);
        this._otherBlobs?.forEach(b => b && URL.revokeObjectURL(b));
    }
}