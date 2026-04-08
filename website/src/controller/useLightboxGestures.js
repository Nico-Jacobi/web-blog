import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Manages all gesture interactions for the media lightbox:
 * touch swipe, pinch-to-zoom, mouse pan, scroll wheel zoom, double-click zoom.
 *
 * Returns state/refs needed by the lightbox renderer and a ref to attach to the track element.
 */
export function useLightboxGestures({ mediaCount, currentIndex, onNavigate, onClose }) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [scale, setScale] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);

    const trackRef = useRef(null);

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
    const isInteracting = useRef(false);
    const isMousePanning = useRef(false);
    const velocityRef = useRef({ x: 0, y: 0 });
    const lastMoveTime = useRef(0);
    const lastMovePos = useRef({ x: 0, y: 0 });
    const momentumRaf = useRef(null);

    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

    const stopMomentum = useCallback(() => {
        if (momentumRaf.current) {
            cancelAnimationFrame(momentumRaf.current);
            momentumRaf.current = null;
        }
    }, []);

    const startMomentum = useCallback(() => {
        const friction = 0.95;
        const minSpeed = 0.3;
        const animate = () => {
            const vx = velocityRef.current.x *= friction;
            const vy = velocityRef.current.y *= friction;
            if (Math.abs(vx) < minSpeed && Math.abs(vy) < minSpeed) {
                momentumRaf.current = null;
                isInteracting.current = false;
                return;
            }
            panXRef.current += vx;
            panYRef.current += vy;
            setPanX(panXRef.current);
            setPanY(panYRef.current);
            momentumRaf.current = requestAnimationFrame(animate);
        };
        momentumRaf.current = requestAnimationFrame(animate);
    }, []);

    const resetInteraction = useCallback(() => {
        stopMomentum();
        scaleRef.current = 1;
        panXRef.current = 0;
        panYRef.current = 0;
        isDraggingRef.current = false;
        dragOffsetRef.current = 0;
        isPinching.current = false;
        isInteracting.current = false;
        velocityRef.current = { x: 0, y: 0 };
        setScale(1);
        setPanX(0);
        setPanY(0);
        setDragOffset(0);
        setIsDragging(false);
    }, [stopMomentum]);

    useEffect(() => { resetInteraction(); }, [currentIndex, resetInteraction]);

    // --- Zoom helpers ---

    function zoomToPoint(cx, cy, oldScale, newScale) {
        const newPanX = cx - ((cx - panXRef.current) / oldScale) * newScale;
        const newPanY = cy - ((cy - panYRef.current) / oldScale) * newScale;
        return { newPanX, newPanY };
    }

    function applyZoom(newScale, newPanX, newPanY) {
        scaleRef.current = newScale;
        panXRef.current = newPanX;
        panYRef.current = newPanY;
        setScale(newScale);
        setPanX(newPanX);
        setPanY(newPanY);
    }

    function resetZoom() {
        applyZoom(1, 0, 0);
    }

    // --- Velocity tracking ---

    function trackVelocity(clientX, clientY) {
        const now = performance.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
            velocityRef.current = {
                x: (clientX - lastMovePos.current.x) / Math.max(dt, 1) * 16,
                y: (clientY - lastMovePos.current.y) / Math.max(dt, 1) * 16,
            };
        }
        lastMovePos.current = { x: clientX, y: clientY };
        lastMoveTime.current = now;
    }

    function applyPan(clientX, clientY) {
        const newPanX = panStartOffset.current.x + (clientX - panStartTouch.current.x);
        const newPanY = panStartOffset.current.y + (clientY - panStartTouch.current.y);
        panXRef.current = newPanX;
        panYRef.current = newPanY;
        setPanX(newPanX);
        setPanY(newPanY);
    }

    function beginPan(clientX, clientY) {
        stopMomentum();
        panStartTouch.current = { x: clientX, y: clientY };
        panStartOffset.current = { x: panXRef.current, y: panYRef.current };
        lastMovePos.current = { x: clientX, y: clientY };
        lastMoveTime.current = performance.now();
        velocityRef.current = { x: 0, y: 0 };
    }

    function releaseMomentumOrStop() {
        const speed = Math.sqrt(velocityRef.current.x ** 2 + velocityRef.current.y ** 2);
        if (speed > 1) {
            startMomentum();
        } else {
            isInteracting.current = false;
        }
    }

    // --- Attach native event listeners ---

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;

        const getPinchDist = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const onTouchStart = (e) => {
            isInteracting.current = true;
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
                    beginPan(touch.clientX, touch.clientY);
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
                const oldScale = scaleRef.current;
                const newScale = Math.max(1, Math.min(5, oldScale * delta));

                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - window.innerWidth / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - window.innerHeight / 2;
                const { newPanX, newPanY } = zoomToPoint(midX, midY, oldScale, newScale);
                applyZoom(newScale, newPanX, newPanY);
            } else if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (scaleRef.current > 1) {
                    e.preventDefault();
                    trackVelocity(touch.clientX, touch.clientY);
                    applyPan(touch.clientX, touch.clientY);
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
                if (scaleRef.current < 1.15) {
                    isInteracting.current = false;
                    resetZoom();
                } else if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    panStartTouch.current = { x: touch.clientX, y: touch.clientY };
                    panStartOffset.current = { x: panXRef.current, y: panYRef.current };
                } else {
                    isInteracting.current = false;
                }
                return;
            }

            if (!isPinching.current && scaleRef.current > 1 && e.touches.length === 0) {
                releaseMomentumOrStop();
            }

            if (isDraggingRef.current && scaleRef.current <= 1) {
                isDraggingRef.current = false;
                setIsDragging(false);
                isInteracting.current = false;
                const threshold = window.innerWidth * 0.2;
                const offset = dragOffsetRef.current;
                if (offset < -threshold && currentIndexRef.current < mediaCount - 1) {
                    onNavigate(currentIndexRef.current + 1);
                } else if (offset > threshold && currentIndexRef.current > 0) {
                    onNavigate(currentIndexRef.current - 1);
                }
                dragOffsetRef.current = 0;
                setDragOffset(0);
            }

            if (e.touches.length === 0) {
                isInteracting.current = false;
            }
        };

        const onMouseDown = (e) => {
            if (e.button !== 0) return;
            if (scaleRef.current > 1) {
                isMousePanning.current = true;
                isInteracting.current = true;
                beginPan(e.clientX, e.clientY);
                e.preventDefault();
            }
        };

        const onMouseMove = (e) => {
            if (!isMousePanning.current) return;
            e.preventDefault();
            trackVelocity(e.clientX, e.clientY);
            applyPan(e.clientX, e.clientY);
        };

        const onMouseUp = () => {
            if (isMousePanning.current) {
                isMousePanning.current = false;
                releaseMomentumOrStop();
            }
        };

        const onWheel = (e) => {
            e.preventDefault();
            const oldScale = scaleRef.current;
            const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const newScale = Math.max(1, Math.min(5, oldScale * zoomFactor));

            if (newScale === 1) {
                resetZoom();
            } else {
                const cx = e.clientX - window.innerWidth / 2;
                const cy = e.clientY - window.innerHeight / 2;
                const { newPanX, newPanY } = zoomToPoint(cx, cy, oldScale, newScale);
                applyZoom(newScale, newPanX, newPanY);
            }
        };

        const onDblClick = (e) => {
            e.stopPropagation();
            if (scaleRef.current > 1) {
                resetZoom();
            } else {
                const newScale = 2;
                const cx = e.clientX - window.innerWidth / 2;
                const cy = e.clientY - window.innerHeight / 2;
                const { newPanX, newPanY } = zoomToPoint(cx, cy, 1, newScale);
                applyZoom(newScale, newPanX, newPanY);
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('dblclick', onDblClick);

        return () => {
            stopMomentum();
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('dblclick', onDblClick);
        };
    }, [mediaCount, onNavigate, stopMomentum, startMomentum]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
            else if (e.key === 'ArrowRight' && currentIndex < mediaCount - 1) onNavigate(currentIndex + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, mediaCount, onClose, onNavigate]);

    return {
        trackRef,
        isDragging,
        dragOffset,
        scale,
        panX,
        panY,
        isInteracting,
    };
}
