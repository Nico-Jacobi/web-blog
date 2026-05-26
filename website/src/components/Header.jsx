import React from 'react';
import { Map, Calendar, Route, RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '../controller/usePullToRefresh.js';
import SettingsPanel from './SettingsPanel';
import { useSettings } from '../context/SettingsContext';

export default function Header({ trip, onMapToggle, titleMain, titleAccent }) {
    const { t, locale } = useSettings();
    const dateRange = trip?.getDateRange() || '';
    const totalDistance = trip?.getTotalDistance();
    const { pullDistance, refreshing, pullProgress, touchHandlers } = usePullToRefresh();

    return (
        <header
            className="bg-white dark:bg-slate-900 border-b border-orange-100 dark:border-slate-700 shadow-sm shrink-0 select-none"
            onTouchStart={touchHandlers.onTouchStart}
            onTouchMove={touchHandlers.onTouchMove}
            onTouchEnd={touchHandlers.onTouchEnd}
        >
            <div className="h-16 sm:h-20 flex items-center justify-between px-3 sm:px-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button onClick={onMapToggle} className="lg:hidden flex bg-orange-600 text-white p-1.5 sm:p-2.5 rounded-lg sm:rounded-2xl shadow-orange-200 shadow-lg shrink-0 cursor-pointer">
                    <Map className="w-4 h-4 sm:w-6 sm:h-6" />
                </button>
                <div className="hidden lg:flex bg-orange-600 text-white p-2.5 rounded-2xl shadow-orange-200 shadow-lg shrink-0">
                    <Map className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                    <h1
                        className="font-black text-sm sm:text-xl lg:text-2xl tracking-tight text-slate-900 dark:text-white truncate cursor-default select-none"
                    >
                        {titleMain || "Jennys & Leons"}{titleAccent && <> <span className="text-orange-600">{titleAccent}</span></>}
                    </h1>
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1">
                        <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-3 h-3 sm:w-3 sm:h-3" />
                            <span>{dateRange || "Nov '25 - Jan '26"}</span>
                        </span>
                        {totalDistance && (
                            <>
                                <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"></span>
                                <span className="flex items-center gap-1 shrink-0">
                                    <Route className="w-3 h-3 sm:w-3 sm:h-3" />
                                    {totalDistance.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB')} km
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <SettingsPanel />
            </div>
            </div>

            <div
                className="overflow-hidden flex flex-col items-center justify-center"
                style={{
                    height: refreshing ? 48 : pullDistance > 0 ? pullDistance * 0.5 : 0,
                    transition: pullDistance === 0 || refreshing ? 'height 0.3s ease-out' : 'none',
                }}
            >
                <RefreshCw
                    className="text-orange-500"
                    style={{
                        width: 22,
                        height: 22,
                        opacity: refreshing ? 1 : pullProgress,
                        transform: refreshing ? undefined : `rotate(${pullProgress * 360}deg)`,
                        transition: pullDistance === 0 ? 'all 0.25s ease-out' : 'none',
                        animation: refreshing ? 'spin 0.5s linear infinite' : 'none',
                    }}
                />
                {refreshing && (
                    <span className="text-[10px] text-orange-400 font-medium mt-1" style={{ animation: 'pulse-opacity 1s ease-in-out infinite' }}>
                        {t('header.loading')}
                    </span>
                )}
            </div>
        </header>
    );
}
