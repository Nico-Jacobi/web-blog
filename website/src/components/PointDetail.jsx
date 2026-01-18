import React, { useEffect, useState } from 'react';
import { X, Calendar, MapPin, Image as ImageIcon } from 'lucide-react';

export default function PointDetail({ point, onClose }) {
    const [titleImageUrl, setTitleImageUrl] = useState(null);
    const [otherImageUrls, setOtherImageUrls] = useState([]);
    const [loadingOther, setLoadingOther] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);

    // Define common button styling classes to ensure exact consistency
    const sharedButtonStyle = "group bg-white hover:bg-slate-50 p-2 md:p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200 outline-offset-2 focus:outline-orange-500";
    const sharedIconStyle = "text-slate-700 group-hover:text-orange-500 transition-colors";

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
            if (e.key === 'Escape') {
                if (lightboxImage) {
                    setLightboxImage(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxImage, onClose]);

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
                            <div className="lg:col-span-2 bg-white rounded-xl md:rounded-2xl p-4 md:p-8 shadow-lg border border-slate-100">
                                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                                    <div className="w-1 h-6 md:h-8 bg-orange-500 rounded-full"></div>
                                    <h3 className="text-lg md:text-2xl font-black text-slate-900">Was hier passiert ist</h3>
                                </div>
                                <p className="text-slate-700 text-sm md:text-lg leading-relaxed whitespace-pre-wrap">
                                    {point.description}
                                </p>
                            </div>

                            <div className="lg:col-span-1 space-y-4 md:space-y-6">
                                {point.lat && point.lng && (
                                    <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
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

                                <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg border border-slate-100">
                                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                                        <div className="w-1 h-5 md:h-6 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-base md:text-lg font-black text-slate-900">Stopp Nr.</h3>
                                    </div>
                                    <p className="text-4xl md:text-5xl font-black text-orange-600">{point.order ?? '-'}</p>
                                </div>
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
                                        {point.otherPaths.length} {point.otherPaths.length === 1 ? 'BILD' : 'BILDER'}
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
                                        {otherImageUrls.map((url, idx) => (
                                            <div
                                                key={idx}
                                                className="group relative aspect-square rounded-lg md:rounded-xl overflow-hidden cursor-pointer"
                                                onClick={() => setLightboxImage(url)}
                                            >
                                                <img
                                                    src={url}
                                                    alt="Gallery"
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/20 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="h-12 md:h-20" /> {/* Final bottom padding */}
                    </div>
                </div>
            </div>

            {/* Lightbox Overlay */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[6000] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
                    onClick={() => setLightboxImage(null)}
                >
                    {/* --- LIGHTBOX CLOSE BUTTON --- */}
                    <button
                        className={`absolute top-4 right-4 md:top-8 md:right-8 z-[6010] ${sharedButtonStyle}`}
                        aria-label="Close Gallery"
                    >
                        <X size={20} className={`md:hidden ${sharedIconStyle}`}/>
                        <X size={24} className={`hidden md:block ${sharedIconStyle}`}/>
                    </button>

                    <img
                        src={lightboxImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}