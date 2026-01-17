import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export default function StopCard({ point, isActive, onClick }) {
    const [image, setImage] = useState(null);

    useEffect(() => {
        point.getTitleImage().then(setImage);
    }, [point]);

    return (
        <div
            onClick={onClick}
            className={`cursor-pointer p-4 rounded-2xl transition-all border-2 ${
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

                <div className="flex flex-col justify-center overflow-hidden">
                    <h3 className={`font-bold truncate ${isActive ? 'text-orange-900' : 'text-slate-800'}`}>
                        {point.title}
                    </h3>

                    {/* Date Section */}
                    {point.date && (
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] mt-0.5">
                            <Calendar size={12} />
                            <span>{point.date}</span>
                        </div>
                    )}

                    {/* Short Description */}
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                        {point.desc}
                    </p>
                </div>
            </div>
        </div>
    );
}