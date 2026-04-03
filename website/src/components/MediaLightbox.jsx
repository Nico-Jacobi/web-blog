import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { sharedButtonStyle, sharedIconStyle } from './styles.js';
import { useLightboxGestures } from '../controller/useLightboxGestures.js';

export default function MediaLightbox({ media, currentIndex, onClose, onNavigate }) {
    const {
        trackRef,
        isDragging,
        dragOffset,
        scale,
        panX,
        panY,
        isInteracting,
    } = useLightboxGestures({
        mediaCount: media.length,
        currentIndex,
        onNavigate,
        onClose,
    });

    if (!media || media.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[6000] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden animate-in fade-in duration-200">
            {/* Controls Layer */}
            <div className="absolute inset-0 z-[6020] pointer-events-none">
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 md:top-8 md:right-8 pointer-events-auto ${sharedButtonStyle}`}
                    aria-label="Close"
                >
                    <X size={20} className={`md:hidden ${sharedIconStyle}`} />
                    <X size={24} className={`hidden md:block ${sharedIconStyle}`} />
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
            <div
                ref={trackRef}
                className="absolute inset-y-0 left-0 flex items-center"
                style={{
                    transform: `translateX(calc(-${currentIndex * 100}vw + ${dragOffset}px))`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
                    width: `${media.length * 100}vw`,
                    willChange: 'transform',
                    touchAction: scale > 1 ? 'none' : 'pan-y',
                }}
            >
                {media.map((item, index) => (
                    <div
                        key={index}
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
                                style={index === currentIndex ? {
                                    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
                                    transformOrigin: 'center center',
                                    transition: isInteracting.current ? 'none' : 'transform 0.15s ease-out',
                                    cursor: scale > 1 ? 'grab' : 'default',
                                } : {}}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
