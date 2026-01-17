import React from 'react';
import { Navigation } from 'lucide-react';
import StopCard from './StopCard';
import RouteSegment from './RouteSegment';

export default function Sidebar({ activeId, onSelectStop, trip }) {
    if (!trip) return null;

    return (
        <aside className="w-full md:w-96 flex flex-col border-r border-orange-100 bg-white shrink-0 h-full">
            <div className="p-6 shrink-0">
                <h1 className="text-3xl font-black text-slate-900">{trip.title}</h1>
                <p className="text-slate-400 mt-2 text-sm flex items-center gap-2">
                    <Navigation size={14} className="text-orange-500" />
                    Australien Roadtrip 2025
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
                {trip.points.map((point, index) => (
                    <React.Fragment key={point.id}>
                        <StopCard
                            point={point}
                            isActive={activeId === point.id}
                            onClick={() => onSelectStop(point.id)}
                        />

                        {/* Show route segment between this point and the next */}
                        {index < trip.points.length - 1 && (
                            <RouteSegment
                                trip={trip}
                                fromPoint={point}
                                toPoint={trip.points[index + 1]}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </aside>
    );
}