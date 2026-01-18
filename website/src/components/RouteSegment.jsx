import React from 'react';
import { MoveRight } from 'lucide-react';
import { ROUTE_STYLES } from '../model/routeStyles';

export default function RouteSegment({ trip, fromPoint, toPoint }) {
    const route = trip.getRouteBetween(fromPoint.id, toPoint.id);
    const distance = trip.getDistanceBetween(fromPoint.id, toPoint.id);

    if (!route || !distance) return null;

    const style = ROUTE_STYLES[route.mode] || ROUTE_STYLES.misc;
    const Icon = style.icon || MoveRight;

    return (
        <div className="flex items-center gap-3 py-1 px-2 my-0"> {/* Reduced py and my */}
            <div className="flex flex-col items-center gap-1 ml-9">
                {[...Array(3)].map((_, i) => (
                    <div
                        key={i}
                        className="w-0.5 h-1.5" /* Slightly shorter dashes */
                        style={{
                            backgroundColor: style.color,
                            opacity: style.opacity * 0.6
                        }}
                    />
                ))}
            </div>

            <div
                className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-lg flex-1"
                style={{
                    backgroundColor: `${style.color}10`,
                    color: style.color
                }}
            >
                <Icon size={14} />
                <span>{distance.toLocaleString('de-DE')} km</span>
            </div>
        </div>
    );
}