import { apiService } from '../services/apiService';

export const dataTransformer = {
    pointToStop(point) {
        return {
            id: point.id,
            title: point.name,
            date: point.date || '',
            desc: point.shortDescription,
            lat: point.lat,
            lng: point.lon,
            image: apiService.getImageUrl(point.titleImagePath),
            otherImages: point.otherImagePaths?.map(path => apiService.getImageUrl(path)) || [],
            description: point.description,
            tripOrder: point.tripOrder
        };
    },

    tripToRoute(trip) {
        return {
            startId: trip.pointId1,
            goalId: trip.pointId2,
            method: this.normalizeMethod(trip.method)
        };
    },

    normalizeMethod(method) {
        const methodMap = {
            'boat': 'ship',
            'car': 'car',
            'bus': 'bus',
            'rv': 'car',
            'plane': 'plane',
            'foot': 'car',
            'misc': 'car'
        };
        return methodMap[method] || 'car';
    }
};