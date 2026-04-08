import React, { useRef, useEffect } from 'react';
import StopCard from './StopCard';
import RouteSegment from './RouteSegment';

export default function Sidebar({ activeId, onSelectStop, onOpenDetail, trip, newPointIds }) {
    const firstNewRef = useRef(null);
    const scrollRef = useRef(null);

    // Scroll to first new point on mount
    useEffect(() => {
        if (firstNewRef.current && scrollRef.current) {
            const container = scrollRef.current;
            const element = firstNewRef.current;
            const offset = element.offsetTop - container.offsetTop - 16;
            container.scrollTo({ top: offset, behavior: 'smooth' });
        }
    }, [trip, newPointIds]);

    if (!trip) return null;

    let foundFirstNew = false;

    return (
        <aside className="w-full lg:w-80 xl:w-96 flex flex-col border-r border-orange-100 bg-white h-full">
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

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6">
                {trip.points.map((point, index) => {
                    const isFirstNew = !foundFirstNew && newPointIds.has(point.id);
                    if (isFirstNew) foundFirstNew = true;

                    // Load images newest→oldest: newest 5 get high priority,
                    // since the sidebar auto-scrolls to the newest point.
                    const fromEnd = trip.points.length - 1 - index;
                    const priority = fromEnd < 5 ? 'high' : fromEnd < 15 ? 'auto' : 'low';

                    return (
                        <React.Fragment key={point.id}>
                            <div ref={isFirstNew ? firstNewRef : null}>
                                <StopCard
                                    point={point}
                                    isActive={activeId === point.id}
                                    isNew={newPointIds.has(point.id)}
                                    priority={priority}
                                    onInfoClick={() => onOpenDetail(point.id)}
                                    onMapClick={() => onSelectStop(point.id)}
                                />
                            </div>

                            {index < trip.points.length - 1 && (
                                <RouteSegment
                                    trip={trip}
                                    fromPoint={point}
                                    toPoint={trip.points[index + 1]}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </aside>
    );
}