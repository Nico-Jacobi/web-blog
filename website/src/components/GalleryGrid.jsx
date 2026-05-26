import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Play } from 'lucide-react';
import { isVideo } from '../utils.js';
import { useSettings } from '../context/SettingsContext';

function LazyVideo({ src, className, ...props }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <video
            ref={ref}
            src={visible ? src : undefined}
            className={className}
            preload="metadata"
            {...props}
        />
    );
}

export default function GalleryGrid({ point, otherImageUrls, onOpenLightbox }) {
    const { t } = useSettings();
    if (point.otherPaths.length === 0) return null;
    const otherThumbUrls = point.otherThumbUrls;

    return (
        <div className="mt-4 md:mt-8 bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <div className="w-1 h-6 md:h-8 bg-orange-500 rounded-full"></div>
                <h3 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ImageIcon size={20} className="md:hidden" />
                    <ImageIcon size={24} className="hidden md:block" />
                    {t('gallery.title')}
                </h3>
                <span className="ml-auto text-xs md:text-sm text-slate-400 dark:text-slate-500 font-bold">
                    {point.otherPaths.length} {point.otherPaths.length === 1 ? t('gallery.file') : t('gallery.files')}
                </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {point.otherPaths.map((path, idx) => {
                    const url = otherImageUrls[idx];
                    const thumbForGrid = otherThumbUrls[idx];
                    const isVid = isVideo(path);

                    return (
                        <div
                            key={idx}
                            className="group relative aspect-square rounded-lg md:rounded-xl overflow-hidden cursor-pointer bg-slate-100 dark:bg-slate-700"
                            onClick={() => onOpenLightbox(idx)}
                        >
                            {isVid ? (
                                <>
                                    <LazyVideo
                                        src={url}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                    />
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                        <div className="bg-white/90 dark:bg-slate-800/90 group-hover:bg-orange-500 group-hover:text-white rounded-full p-3 md:p-4 transition-all shadow-lg">
                                            <Play size={20} className="md:hidden" fill="currentColor" />
                                            <Play size={24} className="hidden md:block" fill="currentColor" />
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <img
                                    src={thumbForGrid}
                                    alt="Gallery"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
