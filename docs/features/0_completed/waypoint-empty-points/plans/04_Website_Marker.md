# Waypoint - Plan 04: Kleine graue Waypoint-Marker (Website)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Waypoints werden auf der Karte als kleine, unauffällige graue Marker (~6px, `#9CA3AF`) gezeichnet — ohne Popup, ohne Hover/Click-Handler, ohne Eintrag in `markersRef`. Sie werden auch nicht von `findClosestMarker` gefunden (Klicks rutschen durch). |
| **Abhängig von** | Plan 01 (Datenmodell) |
| **Betroffene Bereiche** | Website / Map-Rendering |
| **Geschätzte Komplexität** | Niedrig |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 4 | >8 → Sub-Pläne |
| Neue Dateien | 0 | >5 → Sub-Pläne |
| Zu ändernde Dateien | 2 | >10 → Sub-Pläne |

OK.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | `point.isWaypoint: boolean` auf Point-Instanzen verfügbar | `website/src/model/Point.js` |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| Plan 05 (Sidebar) | Implizit: Klicks auf Waypoint-Marker öffnen keine StopCard (weil `findClosestMarker` sie überspringt). Plan 05 muss sich nicht darum kümmern. | — |

### Architektur-Entscheidungen
- **Keine Popup-Bindung für Waypoints** — `bindPopup` und `marker.on('click'/'mouseover'/'popupopen')` nur bei normalen Points.
- **Nicht in `markersRef` aufnehmen** — damit `setupClickHandler` sie nicht findet und weitere Selektions-Logik (z.B. `onSelectStop`) nie für Waypoints feuert.
- **`findClosestMarker`-Filter**: zusätzlicher Guard in `mapHelpers.js:144`, damit auch dort Waypoints nicht als "closestStop" zurückkommen (Defense-in-Depth — ohne Eintrag in `markersRef` wird in `setupClickHandler` sowieso kein Marker gefunden, aber der Filter macht die Funktion konsistent/robust, falls in Zukunft jemand die `markersRef`-Bedingung ändert).
- **Neue Helper-Funktion `buildWaypointMarkerHtml()`** neben `buildMarkerHtml` — keine Signatur-Erweiterung (klarer).
- **Kein Pulse-Ring** für Waypoints, selbst wenn neu. (In Plan 07 wird `newPointIds` sowieso so gefiltert, dass Waypoint-IDs nie drin landen — zusätzlicher Schutz hier, falls doch.)

## Voraussetzungen

- [ ] Plan 01 abgeschlossen.

## Betroffene Dateien

### Neue Dateien
Keine.

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `website/src/components/mapHelpers.js` | Neue Funktion `buildWaypointMarkerHtml()`; `findClosestMarker` filtert Waypoints aus. |
| `website/src/components/MapView.jsx` | `addPointMarkers` branch für Waypoints (minimaler Marker, keine Handler, nicht in `markersRef`). |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: `buildWaypointMarkerHtml` hinzufügen

**Datei:** `website/src/components/mapHelpers.js`

**Änderung:** Direkt unter `buildMarkerHtml` (Zeile 125-134) neue Funktion:

```js
export function buildWaypointMarkerHtml() {
    return `<div style="width:10px; height:10px; display:flex; align-items:center; justify-content:center;">
                <div style="background:#9CA3AF; width:6px; height:6px; border-radius:50%; border:1px solid #fff; opacity:0.75;"></div>
            </div>`;
}
```

**Erklärung:**
- Kleine Marker-Box (10×10px gesamt) damit Leaflet's `iconSize` stimmt.
- Grauer Punkt (6px) mit dünnem weißem Rand für Kontrast, 75% Opacity → dezent.
- Kein Pulse-Ring, keine Variante für "neu".

### Schritt 2: `findClosestMarker` — Waypoints überspringen

**Datei:** `website/src/components/mapHelpers.js`

**Änderung:** Zeilen 144-152 (der `trip.points.forEach`-Block in `findClosestMarker`):

```js
trip.points.forEach(point => {
    if (!point.lat || !point.lng) return;
    if (point.isWaypoint) return;  // NEU: Waypoints nicht für Klick-Snapping berücksichtigen
    const px = map.latLngToContainerPoint([point.lat, point.lng]);
    const dist = px.distanceTo(containerPoint);
    if (dist < closestStopDist) {
        closestStopDist = dist;
        closestStop = point;
    }
});
```

**Erklärung:** Auch wenn Waypoints nicht in `markersRef` sind, könnte die Point-Liste Treffer liefern — und der aufrufende Code in `setupClickHandler` würde dann `markersRef.current[hit.target.id]` prüfen, was `undefined` ergibt → kein harter Fehler, aber Klick bleibt wirkungslos (gut). Mit diesem Filter ist die Funktion aber semantisch sauber.

### Schritt 3: `addPointMarkers` — Waypoints separat behandeln

**Datei:** `website/src/components/MapView.jsx`

**Änderung:** Die Funktion `addPointMarkers` (Zeile 153-185) komplett ersetzen:

```js
function addPointMarkers(L, map, trip, newPointIds, markersRef, mapInteractionRef, onSelectStop, onOpenDetail) {
    trip.points.forEach(point => {
        if (!point.lat || !point.lng) return;

        if (point.isWaypoint) {
            // Kleiner grauer Marker — kein Popup, kein Handler, nicht in markersRef
            L.marker([point.lat, point.lng], {
                zIndexOffset: 500,  // unter den normalen Markern (1000)
                interactive: false,  // ignoriert Maus-Events komplett
                icon: L.divIcon({
                    className: 'waypoint-marker',
                    html: buildWaypointMarkerHtml(),
                    iconSize: [10, 10],
                    iconAnchor: [5, 5]
                })
            }).addTo(map);
            return;
        }

        const marker = L.marker([point.lat, point.lng], {
            zIndexOffset: 1000,
            icon: L.divIcon({
                className: 'custom-marker',
                html: buildMarkerHtml(newPointIds.has(point.id)),
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            })
        }).addTo(map);

        marker.on('click', (e) => {
            mapInteractionRef.current = true;
            L.DomEvent.stopPropagation(e);
        });
        marker.on('mouseover', function () {
            mapInteractionRef.current = true;
            this.openPopup();
        });
        marker.on('popupopen', () => { onSelectStop(point.id); });

        marker.bindPopup(createPopupContent(point, point.titleThumbUrl, onOpenDetail), {
            closeButton: false,
            className: 'modern-popup',
            autoPan: false
        });

        markersRef.current[point.id] = marker;
    });
}
```

Neuer Import oben in `MapView.jsx` (falls `buildWaypointMarkerHtml` nicht schon durch eine Wildcard-Import reinkommt):

Prüfen: Aktuelle Imports in `MapView.jsx` schauen — gibt es `import { buildMarkerHtml, ... } from './mapHelpers.js'`? Falls ja, `buildWaypointMarkerHtml` dort ergänzen.

**Erklärung:**
- `interactive: false` ist der Leaflet-Weg, den Marker komplett klick-unfähig zu machen — keine Hover-Events, keine Klick-Events, kein Pointer-Cursor.
- `zIndexOffset: 500` sorgt dafür, dass normale Marker (mit 1000) bei Überlappung oben liegen.
- **Kein `markersRef.current[point.id] = marker`** → damit `setupClickHandler` diese Marker nie findet.

### Schritt 4: Visueller Smoke-Test

Nach Implementation:
- Manuell `website/public/data/points.json` so editieren, dass einer der Punkte `"isWaypoint": true` hat (plus leere sonstige Felder).
- `npm run dev` starten → Karte öffnen → kleiner grauer Punkt an der Waypoint-Koordinate sichtbar.
- Klick auf den grauen Punkt tut nichts (kein Popup, keine Sidebar-Scroll).
- Klick knapp daneben (auf der Route) öffnet auch keine Waypoint-Details (nur wenn ein **normaler** Marker in der Nähe ist, rastet das ein).
- Route-Linien laufen **über** den Waypoint (Plan 4 ändert nichts an `drawRoutes`).

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `website/src/components/MapView.jsx` | 153-185 | `addPointMarkers` ohne Waypoint-Branch | Mit Waypoint-Branch (siehe oben). |
| `website/src/components/MapView.jsx` (Imports) | oben | `import { buildMarkerHtml, ... }` | `import { buildMarkerHtml, buildWaypointMarkerHtml, ... }` |

---

## Validierung

### Manuelle Tests
- [ ] In Browser-Dev-Tools `window.trip?.points` prüfen — ein Waypoint-Point hat `isWaypoint: true`.
- [ ] Grauer 6px-Punkt an Waypoint-Position sichtbar.
- [ ] Hover auf Waypoint: kein Cursor-Change, kein Popup.
- [ ] Klick auf Waypoint: nichts passiert (keine Sidebar-Scroll, keine URL-Änderung).
- [ ] Normale Marker (orange) verhalten sich wie bisher: Hover öffnet Popup, Klick öffnet Popup.
- [ ] Alte `points.json` ohne `isWaypoint` → alle Punkte orange wie bisher.

### Automatisierte Tests
```bash
cd website && npm run build
```

### Erwartetes Verhalten
- Waypoints sind auf der Karte findbar (visuell) aber nicht interaktiv.
- Keine Regression für normale Punkte.

## Rollback-Plan

1. `buildWaypointMarkerHtml` entfernen.
2. Waypoint-Filter in `findClosestMarker` entfernen.
3. `addPointMarkers` auf Original zurückrollen.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
