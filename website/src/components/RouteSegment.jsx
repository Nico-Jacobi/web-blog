import React from 'react';
import { MoveRight } from 'lucide-react';
import { ROUTE_STYLES } from '../model/routeStyles';

/**
 * Renders a sequence of route badges (mode + distance), separated by short dashes.
 * Used for both single segments (legacy: between two stops) and collapsed segments
 * (between two stops with intermediate waypoints).
 */
export default function RouteSegment({ badges }) {
    if (!badges || badges.length === 0) return null;

    return (
        <div className="flex flex-col gap-1">
            {badges.map((badge, idx) => {
                const style = ROUTE_STYLES[badge.mode] || ROUTE_STYLES.misc;
                const Icon = style.icon || MoveRight;
                const distanceLabel = badge.distance < 1
                    ? `${Math.round(badge.distance * 1000).toLocaleString('de-DE')} m`
                    : `${badge.distance.toLocaleString('de-DE')} km`;

                return (
                    <div key={idx} className="flex items-center gap-3 py-1 px-2 my-0">
                        <div className="flex flex-col items-center gap-1 ml-9">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-0.5 h-1.5"
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
                            <span>{distanceLabel}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
