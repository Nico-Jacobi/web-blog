# Waypoint - Plan 07: "Neue Punkte"-Erkennung & Slug-Resolution (Website)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | `useTripLoader` ignoriert Waypoints bei der Berechnung von `newPointIds`, `maxOrder` und `firstNew`. `App.jsx` Slug-Resolution überspringt Waypoints (sie haben leeren Title und würden mit leerem Slug fälschlich matchen). |
| **Abhängig von** | Plan 01 (Datenmodell mit `isWaypoint`) |
| **Betroffene Bereiche** | Website / Loader + Routing |
| **Geschätzte Komplexität** | Niedrig |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 2 | >8 → Sub-Pläne |
| Neue Dateien | 0 | >5 → Sub-Pläne |
| Zu ändernde Dateien | 2 | >10 → Sub-Pläne |

OK.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | `point.isWaypoint: boolean`. `Point.title` ist `''` (Leerstring) bei Waypoints (NICHT `'Untitled'`). | `website/src/model/Point.js` |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| — | Verhaltensänderung am Loader/Routing. Keine API-Änderung für andere Pläne. | — |

### Architektur-Entscheidungen
- **`useTripLoader` filtert Waypoints lokal**, ändert aber NICHT `loadedTrip.points` selbst (das wäre destruktiv und würde Plan 04/05 brechen, die Waypoints brauchen). Nur die abgeleiteten Sets/Werte werden auf normalen Punkten berechnet.
- **`localStorage.lastKnownPointOrder`** wird mit dem `maxOrder` der **normalen** Punkte aktualisiert. Wenn jemand nur einen Waypoint hinzufügt, ändert sich `lastKnownPointOrder` nicht — bestehende Besucher sehen keinen Pulse-Ring (richtig).
- **Edge-Case:** Wenn der einzige neue Punkt ein Waypoint ist und `realPoints` leer wird (theoretisch unmöglich, aber defensiv): `Math.max(...[])` liefert `-Infinity` → wir fallen auf `0` zurück.
- **Slug-Resolution:** `slugify('')` ergibt `''`. Ohne Filter würde `resolveSlug('')` einen Waypoint zurückliefern und versuchen, dessen Detail zu öffnen — was in PointDetail durch den Plan-05-Guard zwar abgefangen wird, aber zu kaputten URLs führt. Filter ist sauberer.

## Voraussetzungen

- [ ] Plan 01 abgeschlossen (besonders: `Point.title === ''` bei Waypoints).

## Betroffene Dateien

### Neue Dateien
Keine.

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `website/src/controller/useTripLoader.js` | Filter `realPoints = loadedTrip.points.filter(p => !p.isWaypoint)` vor allen Order/NewIds-Berechnungen. |
| `website/src/App.jsx` | `resolveSlug` filtert Waypoints aus. |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: `useTripLoader.js` — Waypoints aus Order-Berechnung filtern

**Datei:** `website/src/controller/useTripLoader.js`

**Änderung:** Den `then`-Handler (Zeilen 28-47) so ersetzen:

```js
.then(loadedTrip => {
    setTrip(loadedTrip);

    // Waypoints zählen nicht als "Stops" — sie haben keinen Inhalt und
    // sollen weder Pulse-Rings auf der Karte noch Auto-Scroll triggern.
    const realPoints = loadedTrip.points.filter(p => !p.isWaypoint);

    const lastKnown = parseInt(localStorage.getItem('lastKnownPointOrder')) || 0;
    const orders = realPoints.map(p => p.order);
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;
    const newIds = new Set(
        realPoints.filter(p => p.order > lastKnown).map(p => p.id)
    );
    setNewPointIds(newIds);

    const sorted = [...realPoints].sort((a, b) => a.order - b.order);
    const firstNew = sorted.find(p => newIds.has(p.id));
    const target = firstNew || sorted[sorted.length - 1];
    if (target) setInitialActiveId(target.id);

    localStorage.setItem('lastKnownPointOrder', String(maxOrder));
    setupPushNotifications(token);
})
```

**Erklärung:**
- `realPoints` ist eine lokale Variable — `loadedTrip.points` selbst bleibt vollständig (mit Waypoints), damit Sidebar/MapView weiterhin alle Punkte sehen.
- `maxOrder` basiert nur auf normalen Punkten → `lastKnownPointOrder` wird stabil bleiben, wenn nur Waypoints hinzukommen.
- `firstNew`/`target` (für Auto-Scroll) sind Punkte mit Inhalt — niemals ein Waypoint.

### Schritt 2: `App.jsx` — Slug-Resolution Waypoints überspringen

**Datei:** `website/src/App.jsx`

**Änderung:** `resolveSlug` (Zeilen 26-29):

```jsx
const resolveSlug = useCallback((slug) => {
    if (!trip) return null;
    if (!slug) return null;  // NEU: leerer Slug findet nichts (Waypoints haben '')
    return trip.points.find(p => !p.isWaypoint && slugify(p.title) === slug)?.id ?? null;
}, [trip]);
```

`getSlug` (Zeilen 31-35) bleibt funktional unverändert — wenn jemand `getSlug(waypointId)` ruft, käme `slugify('')` = `''` zurück. Defensiv:

```jsx
const getSlug = useCallback((id) => {
    if (!trip) return null;
    const point = trip.getPoint(id);
    if (!point || point.isWaypoint) return null;  // NEU
    return slugify(point.title);
}, [trip]);
```

**Erklärung:**
- `if (!slug) return null` verhindert, dass ein leerer Pfad alle Waypoints matcht (würde sonst den ersten zurückgeben).
- `!p.isWaypoint`-Filter ist die eigentliche Sicherung — `slugify('')` ist `''` und würde ohne Filter einen Waypoint matchen, sobald `slug === ''` ist (was bereits durch obigen Check abgefangen ist, aber Doppelt sicher ist sinnvoll).
- `getSlug` gibt für Waypoints `null` zurück → URL-Updates für Waypoints (kommen ohnehin nicht vor, weil sie nicht klickbar sind) wären sauber kein-op.

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `website/src/controller/useTripLoader.js` | 32-45 | `loadedTrip.points` für `orders`/`newIds`/`firstNew` | `loadedTrip.points.filter(p => !p.isWaypoint)` |
| `website/src/App.jsx` | 28 | `trip.points.find(p => slugify(p.title) === slug)` | `trip.points.find(p => !p.isWaypoint && slugify(p.title) === slug)` |
| `website/src/App.jsx` | 31-35 | `getSlug` ohne Waypoint-Check | Mit Waypoint-Check (return null). |

---

## Validierung

### Manuelle Tests
- [ ] App-Sync fügt nur einen Waypoint hinzu → Browser neu laden → keine Pulse-Rings, keine "Neu"-Badges, kein Auto-Scroll zu Waypoint-Position.
- [ ] App-Sync fügt einen normalen Punkt + einen Waypoint hinzu → nur der normale Punkt bekommt Pulse-Ring + "Neu"-Badge; Auto-Scroll geht zum normalen Punkt.
- [ ] URL `/punkt/sydney` (oder vergleichbar) öffnet weiterhin die Sidebar zur Sydney-Card.
- [ ] URL mit leerem Slug `/punkt/` (oder Pfadfehler) führt nicht versehentlich zu einem Waypoint-Detail.
- [ ] `lastKnownPointOrder` in localStorage nach reinem Waypoint-Sync unverändert.

### Automatisierte Tests
```bash
cd website && npm run build
```

### Erwartetes Verhalten
- Waypoints sind in der "neue Punkte"-Logik unsichtbar.
- Slug-Resolution funktioniert nur über normale Punkte.

## Rollback-Plan

1. `realPoints`-Variable entfernen, zurück auf `loadedTrip.points`.
2. Slug-Filter in `App.jsx` entfernen.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
