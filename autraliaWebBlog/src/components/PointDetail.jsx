import React, { useEffect, useState } from 'react';
import { X, Calendar, MapPin, Image as ImageIcon } from 'lucide-react';

export default function PointDetail({ point, onClose }) {
    const [titleImageUrl, setTitleImageUrl] = useState(null);
    const [otherImageUrls, setOtherImageUrls] = useState([]);
    const [loadingOther, setLoadingOther] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);

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
            {/* Backdrop with blur */}
            <div className="fixed inset-0 z-[5000] bg-black/0 backdrop-blur-lg overflow-y-auto">
                {/* Close Button - Fixed Position */}
                <button
                    onClick={onClose}
                    className="fixed top-6 right-6 z-10 bg-white hover:bg-slate-50 p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200"
                    aria-label="Close"
                >
                    <X size={24} className="text-slate-700" />
                </button>

                <div className="max-w-6xl mx-auto p-6 md:p-12">
                    {/* Hero Image Section */}
                    <div className="mb-8 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                        {titleImageUrl ? (
                            <div className="relative">
                                <img
                                    src={titleImageUrl}
                                    alt={point.title}
                                    className="w-full h-[60vh] object-cover"
                                />
                                {/* Gradient Overlay for Text */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                                {/* Title Overlay on Image */}
                                <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                                    <h2 className="text-5xl font-black mb-4 drop-shadow-lg">{point.title}</h2>
                                    <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                                        <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                                            <Calendar size={14} />
                                            {point.date}
                                        </span>
                                        {point.lat && point.lng && (
                                            <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                                                <MapPin size={14} />
                                                {point.lat.toFixed(4)}°, {point.lng.toFixed(4)}°
                                            </span>
                                        )}
                                    </div>
                                    {point.desc && (
                                        <p className="mt-3 text-white/90 text-lg font-medium max-w-2xl">
                                            {point.desc}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-[60vh] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-slate-400 font-medium">Bild wird geladen...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Description */}
                        <div className="lg:col-span-2 bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1 h-8 bg-orange-500 rounded-full"></div>
                                <h3 className="text-2xl font-black text-slate-900">Was hier passiert ist</h3>
                            </div>
                            <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">
                                {point.description}
                            </p>
                        </div>

                        {/* Info Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Location Info Card */}
                            {point.lat && point.lng && (
                                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                                        <h3 className="text-lg font-black text-slate-900">Standort</h3>
                                    </div>
                                    <div className="space-y-2 text-sm text-slate-600">
                                        <p><span className="font-semibold">Breitengrad:</span> {point.lat.toFixed(6)}°</p>
                                        <p><span className="font-semibold">Längengrad:</span> {point.lng.toFixed(6)}°</p>
                                    </div>
                                </div>
                            )}

                            {/* Stop Number - Styled to match Location box */}
                            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                                    <h3 className="text-lg font-black text-slate-900">Stopp Nr.</h3>
                                </div>
                                <p className="text-4xl font-black text-slate-900">{point.order ?? '-'}</p>
                            </div>
                        </div>
                    </div>



                    {/* Gallery Section - Full Width */}
                    {point.otherPaths.length > 0 && (
                        <div className="mt-8 bg-white rounded-2xl p-8 shadow-lg border border-slate-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-1 h-8 bg-orange-500 rounded-full"></div>
                                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                    <ImageIcon size={24} />
                                    Galerie
                                </h3>
                                <span className="ml-auto text-sm text-slate-400 font-medium">
                                    {point.otherPaths.length} {point.otherPaths.length === 1 ? 'Bild' : 'Bilder'}
                                </span>
                            </div>
                            {loadingOther ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {[...Array(point.otherPaths.length)].map((_, i) => (
                                        <div key={i} className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {otherImageUrls.map((url, idx) => (
                                        <div
                                            key={idx}
                                            className="group relative aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border-2 border-white cursor-pointer"
                                            onClick={() => setLightboxImage(url)}
                                        >
                                            <img
                                                src={url}
                                                alt={`${point.title} - Bild ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom Spacing */}
                    <div className="h-12"></div>
                </div>
            </div>

            {/* Lightbox for Gallery Images */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[6000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X size={24} className="text-white" />
                    </button>
                    <img
                        src={lightboxImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}