import { imageUrl, thumbUrl } from "../controller/apiService.js";

export class Point {
  constructor(data, slug, password) {
    this.slug = slug;
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
    const parts = this.date.match(/(\d+)\/(\d+)\/(\d+)/);
    if (!parts) return null;
    const day = parseInt(parts[1]);
    const month = parseInt(parts[2]) - 1;
    const year = parseInt(parts[3]);
    return new Date(year, month, day);
  }

  get titleImageUrl() {
    return this.imagePath ? imageUrl(this.slug, this.imagePath) : null;
  }

  get titleThumbUrl() {
    return this.imagePath ? thumbUrl(this.slug, this.imagePath) : null;
  }

  get otherImageUrls() {
    return this.otherPaths.map(p => imageUrl(this.slug, p));
  }

  get otherThumbUrls() {
    return this.otherPaths.map(p => thumbUrl(this.slug, p));
  }
}
