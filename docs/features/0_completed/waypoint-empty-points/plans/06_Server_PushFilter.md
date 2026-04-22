# Waypoint - Plan 06: Auto-Push-Filter (Server)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Der Auto-Push-Notification-Trigger in `fileserver.js` (Zeilen 849-866) feuert **nur** bei neuen normalen Punkten — nicht bei neu hinzugefügten Waypoints. Sonst würden Abonnenten Notifications mit leerem Body (`name: ''`) bekommen. |
| **Abhängig von** | Plan 01 (Datenmodell — Server liest JSON, das Feld wird transparent durchgereicht) |
| **Betroffene Bereiche** | Server / Notification |
| **Geschätzte Komplexität** | Niedrig |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 1 | >8 → Sub-Pläne |
| Neue Dateien | 0 | >5 → Sub-Pläne |
| Zu ändernde Dateien | 1 | >10 → Sub-Pläne |

OK — minimaler Plan.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | Eingehender JSON-Body von `POST /write` enthält für jeden Punkt das Feld `isWaypoint` (oder es fehlt → `false`-Behandlung beim Filter). | `points.json` Schema |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| — | Nur Verhaltens-Änderung am Server. Keine API-Änderung. | — |

### Architektur-Entscheidungen
- **Filter symmetrisch auf alt + neu:** sowohl `prevPoints` als auch `points` werden gefiltert (`!p.isWaypoint`). Das verhindert auch den Edge-Case, dass ein normaler Punkt zu einem Waypoint umgeklappt würde (kommt im Feature nicht vor, aber defensiv) — würde sonst fälschlich als "verlorener Punkt" gewertet, kein Push (richtig).
- **Strikter Check `=== true`** wie überall: `!(p.isWaypoint === true)` ist äquivalent zu "ist kein Waypoint" (wahr bei `undefined`, `false`, fehlt → normaler Punkt).
- **Keine Schema-Validierung** im Server — er reicht JSON nur durch. Filter ist isoliert auf den Push-Block.

## Voraussetzungen

- [ ] Plan 01 abgeschlossen.

## Betroffene Dateien

### Neue Dateien
Keine.

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `fileserver.js` | Push-Trigger-Block Zeilen 849-866: Filter `!p.isWaypoint` auf `prevPoints` und `points` vor Längenvergleich + Diff. |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: Filter im Push-Trigger einfügen

**Datei:** `fileserver.js`

**Änderung:** Zeilen 849-866 ersetzen durch:

```js
// Auto-notify subscribers only when a new NORMAL point is added to points.json.
// Waypoints (isWaypoint === true) trigger no notification — they have no name
// and would produce empty-body pushes.
if (filePath.endsWith('points.json')) {
    try {
        const points = typeof content === 'string' ? JSON.parse(content) : content;
        if (Array.isArray(points)) {
            const realPrev = prevPoints.filter(p => p.isWaypoint !== true);
            const realNow = points.filter(p => p.isWaypoint !== true);

            if (realNow.length > realPrev.length) {
                const prevIds = new Set(realPrev.map(p => p.id));
                const newPoints = realNow.filter(p => !prevIds.has(p.id));
                const latest = newPoints.reduce((a, b) =>
                    ((b.tripOrder ?? -1) > (a.tripOrder ?? -1) ? b : a), newPoints[0]);
                sendPushToAll({
                    title: 'Jenny hat was Neues gepostet! 🇦🇺',
                    body: latest?.name || 'Schau dir an, wo es als nächstes hingeht!'
                }).catch(err => console.error('Push notify error:', err.message));
            }
        }
    } catch (err) {
        console.error('Push notify check failed:', err.message);
    }
}
```

**Erklärung:**
- `realPrev` und `realNow` enthalten nur normale Punkte.
- Längenvergleich + Diff laufen über die gefilterten Listen — Push feuert nur, wenn ein **normaler** Punkt netto neu ist.
- Waypoint-only-Adds sind unsichtbar für den Push-Trigger.
- `latest?.name || ...`-Fallback bleibt — relevant für sehr alte Daten.

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `fileserver.js` | 849-866 | Push-Trigger ohne Filter | Mit Waypoint-Filter (siehe oben). |

---

## Validierung

### Manuelle Tests
- [ ] App fügt neuen normalen Punkt hinzu → Sync → Server log zeigt Push gesendet, Body = Punktname.
- [ ] App fügt neuen Waypoint hinzu → Sync → Server log zeigt **keine** Push-Nachricht.
- [ ] App fügt einen normalen Punkt **und** einen Waypoint hinzu → Sync → genau **eine** Push-Nachricht mit Name des normalen Punkts (nicht des Waypoints).
- [ ] App reorder existierende Punkte (kein Add) → keine Push.

### Automatisierte Tests
```bash
node -e "require('./fileserver.js')"  # Smoke-test: Server startet
```

(Optional, falls echtes Server-Test-Setup existiert: Mock `sendPushToAll`, simuliere `POST /write` mit verschiedenen `points.json`-Inhalten.)

### Erwartetes Verhalten
- Push feuert nur bei netto-neuen normalen Punkten.
- Kein Push für Waypoint-Adds.
- Bestehende Push-Logik für normale Punkte unverändert.

## Rollback-Plan

1. Filter `realPrev` / `realNow` durch `prevPoints` / `points` zurückersetzen.
2. Server neu starten.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
