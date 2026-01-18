import React from 'react';
import { Map, Calendar, Route } from 'lucide-react';
import kangarooIcon from '../../kangaroo.svg';

export default function Header({ trip }) {
    const dateRange = trip?.getDateRange() || 'Nov 2025 - Jan 2026';
    const totalDistance = trip?.getTotalDistance();

    return (
        /* Reduced height and padding for mobile */
        <header className="h-16 sm:h-20 bg-white border-b border-orange-100 flex items-center justify-between px-3 sm:px-8 shadow-sm shrink-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                {/* Hide map icon on mobile */}
                <div className="hidden sm:flex bg-orange-600 text-white p-2 sm:p-2.5 rounded-2xl shadow-orange-200 shadow-lg shrink-0">
                    <Map size={20} className="sm:w-6 sm:h-6" />
                </div>

                <div className="min-w-0">
                    {/* Smaller font size on mobile */}
                    <h1 className="font-black text-sm sm:text-xl lg:text-2xl tracking-tight text-slate-900 truncate">
                        Jennys und Leons <span className="text-orange-600">Australien Trip</span>
                    </h1>
                    <div className="flex items-center gap-2 sm:gap-3 text-slate-400 text-[9px] sm:text-xs font-medium mt-0.5">
                        <span className="flex items-center gap-1 shrink-0">
                            <Calendar size={10} className="sm:w-3 sm:h-3" />
                            <span className="hidden xs:inline">{dateRange}</span>
                            <span className="xs:hidden">Nov '25 - Jan '26</span>
                        </span>
                        {totalDistance && (
                            <>
                                <span className="w-1 h-1 bg-slate-200 rounded-full shrink-0"></span>
                                <span className="flex items-center gap-1 shrink-0">
                                    <Route size={10} className="sm:w-3 sm:h-3" />
                                    {totalDistance.toLocaleString('de-DE')} km
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Hide kangaroo avatar on mobile */}
            <div className="hidden sm:block h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-orange-100 p-0.5 shrink-0">
                <div className="w-full h-full rounded-full bg-orange-50 flex items-center justify-center overflow-hidden">
                    <img src={kangarooIcon} alt="Kangaroo" className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
            </div>
        </header>
    );
}