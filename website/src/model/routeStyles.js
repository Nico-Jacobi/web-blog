import { Car, Plane, Bus, Ship, Footprints, Caravan, Compass } from 'lucide-react';

export const ROUTE_STYLES = {
    car: {
        color: '#EF4444',
        weight: 3,
        opacity: 0.85,
        lineCap: 'round',
        labelKey: 'travel.car',
        icon: Car
    },

    rv: {
        color: '#16A34A',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        labelKey: 'travel.rv',
        icon: Caravan
    },

    bus: {
        color: '#7C3AED',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        labelKey: 'travel.bus',
        icon: Bus
    },

    foot: {
        color: '#6B7280',
        weight: 2,
        opacity: 0.65,
        lineCap: 'round',
        dashArray: '2,6',
        labelKey: 'travel.foot',
        icon: Footprints
    },

    boat: {
        color: '#0369A1',
        weight: 2.5,
        opacity: 0.8,
        lineCap: 'round',
        dashArray: '5,7',
        labelKey: 'travel.boat',
        icon: Ship
    },

    plane: {
        color: '#22D3EE',
        weight: 3.5,
        opacity: 0.85,
        lineCap: 'round',
        dashArray: '8,6',
        labelKey: 'travel.plane',
        icon: Plane
    },

    misc: {
        color: '#9CA3AF',
        weight: 2,
        opacity: 0.6,
        lineCap: 'round',
        labelKey: 'travel.misc',
        icon: Compass
    }
};
