import { useState, useRef, useCallback } from 'react';

const PULL_THRESHOLD = 80;

/**
 * Manages pull-to-refresh touch gesture state.
 * Returns touch handlers and visual state for the refresh indicator.
 */
export function usePullToRefresh() {
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const touchStartY = useRef(null);

    const onTouchStart = useCallback((e) => {
        if (refreshing) return;
        touchStartY.current = e.touches[0].clientY;
    }, [refreshing]);

    const onTouchMove = useCallback((e) => {
        if (touchStartY.current === null || refreshing) return;
        const dy = e.touches[0].clientY - touchStartY.current;
        if (dy > 0) {
            setPullDistance(Math.min(dy, PULL_THRESHOLD + 30));
        } else {
            setPullDistance(0);
        }
    }, [refreshing]);

    const onTouchEnd = useCallback(() => {
        if (touchStartY.current === null) return;
        if (pullDistance >= PULL_THRESHOLD && !refreshing) {
            setRefreshing(true);
            setPullDistance(PULL_THRESHOLD);
            setTimeout(() => window.location.reload(), 800);
        } else {
            setPullDistance(0);
        }
        touchStartY.current = null;
    }, [pullDistance, refreshing]);

    const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

    return {
        pullDistance,
        refreshing,
        pullProgress,
        touchHandlers: { onTouchStart, onTouchMove, onTouchEnd },
    };
}
