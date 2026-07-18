import React, { useRef, useEffect } from 'react';
import StopCard from './StopCard';
import RouteSegment from './RouteSegment';
import { useSettings } from '../context/SettingsContext';

export default function Sidebar({ activeId, onSelectStop, onOpenDetail, trip, newPointIds }) {
    const { t } = useSettings();
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

    // Preload sidebar thumbnails newest→oldest so older stops are warm in the
    // browser cache by the time the user scrolls up to them.
    useEffect(() => {
        if (!trip?.points) return;
        const urls = trip.points
            .map(p => p.titleThumbUrl)
            .filter(Boolean)
            .reverse();

        let cancelled = false;
        let cursor = 0;
        const PARALLEL = 3;

        const loadNext = () => {
            if (cancelled) return;
            const i = cursor++;
            if (i >= urls.length) return;
            const img = new Image();
            img.onload = img.onerror = loadNext;
            img.src = urls[i];
        };

        for (let i = 0; i < PARALLEL; i++) loadNext();

        return () => { cancelled = true; };
    }, [trip]);

    if (!trip) return null;

    let foundFirstNew = false;

    return (
        <aside className="w-full lg:w-96 xl:w-[28rem] flex flex-col bg-white dark:bg-slate-900 h-full">
            {/* Sidebar Header */}
            <div className="pt-5 pb-4 px-6 shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {t('sidebar.journey')}
                    </h2>
                    <span className="stops-badge text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {trip.points.length} {t('sidebar.stops')}
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