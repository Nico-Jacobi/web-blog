import React, { useRef, useEffect } from 'react';
import StopCard from './StopCard';
import RouteSegment from './RouteSegment';
import { collapseWaypoints } from '../model/waypointCollapse.js';
import { useTranslation } from 'react-i18next';

export default function Sidebar({ activeId, onSelectStop, onOpenDetail, trip, newPointIds }) {
    const { t } = useTranslation();
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
            .filter(p => !p.isWaypoint)
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
        <aside className="w-full lg:w-80 xl:w-96 flex flex-col border-r border-orange-100 bg-white h-full">
            {/* Sidebar Header */}
            <div className="pt-8 pb-4 px-6 shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {t('sidebar.heading')}
                    </h2>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {trip.points.filter(p => !p.isWaypoint).length} {t('sidebar.stops')}
                    </span>
                </div>
                <div className="h-1 w-8 bg-orange-500 mt-2 rounded-full" />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6">
                {(() => {
                    const items = collapseWaypoints(trip.points, trip);
                    // Index der normalen Stops für Priority + fromEnd-Berechnung
                    const normalStops = trip.points.filter(p => !p.isWaypoint);
                    const stopIndexById = new Map(normalStops.map((p, i) => [p.id, i]));

                    return items.map((item, idx) => {
                        if (item.type === 'segments') {
                            return <RouteSegment key={`seg-${idx}`} badges={item.badges} />;
                        }
                        // type === 'stop'
                        const point = item.point;
                        const stopIndex = stopIndexById.get(point.id);
                        const fromEnd = normalStops.length - 1 - stopIndex;
                        const priority = fromEnd < 5 ? 'high' : fromEnd < 15 ? 'auto' : 'low';
                        const isFirstNew = !foundFirstNew && newPointIds.has(point.id);
                        if (isFirstNew) foundFirstNew = true;

                        return (
                            <div key={point.id} ref={isFirstNew ? firstNewRef : null}>
                                <StopCard
                                    point={point}
                                    isActive={activeId === point.id}
                                    isNew={newPointIds.has(point.id)}
                                    priority={priority}
                                    onInfoClick={() => onOpenDetail(point.id)}
                                    onMapClick={() => onSelectStop(point.id)}
                                />
                            </div>
                        );
                    });
                })()}
            </div>
        </aside>
    );
}
