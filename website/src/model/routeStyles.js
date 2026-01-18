import { Car, Plane, Bus, Ship, Footprints, Truck } from 'lucide-react';

export const ROUTE_STYLES = {
    car:   { color: '#F97316', weight: 4, opacity: 0.8, label: 'Auto', icon: Car },
    rv:    { color: '#F59E0B', weight: 4, opacity: 0.8, dashArray: '10, 5', label: 'Wohnmobil', icon: Truck },
    bus:   { color: '#A855F7', weight: 3, opacity: 0.7, label: 'Bus', icon: Bus },
    boat:  { color: '#3B82F6', weight: 2, opacity: 0.7, dashArray: '5, 5', label: 'Boot', icon: Ship },
    ship:  { color: '#3B82F6', weight: 2, opacity: 0.7, dashArray: '5, 5', label: 'Schiff', icon: Ship },
    plane: { color: '#22C55E', weight: 2, opacity: 0.6, dashArray: '10, 10', label: 'Flugzeug', icon: Plane },
    foot:  { color: '#64748B', weight: 2, opacity: 0.5, dashArray: '2, 4', label: 'Zu Fuß', icon: Footprints },
    misc:  { color: '#94A3B8', weight: 2, opacity: 0.5, label: 'Sonstige' }
};