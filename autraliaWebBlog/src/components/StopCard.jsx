import React from 'react';
import { Calendar } from 'lucide-react';

export default function StopCard({ stop, isActive, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`group p-4 rounded-2xl transition-all cursor-pointer border
        ${isActive
                ? 'bg-orange-50 border-orange-200 shadow-lg scale-[1.02]'
                : 'bg-white border-slate-100 hover:border-orange-100 hover:shadow'
            }`}
        >
            <div className="flex gap-3">
                <img
                    src={stop.image}
                    alt={stop.title}
                    className="w-20 h-20 rounded-xl object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect fill="%23f97316" width="80" height="80"/%3E%3C/svg%3E';
                    }}
                />
                <div className="flex-1">
                    {stop.date && (
                        <div className="flex items-center gap-2 text-xs font-bold text-orange-600 mb-1">
                            <Calendar size={10} /> {stop.date}
                        </div>
                    )}
                    <h3 className="font-bold text-slate-800 leading-tight group-hover:text-orange-700 transition">
                        {stop.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
                        "{stop.desc}"
                    </p>
                </div>
            </div>
        </div>
    );
}