/**
 * Kollabiert Waypoints zwischen normalen Points.
 *
 * Input:
 *   points: Array<Point>  — sortiert nach order, Waypoints und normale Points gemischt
 *   trip:   Trip          — für getRouteBetween/getDistanceBetween
 *
 * Output: Array<Item>, abwechselnd 'stop' und 'segments':
 *   { type: 'stop', point }                                — normaler Point
 *   { type: 'segments', badges: [{mode, distance}, ...] }  — eines oder mehrere zusammengefasste Badges
 *
 * Regel: aufeinanderfolgende TripElements zwischen zwei normalen Points werden
 * gruppiert. Gleiche `mode` → ein Badge mit Summe der Distanzen. Wechselt der
 * Mode → neuer Badge in derselben Gruppe.
 */
export function collapseWaypoints(points, trip) {
    const items = [];
    let pendingBadges = [];  // sammelt Badges seit letztem normalen Point

    const flushBadges = () => {
        if (pendingBadges.length > 0) {
            items.push({ type: 'segments', badges: pendingBadges });
            pendingBadges = [];
        }
    };

    for (let i = 0; i < points.length; i++) {
        const point = points[i];

        // Vor dem aktuellen Point: Übergang vom Vorgänger sammeln
        if (i > 0) {
            const prev = points[i - 1];
            const route = trip.getRouteBetween(prev.id, point.id);
            const distance = trip.getDistanceBetween(prev.id, point.id);
            if (route && distance != null) {
                const last = pendingBadges[pendingBadges.length - 1];
                if (last && last.mode === route.mode) {
                    last.distance += distance;
                } else {
                    pendingBadges.push({ mode: route.mode, distance });
                }
            }
        }

        if (!point.isWaypoint) {
            // Vor dem Stop: alle gesammelten Badges flushen
            flushBadges();
            items.push({ type: 'stop', point });
        }
        // Sonst: Waypoint → kein Stop-Item, Badges bleiben gesammelt für nächsten normalen Point
    }

    // Falls am Ende noch Badges übrig sind (z.B. Reise endet mit Waypoint)
    flushBadges();

    return items;
}
