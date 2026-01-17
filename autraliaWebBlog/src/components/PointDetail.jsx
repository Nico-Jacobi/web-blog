import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react'; // NEW: import X icon

export default function PointDetail({ point, onClose }) { // NEW: add onClose prop
    const [titleImageUrl, setTitleImageUrl] = useState(null);
    const [otherImageUrls, setOtherImageUrls] = useState([]);
    const [loadingOther, setLoadingOther] = useState(false);

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

    if (!point) return null;

    return (
        <div className="fixed inset-0 z-[5000] bg-white overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="max-w-4xl mx-auto p-6">
                {/* CHANGED: add close button */}
                <div className="mb-8 pt-10 flex items-start justify-between">
                    <div className="flex-1">
                        <h2 className="text-4xl font-black text-slate-900 mb-2">{point.title}</h2>
                        <div className="flex items-center gap-4 text-slate-500">
                            <span>{point.date}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span>{point.desc}</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X size={28} className="text-slate-600" />
                    </button>
                </div>

                {/* Rest of the component stays the same */}
                <div className="mb-10">
                    {titleImageUrl ? (
                        <img
                            src={titleImageUrl}
                            alt={point.title}
                            className="w-full h-[50vh] object-cover rounded-3xl shadow-2xl"
                        />
                    ) : (
                        <div className="w-full h-[50vh] bg-slate-100 rounded-3xl flex items-center justify-center animate-pulse">
                            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="md:col-span-2">
                        <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider">Beschreibung</h3>
                        <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">
                            {point.description}
                        </p>
                    </div>

                    <div className="md:col-span-1">
                        {point.otherPaths.length > 0 && (
                            <>
                                <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider">Galerie</h3>
                                {loadingOther ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {[...Array(point.otherPaths.length)].map((_, i) => (
                                            <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {otherImageUrls.map((url, idx) => (
                                            <img
                                                key={idx}
                                                src={url}
                                                alt="Gallery"
                                                className="aspect-square object-cover rounded-xl cursor-pointer hover:opacity-80 transition"
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}