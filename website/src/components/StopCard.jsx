import React, { useState, useEffect } from 'react';
import { Calendar, Info, MapPin } from 'lucide-react';

export default function StopCard({ point, isActive, onInfoClick, onMapClick }) {
    const [image, setImage] = useState(null);

    useEffect(() => {
        point.getTitleImage().then(setImage);
    }, [point]);

    return (
        <div
            className={`p-4 rounded-2xl transition-all border-2 mb-0 ${
                isActive
                    ? 'bg-orange-50 border-orange-200 shadow-sm'
                    : 'bg-white border-transparent hover:bg-slate-50'
            }`}
        >
            <div className="flex gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    {image ? (
                        <img src={image} alt={point.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full animate-pulse bg-slate-200" />
                    )}
                </div>

                <div className="flex flex-col justify-center overflow-hidden flex-1 min-w-0">
                    <h3 className={`font-bold truncate ${isActive ? 'text-orange-900' : 'text-slate-800'}`}>
                        {point.title}
                    </h3>

                    {point.date && (
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                            <Calendar size={12} />
                            <span>{point.date}</span>
                        </div>
                    )}

                    <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                        {point.desc}
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    onClick={() => onInfoClick(point.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-orange-500 text-white hover:bg-orange-600"
                >
                    <Info size={14} />
                    Info
                </button>
                <button
                    onClick={() => onMapClick(point.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                    <MapPin size={14} />
                    Karte
                </button>
            </div>
        </div>
    );
}