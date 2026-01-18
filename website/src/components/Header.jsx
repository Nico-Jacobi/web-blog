import React from 'react';
import { Map, Calendar, Route } from 'lucide-react';
import kangarooIcon from '../../kangaroo.svg';

export default function Header({ trip }) {
    const dateRange = trip?.getDateRange() || 'Nov 2025 - Jan 2026';
    const totalDistance = trip?.getTotalDistance();

    return (
        <header className="h-20 bg-white border-b border-orange-100 flex items-center justify-between px-8 shadow-sm shrink-0">
            {/* Left Section */}
            <div className="flex items-center gap-4">
                <div className="bg-orange-600 text-white p-2.5 rounded-2xl shadow-orange-200 shadow-lg">
                    <Map size={24} />
                </div>
                <div>
                    <h1 className="font-black text-2xl tracking-tight text-slate-900">
                        Jennys und Leons <span className="text-orange-600">Australien Trip</span>
                    </h1>
                    <div className="flex items-center gap-3 text-slate-400 text-xs font-medium mt-0.5">
                        <span className="flex items-center gap-1"><Calendar size={12} />{dateRange}</span>
                        {totalDistance && (
                            <>
                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                <span className="flex items-center gap-1"><Route size={12} />{totalDistance.toLocaleString('de-DE')} km</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Avatar */}
            <div className="h-10 w-10 rounded-full border-2 border-orange-100 p-0.5">
                <div className="w-full h-full rounded-full bg-orange-50 flex items-center justify-center overflow-hidden">
                    <img src={kangarooIcon} alt="Kangaroo" className="w-6 h-6" />
                </div>
            </div>
        </header>
    );
}