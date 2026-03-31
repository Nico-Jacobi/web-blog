import React from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';

function isVideo(path) {
    if (!path) return false;
    const lower = path.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
}

export default function GalleryGrid({ point, otherImageUrls, loadingOther, onOpenLightbox }) {
    if (point.otherPaths.length === 0) return null;

    return (
        <div className="mt-4 md:mt-8 bg-white rounded-xl md:rounded-2xl p-4 md:p-8 shadow-lg border border-slate-100">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <div className="w-1 h-6 md:h-8 bg-orange-500 rounded-full"></div>
                <h3 className="text-lg md:text-2xl font-black text-slate-900 flex items-center gap-2">
                    <ImageIcon size={20} className="md:hidden" />
                    <ImageIcon size={24} className="hidden md:block" />
                    Galerie
                </h3>
                <span className="ml-auto text-xs md:text-sm text-slate-400 font-bold">
                    {point.otherPaths.length} {point.otherPaths.length === 1 ? 'DATEI' : 'DATEIEN'}
                </span>
            </div>
            {loadingOther ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {[...Array(point.otherPaths.length)].map((_, i) => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-lg md:rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {otherImageUrls.map((url, idx) => {
                        const isVid = isVideo(point.otherPaths[idx]);

                        return (
                            <div
                                key={idx}
                                className="group relative aspect-square rounded-lg md:rounded-xl overflow-hidden cursor-pointer"
                                onClick={() => onOpenLightbox(idx)}
                            >
                                {isVid ? (
                                    <>
                                        <video
                                            src={url}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                        />
                                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <div className="bg-white/90 group-hover:bg-orange-500 group-hover:text-white rounded-full p-3 md:p-4 transition-all shadow-lg">
                                                <Play size={20} className="md:hidden" fill="currentColor" />
                                                <Play size={24} className="hidden md:block" fill="currentColor" />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <img
                                        src={url}
                                        alt="Gallery"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
