import React, {useEffect, useMemo, useState} from 'react';
import { X } from 'lucide-react';
import MediaLightbox from './MediaLightbox.jsx';
import HeroSection from './HeroSection.jsx';
import GalleryGrid from './GalleryGrid.jsx';
import { sharedButtonStyle, sharedIconStyle } from './styles.js';
import { isVideo } from '../utils.js';

function getTravelDay(point, trip) {
    const startDate = trip?.points?.[0]?.getParsedDate();
    const currentDate = point?.getParsedDate();
    if (!startDate || !currentDate) return point?.order ?? '-';
    return Math.round((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

export default function PointDetail({ point, trip, onClose }) {
    const [titleImageUrl, setTitleImageUrl] = useState(null);
    const [otherImageUrls, setOtherImageUrls] = useState([]);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    const lightboxMedia = useMemo(() => {
        return otherImageUrls.map((url, idx) => ({
            url,
            isVideo: isVideo(point.otherPaths[idx])
        }));
    }, [otherImageUrls, point]);

    useEffect(() => {
        if (isLightboxOpen) {
            window.history.pushState({ view: 'lightbox' }, '');

            const handleLightboxPop = () => {
                setIsLightboxOpen(false);
            };

            window.addEventListener('popstate', handleLightboxPop);
            return () => window.removeEventListener('popstate', handleLightboxPop);
        }
    }, [isLightboxOpen]);

    const handleCloseLightbox = () => {
        window.history.back();
    };

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (!point) return;
        let mounted = true;

        setTitleImageUrl(null);
        setOtherImageUrls([]);

        async function loadImages() {
            const titleUrl = await point.getTitleImage();
            if (mounted) setTitleImageUrl(titleUrl);

            if (point.otherPaths.length > 0) {
                await point.loadOtherImagesSequentially((loadedSoFar) => {
                    if (mounted) setOtherImageUrls(loadedSoFar);
                });
            }
        }

        loadImages();
        return () => { mounted = false; };
    }, [point]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isLightboxOpen) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, onClose]);

    if (!point) return null;

    return (
        <>
            <div className="fixed inset-0 z-[5000] bg-white/80 backdrop-blur-lg animate-in slide-in-from-bottom duration-300">
                <button
                    onClick={onClose}
                    className={`fixed top-4 right-4 md:top-8 md:right-8 z-[5010] ${sharedButtonStyle}`}
                    aria-label="Close"
                >
                    <X size={20} className={`md:hidden ${sharedIconStyle}`}/>
                    <X size={24} className={`hidden md:block ${sharedIconStyle}`}/>
                </button>

                <div className="h-full w-full overflow-y-auto pt-6 md:pt-10">
                    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-12">
                        <HeroSection point={point} titleImageUrl={titleImageUrl} />

                        {/* Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
                            {point.description && (
                                <div className="lg:col-span-2 bg-white rounded-xl md:rounded-2xl p-4 md:p-8 shadow-lg border border-slate-100">
                                    <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                                        <div className="w-1 h-6 md:h-8 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-lg md:text-2xl font-black text-slate-900">Was hier passiert ist</h3>
                                    </div>
                                    <p className="text-slate-700 text-sm md:text-lg leading-relaxed whitespace-pre-wrap">
                                        {point.description}
                                    </p>
                                </div>
                            )}

                            <div className="lg:col-span-1 space-y-4 md:space-y-6">
                                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
                                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                        <div className="w-1 h-5 md:h-6 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-base md:text-lg font-black text-slate-900">Reisetag</h3>
                                    </div>
                                    <p className="text-4xl md:text-5xl font-black text-orange-600">{getTravelDay(point, trip)}</p>
                                </div>

                                {point.lat && point.lng && (
                                    <div className="hidden md:block bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
                                        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                            <div className="w-1 h-5 md:h-6 bg-orange-500 rounded-full"></div>
                                            <h3 className="text-base md:text-lg font-black text-slate-900">Standort</h3>
                                        </div>
                                        <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-slate-600 font-medium">
                                            <p><span className="text-slate-400">Breitengrad:</span> {point.lat.toFixed(6)}°</p>
                                            <p><span className="text-slate-400">Längengrad:</span> {point.lng.toFixed(6)}°</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <GalleryGrid
                            point={point}
                            otherImageUrls={otherImageUrls}
                            onOpenLightbox={(idx) => {
                                setCurrentMediaIndex(idx);
                                setIsLightboxOpen(true);
                            }}
                        />

                        <div className="h-12 md:h-20" />
                    </div>
                </div>
            </div>

            {isLightboxOpen && lightboxMedia.length > 0 && (
                <MediaLightbox
                    media={lightboxMedia}
                    currentIndex={currentMediaIndex}
                    onClose={handleCloseLightbox}
                    onNavigate={setCurrentMediaIndex}
                />
            )}
        </>
    );
}
