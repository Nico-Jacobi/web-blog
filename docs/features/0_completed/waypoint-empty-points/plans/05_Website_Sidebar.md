# Waypoint - Plan 05: Sidebar mit Waypoint-Kollabierung (Website)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Sidebar zeigt Waypoints **nicht** als StopCard. Zwischen zwei normalen Punkten werden alle dazwischenliegenden TripElements zu Route-Badges aggregiert: gleiche Methode → ein Badge mit Distanz-Summe; unterschiedliche Methoden → mehrere Badges nacheinander. Defensiv-Guards in HeroSection, StopCard, PointDetail (rendern `null` falls versehentlich ein Waypoint reinkommt). |
| **Abhängig von** | Plan 01 (Datenmodell mit `isWaypoint`) |
| **Betroffene Bereiche** | Website / UI-Logik |
| **Geschätzte Komplexität** | Mittel |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 6 | >8 → Sub-Pläne |
| Neue Dateien | 1 (`waypointCollapse.js`) | >5 → Sub-Pläne |
| Zu ändernde Dateien | 5 (Sidebar, RouteSegment, HeroSection, StopCard, PointDetail) | >10 → Sub-Pläne |

OK — Defensiv-Guards (3 Files mit je 1 Zeile) blähen den Counter auf, aber jede Datei ist trivial. Kein Sub-Plan-Trigger.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | `point.isWaypoint: boolean` auf jedem Point. | `website/src/model/Point.js` |
| Bestehender Code | `trip.routes`, `trip.points`, `trip.getDistanceBetween(idA, idB)`. | `website/src/model/Trip.js` |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| Plan 07 (NewPointDetection) | Reine Funktion `collapseWaypoints` (eigene Datei) — Plan 07 nutzt nicht direkt, aber das hier definierte Filter-Pattern (`points.filter(p => !p.isWaypoint)`) wird auch in 07 angewandt. | `website/src/model/waypointCollapse.js` |

### Architektur-Entscheidungen
- **Eigene reine Funktion `collapseWaypoints(points, getRouteBetween, getDistanceBetween)`** in neuer Datei `website/src/model/waypointCollapse.js`. Reine Funktion → testbar.
- **Output-Format der Funktion:** geordnete Liste von Items, jedes entweder `{type: 'stop', point}` oder `{type: 'segments', badges: [{mode, distance}, ...]}`. Sidebar iteriert nur einmal drüber.
- **`RouteSegment.jsx` wird auf das neue Format umgestellt:** statt `fromPoint`/`toPoint` nimmt es ein `badges`-Array entgegen und rendert die Badges hintereinander mit den existierenden Dash-Linien dazwischen.
- **Stops-Counter:** filtert Waypoints aus.
- **Thumb-Preload:** filtert Waypoints aus (defensiv — Waypoints haben sowieso keine `titleThumbUrl`).
- **Defensiv-Guards in HeroSection / StopCard / PointDetail:** Plan 04 macht Waypoints schon nicht klickbar; aber falls in Zukunft jemand einen Waypoint per Code dort reinpipet (z.B. Bug in URL-Resolution), soll das Component sauber `null` zurückgeben statt "Untitled" mit leerem Bild zu rendern.

## Voraussetzungen

- [ ] Plan 01 abgeschlossen.

## Betroffene Dateien

### Neue Dateien
| Datei | Beschreibung |
|-------|--------------|
| `website/src/model/waypointCollapse.js` | Reine Funktion `collapseWaypoints(points, trip)`. |

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `website/src/components/Sidebar.jsx` | Iteriert über `collapseWaypoints(...)`-Output statt direkt über `trip.points`. Stops-Counter filtert Waypoints. Thumb-Preload filtert Waypoints. |
| `website/src/components/RouteSegment.jsx` | Akzeptiert `badges`-Array; rendert mehrere Badges sequentiell. Alte Props (`fromPoint`/`toPoint`) entfallen. |
| `website/src/components/HeroSection.jsx` | Defensiv-Guard `if (point.isWaypoint) return null;`. |
| `website/src/components/StopCard.jsx` | Defensiv-Guard. |
| `website/src/components/PointDetail.jsx` | Defensiv-Guard. |

### Zu löschende Dateien/Code
Keine. (Aber: alte Aufrufer-Signatur von `RouteSegment` wird ersetzt.)

## Implementierung

### Schritt 1: `waypointCollapse.js` erstellen

**Datei (neu):** `website/src/model/waypointCollapse.js`

```js
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
```

**Erklärung:**
- Iteriert genau einmal über `points`.
- Sammelt Badges zwischen normalen Points; bei jedem normalen Point werden sie als ein `segments`-Item gepusht und resettet.
- Innerhalb eines `segments`-Items werden gleiche aufeinanderfolgende Modes summiert — daher: A→W (car, 50km) + W→B (car, 30km) = ein Badge `{mode: 'car', distance: 80}`. A→W (car, 50km) + W→B (boat, 20km) = zwei Badges `[{car, 50}, {boat, 20}]`.

### Schritt 2: `RouteSegment.jsx` umstellen

**Datei:** `website/src/components/RouteSegment.jsx`

**Änderung:** Komponente komplett ersetzen — neue Signatur `(badges)` statt `(trip, fromPoint, toPoint)`:

```jsx
import React from 'react';
import { MoveRight } from 'lucide-react';
import { ROUTE_STYLES } from '../model/routeStyles';

/**
 * Renders a sequence of route badges (mode + distance), separated by short dashes.
 * Used for both single segments (legacy: between two stops) and collapsed segments
 * (between two stops with intermediate waypoints).
 */
export default function RouteSegment({ badges }) {
    if (!badges || badges.length === 0) return null;

    return (
        <div className="flex flex-col gap-1">
            {badges.map((badge, idx) => {
                const style = ROUTE_STYLES[badge.mode] || ROUTE_STYLES.misc;
                const Icon = style.icon || MoveRight;
                const distanceLabel = badge.distance < 1
                    ? `${Math.round(badge.distance * 1000).toLocaleString('de-DE')} m`
                    : `${badge.distance.toLocaleString('de-DE')} km`;

                return (
                    <div key={idx} className="flex items-center gap-3 py-1 px-2 my-0">
                        <div className="flex flex-col items-center gap-1 ml-9">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-0.5 h-1.5"
                                    style={{
                                        backgroundColor: style.color,
                                        opacity: style.opacity * 0.6
                                    }}
                                />
                            ))}
                        </div>
                        <div
                            className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-lg flex-1"
                            style={{
                                backgroundColor: `${style.color}10`,
                                color: style.color
                            }}
                        >
                            <Icon size={14} />
                            <span>{distanceLabel}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
```

**Erklärung:**
- Distanzen sind bereits aggregiert (in `collapseWaypoints`) — Komponente macht keinen Lookup mehr.
- Mehrere Badges werden in einer vertikalen Spalte gerendert (genau das gewünschte Verhalten bei Methodenwechsel).

### Schritt 3: `Sidebar.jsx` umstellen

**Datei:** `website/src/components/Sidebar.jsx`

**Änderung a) Stops-Counter** (Zeile 59):
```jsx
{trip.points.filter(p => !p.isWaypoint).length} Stopps
```

**Änderung b) Thumb-Preload** (Zeilen 21-44, der `useEffect`):
```jsx
const urls = trip.points
    .filter(p => !p.isWaypoint)
    .map(p => p.titleThumbUrl)
    .filter(Boolean)
    .reverse();
```

**Änderung c) Render-Loop** (Zeilen 65-98):
```jsx
import { collapseWaypoints } from '../model/waypointCollapse.js';
// ... oben in Imports

// im JSX-Block:
<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-6">
    {(() => {
        const items = collapseWaypoints(trip.points, trip);
        // Index der normalen Stops für Priority + fromEnd-Berechnung
        const normalStops = trip.points.filter(p => !p.isWaypoint);
        const stopIndexById = new Map(normalStops.map((p, i) => [p.id, i]));

        return items.map((item, idx) => {
            if (item.type === 'segments') {
                return <RouteSegment key={`seg-${idx}`} badges={item.badges} />;
            }
            // type === 'stop'
            const point = item.point;
            const stopIndex = stopIndexById.get(point.id);
            const fromEnd = normalStops.length - 1 - stopIndex;
            const priority = fromEnd < 5 ? 'high' : fromEnd < 15 ? 'auto' : 'low';
            const isFirstNew = !foundFirstNew && newPointIds.has(point.id);
            if (isFirstNew) foundFirstNew = true;

            return (
                <div key={point.id} ref={isFirstNew ? firstNewRef : null}>
                    <StopCard
                        point={point}
                        isActive={activeId === point.id}
                        isNew={newPointIds.has(point.id)}
                        priority={priority}
                        onInfoClick={() => onOpenDetail(point.id)}
                        onMapClick={() => onSelectStop(point.id)}
                    />
                </div>
            );
        });
    })()}
</div>
```

**Erklärung:**
- IIFE (`(() => { ... })()`) hält die Logik lokal, ohne extra State/Memoization (Sidebar wird ohnehin nur bei Trip-Änderung neu gerendert).
- `normalStops`/`stopIndexById` ermöglicht weiterhin korrekte Priority-Berechnung (newest-first).
- `RouteSegment` bekommt nur das Badge-Array.

### Schritt 4: `HeroSection.jsx` Defensiv-Guard

**Datei:** `website/src/components/HeroSection.jsx`

Direkt nach dem ersten `if (!point) return null;` (vermutlich Zeile ~5) ergänzen:
```jsx
if (point.isWaypoint) return null;
```

### Schritt 5: `StopCard.jsx` Defensiv-Guard

**Datei:** `website/src/components/StopCard.jsx`

Direkt nach `function StopCard({ point, ... })` öffnender Klammer:
```jsx
if (!point || point.isWaypoint) return null;
```

### Schritt 6: `PointDetail.jsx` Defensiv-Guard

**Datei:** `website/src/components/PointDetail.jsx`

Direkt nach `if (!point) return null;` (vermutlich Zeile ~95):
```jsx
if (point.isWaypoint) return null;
```

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `website/src/components/Sidebar.jsx` | 59 | `{trip.points.length} Stopps` | `{trip.points.filter(p => !p.isWaypoint).length} Stopps` |
| `website/src/components/Sidebar.jsx` | 23-26 | `trip.points.map(p => p.titleThumbUrl).filter(Boolean)` | `.filter(p => !p.isWaypoint).map(...)` |
| `website/src/components/Sidebar.jsx` | 66-97 | `trip.points.map(...) → StopCard + RouteSegment` | `collapseWaypoints(...).map(...)` |
| `website/src/components/Sidebar.jsx` (Imports) | oben | (kein) | `import { collapseWaypoints } from '../model/waypointCollapse.js';` |
| `website/src/components/RouteSegment.jsx` | 5 | `({trip, fromPoint, toPoint})` | `({badges})` — Logik komplett umgestellt. |

---

## Validierung

### Manuelle Tests
- [ ] Normale Reise (kein Waypoint): Sidebar verhält sich identisch zu vorher (Stops-Counter, Cards, Badges zwischen je zwei Cards).
- [ ] Reise mit einem Waypoint zwischen A und B, gleiche Methode (z.B. Auto auf beiden Seiten): Sidebar zeigt A → 1 Badge mit summierter Distanz → B.
- [ ] Reise mit einem Waypoint, unterschiedliche Methode (Auto → Boot): Sidebar zeigt A → Badge "Auto, X km" → Badge "Boot, Y km" → B (untereinander).
- [ ] Reise mit zwei Waypoints, alle drei Methoden gleich: ein einziger summierter Badge.
- [ ] Reise mit zwei Waypoints, Methoden A-B-A: drei Badges (Distanz nicht summiert über Methodenwechsel hinweg).
- [ ] Stops-Counter zählt **nur** normale Punkte, nicht Waypoints.
- [ ] Thumb-Preload-Konsole im Network-Tab: keine Anfragen für Waypoint-`titleThumbUrl` (sind eh `null`/`''`).
- [ ] Browser-Konsole: keine Warnings/Errors.
- [ ] Visueller Test mit alten Daten ohne Waypoint: Sidebar identisch zu vorher.

### Automatisierte Tests
```bash
cd website && npm run build
```

(Optional, falls Vitest aufgesetzt wird:)
```bash
cd website && npx vitest run src/model/waypointCollapse.test.js
```
mit Test-Cases:
- leeres `points` → `[]`
- 1 Point → `[{type:'stop', point}]`
- 2 Points (kein Waypoint) → `[stop, segments[1 badge], stop]`
- A, W, B (gleiche Methode) → `[stop, segments[1 badge mit Summe], stop]`
- A, W, B (unterschiedliche Methode) → `[stop, segments[2 badges], stop]`
- A, W1, W2, B (alle gleich) → `[stop, segments[1 badge], stop]`
- A, W1, W2, B (Methoden A-B-A) → `[stop, segments[3 badges], stop]`

### Erwartetes Verhalten
- Waypoints sind in der Sidebar unsichtbar (keine Card).
- Methodenwechsel an einem Waypoint sind durch mehrere Badges in derselben Gruppe sichtbar.
- Distanzen über mehrere Waypoints mit gleicher Methode werden korrekt addiert.

## Rollback-Plan

1. Sidebar zurück auf direktes `trip.points.map`.
2. RouteSegment zurück auf alte Signatur.
3. Defensiv-Guards entfernen.
4. `waypointCollapse.js` löschen.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
