import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MediaLightbox({
                                          media,
                                          currentIndex,
                                          onClose,
                                          onNavigate
                                      }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const trackRef = useRef(null);
    const startX = useRef(0);

    const sharedButtonStyle = "group bg-white hover:bg-slate-50 p-2 md:p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200 outline-offset-2 focus:outline-orange-500";
    const sharedIconStyle = "text-slate-700 group-hover:text-orange-500 transition-colors";

    // Reset drag state when index changes externally
    useEffect(() => {
        setDragOffset(0);
        setIsDragging(false);
    }, [currentIndex]);

    const handleTouchStart = (e) => {
        setIsDragging(true);
        startX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        setDragOffset(diff);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        const threshold = window.innerWidth * 0.2; // Drag 20% to snap

        if (dragOffset < -threshold && currentIndex < media.length - 1) {
            onNavigate(currentIndex + 1);
        } else if (dragOffset > threshold && currentIndex > 0) {
            onNavigate(currentIndex - 1);
        }

        // Snap back happens automatically via React state reset in useEffect or below
        setDragOffset(0);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
            else if (e.key === 'ArrowRight' && currentIndex < media.length - 1) onNavigate(currentIndex + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, media.length, onClose, onNavigate]);

    if (!media || media.length === 0) return null;

    return (
        <div
            className="fixed inset-0 z-[6000] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
        >
            {/* Controls Layer */}
            <div className="absolute inset-0 z-[6020] pointer-events-none">
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 md:top-8 md:right-8 pointer-events-auto ${sharedButtonStyle}`}
                    aria-label="Close"
                >
                    <X size={20} className={`md:hidden ${sharedIconStyle}`}/>
                    <X size={24} className={`hidden md:block ${sharedIconStyle}`}/>
                </button>

                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-bold text-slate-700 pointer-events-auto">
                    {currentIndex + 1} / {media.length}
                </div>

                {currentIndex > 0 && (
                    <button
                        onClick={() => onNavigate(currentIndex - 1)}
                        className={`hidden md:block absolute left-4 md:left-8 top-1/2 -translate-y-1/2 pointer-events-auto ${sharedButtonStyle}`}
                    >
                        <ChevronLeft size={24} className={sharedIconStyle} />
                    </button>
                )}

                {currentIndex < media.length - 1 && (
                    <button
                        onClick={() => onNavigate(currentIndex + 1)}
                        className={`hidden md:block absolute right-4 md:right-8 top-1/2 -translate-y-1/2 pointer-events-auto ${sharedButtonStyle}`}
                    >
                        <ChevronRight size={24} className={sharedIconStyle} />
                    </button>
                )}
            </div>

            {/* Slider Track */}
            {/* Slider Track */}
            <div
                ref={trackRef}
                className="absolute inset-y-0 left-0 flex items-center touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    // Use vw for both transform and width to ensure perfect 1:1 screen mapping
                    transform: `translateX(calc(-${currentIndex * 100}vw + ${dragOffset}px))`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                    width: `${media.length * 100}vw`,
                    willChange: 'transform' // Optimizes animation performance
                }}
            >
                {media.map((item, index) => (
                    <div
                        key={index}
                        // w-screen ensures each slide is exactly the width of the viewport
                        className="h-full w-screen flex-none flex items-center justify-center p-4 md:p-12 relative"
                        onClick={onClose}
                    >
                        {item.isVideo ? (
                            <video
                                src={item.url}
                                controls
                                className="max-w-full max-h-full object-contain shadow-2xl bg-black"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <img
                                src={item.url}
                                alt={`Slide ${index}`}
                                className="max-w-full max-h-full object-contain shadow-2xl select-none"
                                draggable={false}
                                onClick={(e) => e.stopPropagation()}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}