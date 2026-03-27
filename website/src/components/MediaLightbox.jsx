import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function MediaLightbox({
                                          media,
                                          currentIndex,
                                          onClose,
                                          onNavigate
                                      }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [scale, setScale] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const trackRef = useRef(null);

    // Refs for values needed inside native event listeners (closures don't capture state updates)
    const startX = useRef(0);
    const isPinching = useRef(false);
    const lastPinchDist = useRef(0);
    const panStartTouch = useRef({ x: 0, y: 0 });
    const panStartOffset = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    const panXRef = useRef(0);
    const panYRef = useRef(0);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef(0);
    const currentIndexRef = useRef(currentIndex);

    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    const resetInteraction = useCallback(() => {
        scaleRef.current = 1;
        panXRef.current = 0;
        panYRef.current = 0;
        isDraggingRef.current = false;
        dragOffsetRef.current = 0;
        isPinching.current = false;
        setScale(1);
        setPanX(0);
        setPanY(0);
        setDragOffset(0);
        setIsDragging(false);
    }, []);

    useEffect(() => {
        resetInteraction();
    }, [currentIndex, resetInteraction]);

    const sharedButtonStyle = "group bg-white hover:bg-slate-50 p-2 md:p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200 outline-offset-2 focus:outline-orange-500";
    const sharedIconStyle = "text-slate-700 group-hover:text-orange-500 transition-colors";

    const getPinchDist = (touches) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                isPinching.current = true;
                isDraggingRef.current = false;
                setIsDragging(false);
                dragOffsetRef.current = 0;
                setDragOffset(0);
                lastPinchDist.current = getPinchDist(e.touches);
            } else if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (scaleRef.current > 1) {
                    panStartTouch.current = { x: touch.clientX, y: touch.clientY };
                    panStartOffset.current = { x: panXRef.current, y: panYRef.current };
                } else {
                    isDraggingRef.current = true;
                    setIsDragging(true);
                    startX.current = touch.clientX;
                }
            }
        };

        const onTouchMove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = getPinchDist(e.touches);
                const delta = dist / lastPinchDist.current;
                lastPinchDist.current = dist;
                const newScale = Math.max(1, Math.min(5, scaleRef.current * delta));
                scaleRef.current = newScale;
                setScale(newScale);
            } else if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (scaleRef.current > 1) {
                    e.preventDefault();
                    const newPanX = panStartOffset.current.x + (touch.clientX - panStartTouch.current.x);
                    const newPanY = panStartOffset.current.y + (touch.clientY - panStartTouch.current.y);
                    panXRef.current = newPanX;
                    panYRef.current = newPanY;
                    setPanX(newPanX);
                    setPanY(newPanY);
                } else if (isDraggingRef.current) {
                    const diff = touch.clientX - startX.current;
                    dragOffsetRef.current = diff;
                    setDragOffset(diff);
                }
            }
        };

        const onTouchEnd = (e) => {
            if (isPinching.current && e.touches.length < 2) {
                isPinching.current = false;
                // Snap back to 1 if barely zoomed
                if (scaleRef.current < 1.15) {
                    scaleRef.current = 1;
                    panXRef.current = 0;
                    panYRef.current = 0;
                    setScale(1);
                    setPanX(0);
                    setPanY(0);
                }
                return;
            }

            if (isDraggingRef.current && scaleRef.current <= 1) {
                isDraggingRef.current = false;
                setIsDragging(false);
                const threshold = window.innerWidth * 0.2;
                const offset = dragOffsetRef.current;
                if (offset < -threshold && currentIndexRef.current < media.length - 1) {
                    onNavigate(currentIndexRef.current + 1);
                } else if (offset > threshold && currentIndexRef.current > 0) {
                    onNavigate(currentIndexRef.current - 1);
                }
                dragOffsetRef.current = 0;
                setDragOffset(0);
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [media.length, onNavigate]);

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
                                    transition: 'transform 0.15s ease-out',
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
