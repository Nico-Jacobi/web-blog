import React, {useEffect, useMemo, useState} from 'react';
import { X, Calendar, MapPin, Image as ImageIcon, Play } from 'lucide-react';
import MediaLightbox from './MediaLightbox.jsx';

function getTravelDay(point, trip) {
    const startDate = trip?.points?.[0]?.getParsedDate();
    const currentDate = point?.getParsedDate();
    if (!startDate || !currentDate) return point?.order ?? '-';
    return Math.round((currentDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

export default function PointDetail({ point, trip, onClose }) {
    const [titleImageUrl, setTitleImageUrl] = useState(null);
    const [otherImageUrls, setOtherImageUrls] = useState([]);
    const [loadingOther, setLoadingOther] = useState(false);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    // Define common button styling classes to ensure exact consistency
    const sharedButtonStyle = "group bg-white hover:bg-slate-50 p-2 md:p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200 outline-offset-2 focus:outline-orange-500";
    const sharedIconStyle = "text-slate-700 group-hover:text-orange-500 transition-colors";

    // Helper function to check if a URL/path is a video
    const isVideo = (path) => {
        if (!path) return false;
        const lower = path.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
    };

    // Build media array for lightbox
    const lightboxMedia = useMemo(() => {
        return otherImageUrls.map((url, idx) => ({
            url,
            isVideo: isVideo(point.otherPaths[idx])
        }));
    }, [otherImageUrls, point]);

    useEffect(() => {
        if (isLightboxOpen) {
            // 1. Push a 'lightbox' state so the back button has something to remove
            window.history.pushState({ view: 'lightbox' }, '');

            // 2. Define local handler for when user presses Back
            const handleLightboxPop = (_) => {
                // If we pop back, simply close the lightbox
                // The event will bubble to App.js, but App.js will see
                // we landed on { view: 'detail' } and will ignore it.
                setIsLightboxOpen(false);
            };

            window.addEventListener('popstate', handleLightboxPop);
            return () => window.removeEventListener('popstate', handleLightboxPop);
        }
    }, [isLightboxOpen]);

    const handleCloseLightbox = () => {
        // If we close manually, we must go back in history to remove the 'lightbox' tag
        // so the Forward button doesn't reopen it weirdly.
        window.history.back();
        // Note: calling .back() triggers popstate, which sets isLightboxOpen(false) via the listener above
    };

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
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
                setLoadingOther(true);
                const otherUrls = await point.getOtherImages();
                if (mounted) {
                    setOtherImageUrls(otherUrls);
                    setLoadingOther(false);
                }
            }
        }

        loadImages();
        return () => { mounted = false; };
    }, [point]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isLightboxOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLightboxOpen, onClose]);

    if (!point) return null;

    return (
        <>
            {/* Modal Wrapper */}
            <div className="fixed inset-0 z-[5000] bg-white/80 backdrop-blur-lg animate-in slide-in-from-bottom duration-300">

                {/* --- MAIN CLOSE BUTTON --- */}
                <button
                    onClick={onClose}
                    className={`fixed top-4 right-4 md:top-8 md:right-8 z-[5010] ${sharedButtonStyle}`}
                    aria-label="Close"
                >
                    <X size={20} className={`md:hidden ${sharedIconStyle}`}/>
                    <X size={24} className={`hidden md:block ${sharedIconStyle}`}/>
                </button>

                {/* SCROLLABLE Content Container */}
                <div className="h-full w-full overflow-y-auto pt-6 md:pt-10">
                    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-12">

                        {/* Hero Image Section */}
                        <div className="mb-4 md:mb-8 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border-2 md:border-4 border-white">
                            {titleImageUrl ? (
                                <div className="relative">
                                    <img
                                        src={titleImageUrl}
                                        alt={point.title}
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
                                {/* Stopp Nr. - now first */}
                                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
                                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                        <div className="w-1 h-5 md:h-6 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-base md:text-lg font-black text-slate-900">Reisetag</h3>
                                    </div>
                                    <p className="text-4xl md:text-5xl font-black text-orange-600">{getTravelDay(point, trip)}</p>
                                </div>

                                {/* Standort - now second and hidden on mobile */}
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

                        {/* Gallery Section */}
                        {point.otherPaths.length > 0 && (
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
                                            // Check the ORIGINAL path, not the blob URL
                                            const originalPath = point.otherPaths[idx];
                                            const isVid = isVideo(originalPath);

                                            return (
                                                <div
                                                    key={idx}
                                                    className="group relative aspect-square rounded-lg md:rounded-xl overflow-hidden cursor-pointer"
                                                    onClick={() => {
                                                        setCurrentMediaIndex(idx);
                                                        setIsLightboxOpen(true);
                                                    }}
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
                                                        <>
                                                            <img
                                                                src={url}
                                                                alt="Gallery"
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="h-12 md:h-20" /> {/* Final bottom padding */}
                    </div>
                </div>
            </div>

            {/* Lightbox Overlay */}
            {isLightboxOpen && lightboxMedia.length > 0 && (
                <MediaLightbox
                    media={lightboxMedia} // Pass the memoized array
                    currentIndex={currentMediaIndex}
                    onClose={handleCloseLightbox} // Use the new close handler
                    onNavigate={setCurrentMediaIndex}
                />
            )}
        </>
    );
}