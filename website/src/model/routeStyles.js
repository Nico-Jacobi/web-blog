import { Car, Plane, Bus, Ship, Footprints, Truck, Compass } from 'lucide-react';

export const ROUTE_STYLES = {
    car: {
        color: '#EF4444',
        weight: 3,
        opacity: 0.85,
        lineCap: 'round',
        label: 'Auto',
        icon: Car
    },

    rv: {
        color: '#F97316',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        label: 'Wohnmobil',
        icon: Truck
    },

    bus: {
        color: '#7C3AED',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        label: 'Bus',
        icon: Bus
    },

    foot: {
        color: '#6B7280',
        weight: 2,
        opacity: 0.65,
        lineCap: 'round',
        dashArray: '2,6',
        label: 'Zu Fuß',
        icon: Footprints
    },

    boat: {
        color: '#0369A1',
        weight: 2.5,
        opacity: 0.8,
        lineCap: 'round',
        dashArray: '5,7',
        label: 'Boot',
        icon: Ship
    },

    plane: {
        color: '#22D3EE',
        weight: 3.5,     // slightly dominant, not obese
        opacity: 0.85,
        lineCap: 'round',
        dashArray: '8,6',
        label: 'Flugzeug',
        icon: Plane
    },

    misc: {
        color: '#9CA3AF',
        weight: 2,
        opacity: 0.6,
        lineCap: 'round',
        label: 'Sonstige',
        icon: Compass
    }
};
