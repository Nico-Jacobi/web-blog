import { Car, Plane, Bus, Ship, Footprints, Caravan, Compass, Train, Bike } from 'lucide-react';

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
        color: '#16A34A',
        weight: 3,
        opacity: 0.8,
        lineCap: 'round',
        label: 'Wohnmobil',
        icon: Caravan
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
        weight: 3.5,
        opacity: 0.85,
        lineCap: 'round',
        dashArray: '8,6',
        label: 'Flugzeug',
        icon: Plane
    },

    train: {
        color: '#D97706',
        weight: 3,
        opacity: 0.85,
        lineCap: 'round',
        label: 'Zug',
        icon: Train
    },

    bike: {
        color: '#65A30D',
        weight: 2,
        opacity: 0.8,
        lineCap: 'round',
        dashArray: '4,5',
        label: 'Fahrrad',
        icon: Bike
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

export function applyRouteStyles(overrides) {
    if (!overrides || typeof overrides !== 'object') return;
    for (const [mode, vals] of Object.entries(overrides)) {
        if (!ROUTE_STYLES[mode] || !vals) continue;
        if (typeof vals.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(vals.color)) {
            ROUTE_STYLES[mode].color = vals.color;
        }
        if (typeof vals.weight === 'number' && vals.weight >= 1 && vals.weight <= 8) {
            ROUTE_STYLES[mode].weight = vals.weight;
        }
        if ('dashArray' in vals) {
            ROUTE_STYLES[mode].dashArray = vals.dashArray || undefined;
        }
    }
}
