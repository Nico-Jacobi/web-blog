import React from 'react';
import { Calendar, MapPin } from 'lucide-react';

export default function HeroSection({ point, titleImageUrl }) {
    if (!point) return null;
    if (point.isWaypoint) return null;

    return (
        <div className="mb-4 md:mb-8 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 md:border-4 border-white">
            {titleImageUrl ? (
                <div className="relative">
                    <img
                        src={titleImageUrl}
                        alt={point.title}
                        loading="eager"
                        fetchpriority="high"
                        decoding="async"
                        className="w-full h-[40vh] md:h-[60vh] object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-8 text-white">
                        <h2 className="text-xl md:text-5xl font-black mb-1.5 md:mb-4 drop-shadow-lg">{point.title}</h2>
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-[10px] md:text-sm font-medium">
                            <span className="flex items-center gap-1 md:gap-2 bg-white/20 backdrop-blur-sm px-2 md:px-4 py-1 md:py-2 rounded-full">
                                <Calendar size={10} className="md:hidden" />
                                <Calendar size={14} className="hidden md:block" />
                                <span className="text-[10px] md:text-sm">{point.date}</span>
                            </span>
                            {point.lat && point.lng && (
                                <span className="flex items-center gap-1 md:gap-2 bg-white/20 backdrop-blur-sm px-2 md:px-4 py-1 md:py-2 rounded-full">
                                    <MapPin size={10} className="md:hidden" />
                                    <MapPin size={14} className="hidden md:block" />
                                    <span className="text-[10px] md:text-sm">{point.lat.toFixed(4)}°, {point.lng.toFixed(4)}°</span>
                                </span>
                            )}
                        </div>
                        {point.desc && (
                            <p className="mt-1.5 md:mt-4 text-white/90 text-xs md:text-lg font-medium max-w-2xl leading-relaxed">
                                {point.desc}
                            </p>
                        )}
                    </div>
                </div>
            ) : (
                <div className="w-full h-[40vh] md:h-[60vh] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 md:gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 border-3 md:border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium text-sm md:text-base">Bild wird geladen...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
