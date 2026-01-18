import React from 'react';
import StopCard from './StopCard';
import RouteSegment from './RouteSegment';

export default function Sidebar({ activeId, onSelectStop, trip }) {
    if (!trip) return null;

    return (
        <aside className="w-80 xl:w-96 flex flex-col border-r border-orange-100 bg-white h-full">
            {/* Sidebar Header */}
            <div className="pt-8 pb-4 px-6 shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        Reiseverlauf
                    </h2>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {trip.points.length} Stopps
                    </span>
                </div>
                <div className="h-1 w-8 bg-orange-500 mt-2 rounded-full" />
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
                {trip.points.map((point, index) => (
                    <React.Fragment key={point.id}>
                        <StopCard
                            point={point}
                            isActive={activeId === point.id}
                            onClick={() => onSelectStop(point.id)}
                        />

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