# Waypoint (Leere Routenpunkte) - Masterplan

## Status
- [x] Phase 1: Masterplan (in Arbeit)
- [ ] Phase 1b: Impact-Analyse
- [ ] Phase 2: Implementierungspläne
- [ ] Phase 2b: Sub-Pläne (falls nötig)
- [ ] Implementierung gestartet
- [ ] Cleanup-Validierung
- [ ] Feature abgeschlossen

## 1. Ziel

**Was soll erreicht werden?**
Einführung eines neuen Punkt-Typs "Waypoint" — ein leerer Routenpunkt, der **nur Koordinaten** trägt (kein Name, keine Bilder, keine Beschreibung, kein Datum). Diese Waypoints dienen ausschließlich dazu, die Route auf der Karte realistisch nachzuzeichnen und als Anker für **Transportmittel-Wechsel** zu fungieren (z.B. "bis hier Auto, ab hier Boot"). Sie sollen den Verlauf verfeinern, ohne die Erzählung (Sidebar, Gallerien) mit inhaltslosen Stops zu überfrachten.

**Anwendungsfall:**
- Nutzer fährt mit dem Auto von Sydney bis zu einem Hafen, nimmt dann die Fähre, fährt auf der anderen Seite wieder mit dem Auto weiter — der Hafen selbst ist kein erzählenswerter Stop, aber ohne ihn würde die Routenlinie quer durchs Wasser oder über Land gehen.
- Nutzer will eine kurvige Straßenführung zwischen zwei Highlights besser abbilden, indem er zwei leere Punkte als Wegpunkte einfügt.
- Nutzer markiert einen Umstieg (Flughafen → Taxi → Hotel) mit leeren Wegpunkten.

## 2. Ist-Zustand

**Aktuelle Implementierung:**
Das Datenmodell kennt nur einen Punkttyp: `InterestPoint` mit Name, Bildern, Beschreibung, Koordinaten und `tripOrder`. Zwischen aufeinanderfolgenden Punkten existiert genau ein `TripElement` mit einer `TripMethod`. Die Website rendert **jeden** Punkt als orangenen Marker und **jeden** Punkt als Card in der Sidebar. Die App zeigt jeden Punkt in der Manage-Points-Liste mit voller Edit-Card.

**Probleme mit aktuellem Ansatz:**
- Um ein Transportmittel mitten auf der Strecke zu wechseln, muss aktuell ein "Fake-Punkt" mit Dummy-Name/-Bild angelegt werden — das verwässert die Erzählung und wirkt unprofessionell.
- Routenlinien (OSRM) verlaufen manchmal unplausibel, weil keine Zwischenpunkte gesetzt werden können, ohne einen vollwertigen Stop zu erzeugen.
- Auf der Sidebar erscheinen diese Fake-Punkte als vollwertige Karten und stören den Lesefluss.

**Relevante Dateien:**
- `flutter_app/lib/model/interest_point.dart` — Datenmodell (alle Felder pflichtmäßig strukturiert).
- `flutter_app/lib/model/trip.dart` — `TripElement` (verbindet zwei Point-IDs mit `TripMethod`).
- `flutter_app/lib/pages/manage_points_page.dart` — Listenverwaltung, Reorder, TripMethod-Änderung.
- `flutter_app/lib/pages/create_point_page.dart` — Dialog zum Anlegen eines Punktes.
- `flutter_app/lib/services/storage_service.dart` / `sync_service.dart` — Lokale Persistenz + Server-Sync.
- `website/src/model/Point.js` — Point-Klasse im Browser, lädt JSON.
- `website/src/model/Trip.js` — Trip-Singleton, Distanz-Berechnung, `getRouteBetween()`.
- `website/src/components/mapHelpers.js` — Marker-HTML (orange `#F97316`, Zeile 125-134), `drawRoutes()`, `findClosestMarker()`.
- `website/src/components/Sidebar.jsx` — Rendert StopCard + RouteSegment alternierend (Zeilen 65-98).
- `website/src/components/RouteSegment.jsx` — Route-Badge zwischen zwei Points.
- `website/src/controller/routingService.js` — OSRM + Great-Circle, segmentweise pro TripElement.
- `fileserver.js` — `GET /files/data/points.json`, `POST /write`, `POST /routes` (Routen-Cache), Auto-Push bei neuen Punkten.

## 3. Soll-Zustand

**Gewünschtes Verhalten:**
Ein **Waypoint** ist ein `InterestPoint` mit dem zusätzlichen Flag `isWaypoint: true`. Er hat nur `lat`, `lon`, `tripOrder`, `id` und das Flag — alle anderen Felder sind leer/null und werden in der UI nie angezeigt. Er nimmt vollwertig am `TripElement`-Graphen teil: vor und nach ihm können unterschiedliche `TripMethod`s liegen.

**User Flow (App):**
1. Nutzer öffnet Manage-Points-Page.
2. Unter/neben dem bestehenden "+ Punkt hinzufügen" Button gibt es einen "+ Wegpunkt hinzufügen" Button.
3. Nutzer kann Wegpunkt per Map-Tap **oder** manuell per Koordinaten-Eingabe erstellen (beides muss gehen — kein voller Create-Point-Dialog, nur minimales Formular/Map-Picker).
4. Wegpunkt erscheint als kompakte Card in der Liste: Label "Wegpunkt", Koordinaten, Reorder-Handle, Delete-Button, keine Bilder. Kein Tap-auf-Card-öffnet-Editor — stattdessen nur ein "Position ändern"-Button.
5. Reorder und TripMethod-Änderung funktionieren identisch wie bei normalen Punkten (die TripElement-Logik ist agnostisch gegenüber dem Punkttyp).

**User Flow (Website):**
1. Besucher öffnet die Seite.
2. Auf der Karte erscheinen normale Punkte als große orange Marker (unverändert). **Waypoints erscheinen als kleine graue unauffällige Marker** (ca. 6px, neutralgrau), damit der Eigentümer sie zum Wiederfinden sieht, aber Besucher sie nicht als inhaltlichen Stop interpretieren.
3. Klick auf Waypoint-Marker: **kein Popup**, kein Detail-Panel — der Marker ist rein visuell.
4. Routenlinien auf der Karte verlaufen über den Waypoint wie bei jedem anderen Punkt (Farbe/Stil entsprechen der jeweiligen `TripMethod` des Segments — daher ist der Methodenwechsel visuell an der Farbänderung der Polyline erkennbar).
5. Sidebar-Liste: Waypoints erscheinen **nicht** als StopCard. Route-Segmente werden so dargestellt:
   - Normale Reihenfolge: `StopCard(A) → RouteSegment → StopCard(B) → RouteSegment → StopCard(C)`.
   - Mit Waypoint W zwischen A und B: Waypoint W entfällt als Card, aber die **Route-Segmente** A→W und W→B werden angezeigt. **Wenn beide dieselbe `TripMethod` haben, werden sie zu einem einzigen Badge zusammengefasst** (Distanzen addiert). **Wenn sie unterschiedliche Methoden haben, erscheinen beide Badges hintereinander** — genau so wird der Methodenwechsel sichtbar.
   - Mehrere aufeinanderfolgende Waypoints kollabieren analog.
6. `getTotalDistance()` und `getDistanceBetween()` zählen Waypoints mit (damit die Gesamtstrecke korrekt bleibt).

**Technische Anforderungen:**
- **Backward-Kompatibilität (hart):** Alte `points.json`/`trips.json` **ohne** `isWaypoint`-Feld muss in neuen Apps und auf der neuen Website weiterhin **fehlerfrei** funktionieren. Fehlendes Feld = `false` (normaler Punkt).
- Forward-Kompatibilität (Website mit alten App-Daten): muss funktionieren (Standard-Anforderung).
- **Nicht nötig:** Alte Apps mit neuen Daten — alte App-Versionen dürfen ignoriert werden.
- Performance: Marker-Rendering und Sidebar-Kollabierung müssen auf Listen mit 200+ Punkten flüssig bleiben.
- Bundle-Größe: Kein signifikanter Anstieg (die Änderung ist rein logisch).

## 4. Architektur-Entscheidungen

### Datenmodell

**Neues Feld in `InterestPoint` (Flutter) und `Point` (Website):**
- `isWaypoint: bool` (Flutter) / `isWaypoint: boolean` (JS) — optional, default `false`.

**JSON-Schema (erweitert, backward-kompatibel):**
```json
{
  "id": 42,
  "name": "",
  "shortDescription": "",
  "titleImagePath": "",
  "otherImagePaths": [],
  "lat": -33.85,
  "lon": 151.21,
  "date": null,
  "description": "",
  "tripOrder": 5,
  "isWaypoint": true
}
```
Beim Parsen: `isWaypoint: json['isWaypoint'] ?? false`. Beim Schreiben: Feld immer serialisieren (auch wenn `false` — konsistenter Output, kleine Datei).

**Begründung gegen implizite Erkennung** (z.B. "name leer && kein Bild"): fragil, verletzt Single-Source-of-Truth, und würde bei zufällig leeren Feldern regulärer Punkte falsch greifen.

**TripElement bleibt unverändert.** Die Graph-Struktur ist agnostisch — ein TripElement verbindet zwei `id`s, egal welchen Typs.

### Kommunikation Frontend-Backend

Unverändert. Der Server speichert die JSON-Dateien roh. Er muss lediglich das neue Feld **durchreichen**, ohne es zu verlieren. Route-Cache (`routes-cache.json`) ist bereits koordinatenbasiert (`lat,lng;lat,lng;profile` als Key) und funktioniert für Waypoints automatisch.

**Auto-Push bei neuen Punkten** (`fileserver.js` Zeilen 849-866): muss angepasst werden — Waypoints dürfen **keine** Push-Notification auslösen (sie haben keinen Namen, und der Nutzer würde nicht wollen, dass Abonnenten für ein leeres Koordinatenpaar benachrichtigt werden). Filterung: nur `isWaypoint !== true` zählt als "neuer Punkt für Notification".

### Rendering-Strategie Website

**Marker (`mapHelpers.js`):**
- `buildMarkerHtml()` bekommt einen Parameter oder wird gespaltet: für Waypoints → kleinerer Marker ohne pulsierenden Ring, neutralgraue Farbe (z.B. `#9CA3AF`), Durchmesser ~6px.
- Klick-Handler: für Waypoints deaktiviert (kein Popup, nicht in `findClosestMarker()` einbeziehen oder mit hohem Radius-Threshold — Entscheidung: **nicht einbeziehen**, da Besucher keinen Detail-Inhalt zu sehen bekommen würden).
- Bild-GPS-Marker (orange, Zeilen 58-123) sind davon **nicht betroffen** — Waypoints haben sowieso keine Bilder.

**Sidebar-Kollabierung (`Sidebar.jsx`):**
Vor dem Rendern wird aus der Point-Liste eine **Segment-Liste** berechnet:
1. Iteriere Points in `tripOrder`-Reihenfolge.
2. Teile die Liste in Gruppen: jeder normale Punkt ist ein "Anker", dazwischen liegende Waypoints werden in das folgende Segment eingeordnet.
3. Für jedes Segment zwischen Anker A und Anker B: sammle alle TripElements entlang des Pfades (A→W1, W1→W2, W2→B). Wenn **alle** TripElements dieselbe `TripMethod` haben → **ein** zusammengefasster Badge (Distanz = Summe). Wenn sich die Methode ändert → **mehrere** Badges nacheinander (jeweils mit der konstanten Teilstrecke und dem eigenen Mode).
4. Gerendert wird: `StopCard(A) → [Badge(s) für Segment] → StopCard(B) → ...`.

Diese Logik lebt idealerweise in einer reinen Funktion (z.B. `collapseWaypoints(points, trips)` in einem neuen Helper in `website/src/model/` oder als Methode auf `Trip`).

**Distanz-Logik (`Trip.js`):**
- `getTotalDistance()` bleibt unverändert (summiert alle TripElements — stimmt automatisch).
- `getDistanceBetween(fromId, toId)` bleibt als primitive Operation. Ein neuer Helper `getCollapsedSegments()` liefert der Sidebar aggregierte Badges.

### Rendering-Strategie App (Manage Points)

`manage_points_page.dart` zeigt aktuell für jeden Punkt ein `point_with_route_card`. Für Waypoints → eigene kompakte Variante (eigene Card-Komponente oder Conditional im bestehenden Widget, je nach Größe der Änderung). Reorder-Logik (`_reorderPointsWithRoutes()`) **unverändert**, da sie IDs manipuliert, nicht Typen.

### Erstellung (App)

Zwei Einstiegspunkte:
- **Manage-Points-Page:** "+ Wegpunkt hinzufügen" Button → kleiner Dialog mit zwei Optionen: "Auf Karte setzen" (öffnet Map-Picker) oder "Koordinaten eingeben" (zwei Textfelder lat/lon).
- Der bestehende `create_point_page.dart` wird **nicht** für Waypoints verwendet — Waypoints brauchen keinen Bild-Upload/Text-Eingabe-UX. Stattdessen ein dedizierter minimaler Flow.

**Map-Picker:** falls die App noch keinen generischen Map-Picker hat → neue kleine Page mit `flutter_map` (Package vermutlich bereits im Projekt, muss verifiziert werden in der Recherche-Phase).

### Caching-Strategie

Server `routes-cache.json` funktioniert automatisch (koordinatenbasiert). Website-Routing-Cache (in-memory in `routingService.js`) ebenfalls.

## 5. Beachtenswertes

### Performance

- Sidebar-Kollabierung ist O(n) über Points + O(m) über TripElements — vernachlässigbar.
- Marker-Rendering: Waypoint-Marker sind kleiner und brauchen kein Popup-HTML → **schneller** als normale Marker.
- Keine zusätzlichen Netzwerk-Requests.

### Sicherheit

- Keine neuen User-Inputs außer lat/lon (bereits validiert im bestehenden Flow).
- JSON-Schema erweitert, aber Server macht keine Schema-Validierung → keine Serverseitige Änderung außer der Push-Filter-Logik (Sektion 4).

### Migration

- **Keine aktive Migration nötig.** Fehlendes `isWaypoint` = `false` — alte Daten funktionieren ohne Änderung.
- Einmal-Export: falls der Nutzer rückwirkend bestehende "Dummy-Punkte" zu Waypoints konvertieren will, passiert das manuell über die UI (nicht Teil des Features).

### Edge Cases

- **Erster oder letzter Punkt ist Waypoint:** technisch erlaubt, aber semantisch fragwürdig (Reise startet mit leerem Punkt?). → Wir erlauben es und verlassen uns auf Nutzer-Verantwortung; Sidebar rendert dann am Anfang/Ende nur Route-Badges, was unschön, aber tolerierbar ist. Alternative: UI-Hinweis ("Der erste/letzte Punkt sollte kein Wegpunkt sein"). **Entscheidung: keine Hard-Validation, nur optionaler Hint in der Create-Action.**
- **Nur Waypoints, keine normalen Punkte:** Sidebar wäre leer — Kartenansicht zeigt trotzdem Route. Toleriert, kein Extra-Handling.
- **Zwei aufeinanderfolgende Waypoints mit **unterschiedlichen** TripMethods**: Sidebar zeigt drei Badges hintereinander (die Methoden der drei TripElements). Korrekt laut Anforderung.
- **Reorder eines Waypoints** über einen normalen Punkt hinweg: bestehende `_reorderPointsWithRoutes()` regelt das — TripElements werden neu verknüpft.

## 6. Abhängigkeiten

**Voraussetzungen:**
- Keine. Das Feature baut rein additiv auf bestehenden Strukturen auf.

**Betroffene Features:**
- **Auto-Push-Notifications** (`fileserver.js` Zeilen 849-866) — muss Waypoints ausfiltern.
- **"Neue Punkte" Erkennung auf der Website** (`useTripLoader.js`, `lastKnownPointOrder` in localStorage): falls ein Waypoint den `tripOrder` hochtreibt, würde ein Besucher fälschlich "neue Stops!" sehen. → Muss Waypoints beim Zählen überspringen.
- **Bild-GPS-Marker** (nicht betroffen, nur Vollständigkeit).

**Externe Abhängigkeiten:**
- Vermutlich keine neuen Packages (flutter_map sollte bereits vorhanden sein; in Recherche-Phase verifizieren).

## 7. Nicht-Ziele

**Explizit NICHT Teil dieses Features:**
- Konvertierung zwischen normalem Punkt und Waypoint nach Erstellung (wer umdenken will, löscht und legt neu an).
- Import/Export von GPX-Tracks als Massenimport von Waypoints.
- Besucher-sichtbare Interaktion mit Waypoints (keine Popups, keine Detail-Panels).
- Unterschiedliche Waypoint-Typen (nur ein einziger Flag-basierter Typ).
- Anpassung alter Apps an das neue Schema (alte Apps dürfen brechen).

**Spätere Erweiterungen (out of scope):**
- GPX-Import.
- Admin-Modus auf der Website, der Waypoints größer/klickbar macht.
- Automatisches Routen-Glätten, das Waypoints vorschlägt.

## 8. Offene Fragen

- [ ] Ist `flutter_map` (oder ein anderes Map-Package) bereits in `flutter_app/pubspec.yaml` eingebunden? → **In Recherche-Phase zu klären** vor Erstellung des Map-Picker-Plans.
- [ ] Sollen Waypoint-Marker auf der Website nur bei eingeloggtem Admin sichtbar sein? → **Aktuell: nein, für alle sichtbar** (laut Nutzer-Entscheidung: "klein und unauffällig, damit man sie findet zum Bearbeiten"). Falls sich später herausstellt, dass Besucher verwirrt sind, nachträglich gated machen.
- [ ] Soll es eine visuelle Anzeige in der Sidebar geben, wenn ein Methodenwechsel über einen Waypoint stattfindet (z.B. subtiles Icon)? → **Aktuell: nein**, die zwei verschiedenen Badges sind die Anzeige.

---

## 9. Was muss weg (Impact-Analyse)

> **Hinweis:** Diese Sektion wird vom `impact-analyzer` Agent automatisch befüllt.

### 9.1 Zu löschende Dateien

Keine — Feature ist additiv, keine Datei wird komplett gelöscht.

### 9.2 Zu löschender Code (Methoden, Klassen, Funktionen)

Keine ganzen Funktionen / Klassen werden entfernt. Alle Änderungen sind Erweiterungen oder lokale Conditionals innerhalb bestehender Funktionen (Marker-Erzeugung, Sidebar-Iteration, Push-Filter, Order-Zählung). Falls eine neue reine Helper-Funktion `collapseWaypoints(points, trips)` (siehe Sektion 4) eingeführt wird, könnten dadurch indirekt nur die unmittelbaren `index < trip.points.length - 1`-Iteration in `Sidebar.jsx` (Zeilen 66-97) und das direkte Mapping `points → StopCard + RouteSegment` ersetzt werden — siehe 9.3.

### 9.3 Veraltete Patterns die ersetzt werden
| Altes Pattern | Neues Pattern | Betroffene Stellen |
|---------------|---------------|-------------------|
| `buildMarkerHtml(isNew)` erzeugt für **jeden** Punkt einen orangenen 14-px-Dot ohne Verzweigung nach Punkttyp. | Conditional / zweite Variante: für `point.isWaypoint` → kleiner grauer (`#9CA3AF`) ~6-px Marker ohne Pulse-Ring; sonst wie bisher. | `website/src/components/mapHelpers.js:125-134` (`buildMarkerHtml`); Aufrufer `website/src/components/MapView.jsx:161` (`addPointMarkers`). |
| Marker-Erzeugung in `addPointMarkers` weist **jedem** Punkt Popup, Click-/Hover-Handler, `bindPopup(createPopupContent(...))` und Eintrag in `markersRef.current` zu. | Für Waypoints: keinen Popup binden, keinen Hover-/Klick-Handler registrieren, **nicht** in `markersRef` aufnehmen (damit `findClosestMarker` sie nicht findet). | `website/src/components/MapView.jsx:153-185`. |
| `findClosestMarker()` iteriert über `trip.points` und kann jeden Punkt als `closestStop` zurückgeben. | Waypoints überspringen (`if (point.isWaypoint) return;`), damit Klick auf einen kleinen grauen Marker keinen Stop selektiert. | `website/src/components/mapHelpers.js:144-152`. |
| `Sidebar.jsx` mappt 1:1 `trip.points → StopCard + RouteSegment` (`{trip.points.map((point, index) => ... <StopCard /> ... <RouteSegment fromPoint={point} toPoint={trip.points[index + 1]} />)`); auch der Stops-Counter `{trip.points.length} Stopps` zählt jeden Punkt. | Vorher kollabieren: `collapseWaypoints(trip.points, trip.routes)` liefert eine Liste aus Anker-Points + dazwischen liegenden Badge-Gruppen (gleicher TripMethod summiert, sonst mehrere Badges). Counter zählt nur `points.filter(p => !p.isWaypoint).length`. | `website/src/components/Sidebar.jsx:59` (Counter), `:23-26` (Thumb-Preload — nur normale Points), `:66-97` (Render-Loop). |
| `RouteSegment` rendert genau **ein** Badge zwischen genau **zwei benachbarten** Points anhand `trip.getRouteBetween(fromPoint.id, toPoint.id)` und `trip.getDistanceBetween`. | Aufrufer rendert (für jedes kollabierte Segment) eine geordnete Liste von einem oder mehreren Badges; entweder Komponente erweitern oder neue `RouteSegmentGroup` schaffen, die mit pre-aggregierten `{mode, distance}` arbeitet. | `website/src/components/RouteSegment.jsx:5-43` (gesamt). |
| `useTripLoader.js`: `maxOrder = Math.max(...orders)` und `newIds` werden über **alle** Points berechnet — Waypoint mit hohem `tripOrder` würde fälschlich als neuer Stop signalisiert (Pulse-Ring + "Neu"-Badge). | Vor Berechnung filtern: `loadedTrip.points.filter(p => !p.isWaypoint)` für `newIds`/`maxOrder`. `firstNew`-Auswahl ebenfalls aus dieser Liste. | `website/src/controller/useTripLoader.js:32-45`. |
| `fileserver.js` Push-Trigger: `if (points.length > prevPoints.length)` löst sofort Push aus; `latest` wird per höchstem `tripOrder` ermittelt — würde auch für Waypoint-only-Adds feuern (mit leerem `name`). | Filter: vergleiche `points.filter(p => !p.isWaypoint).length > prevPoints.filter(p => !p.isWaypoint).length`; `newPoints` ebenfalls auf nicht-Waypoint einschränken. | `fileserver.js:849-866`. |
| `manage_points_page.dart` rendert für **jeden** Punkt `PointWithRouteCard` (großer Card mit Thumbnail, Name, Datum) und ruft `_editPoint` per Tap auf, was `AddInterestPointPage` mit voller Form öffnet. | Conditional: für `point.isWaypoint` → kompakte Waypoint-Card-Variante (Label "Wegpunkt", Koordinaten, Reorder-Handle, Delete + "Position ändern"-Button), Tap öffnet **nicht** den vollen Editor. | `flutter_app/lib/pages/manage_points_page.dart:333-362` (itemBuilder), `flutter_app/lib/widgets/point_with_route_card.dart` (komplett). |
| `point_with_route_card.dart` setzt das Thumbnail per `point.titleImagePath.isNotEmpty` und liest `point.name`/`point.date` als gegeben — bei Waypoint wären alle leer und der Card würde nur "Unnamed" + leeres Bild zeigen (verwirrend). | Eigenes Waypoint-Layout (eigenes Widget oder Conditional Branch im selben Widget) — für Waypoint zeigt Card nur Lat/Lon, "Wegpunkt"-Label und einen kleinen Map-Pin-Icon statt Thumbnail. | `flutter_app/lib/widgets/point_with_route_card.dart:189-258` (Thumbnail + PointInfo). |
| `create_point_page.dart` erzwingt `_titleImage == null` → Save-Block mit Snackbar (`error_title_image_required`) — würde verhindern dass Waypoint überhaupt entstehen kann, wenn er versehentlich durch diese Page liefe. | Waypoint-Flow geht **nie** durch `AddInterestPointPage` (eigener minimaler Flow per Map-Picker oder Lat/Lon-Dialog). Sicherstellen, dass Manage-Page für `isWaypoint`-Cards nicht auf `_editPoint` ruft. | `flutter_app/lib/pages/create_point_page.dart:374-381` (Save-Validation). |
| `sync_service.dart` `hasUnsyncedChanges()` und `sync()` iterieren über `point.titleImagePath` / `point.otherMediaPaths` und fügen alles zu `imageNames` hinzu — bei Waypoints sind beide leer, also harmlos, aber der Code macht implizit die Annahme dass diese Felder existieren. | Funktional kein Bug (leere Strings/Listen werden bereits korrekt ignoriert via `.isNotEmpty`-Check); jedoch dokumentieren / Test hinzufügen, dass Waypoints transparent durchlaufen. Push gegen Regression. | `flutter_app/lib/services/sync_service.dart:240-248`, `:294-298`; `flutter_app/lib/pages/sync_status_page.dart:51-56`. |
| `Point.js`-Konstruktor setzt `this.title = data.name \|\| 'Untitled'` — bei Waypoint mit leerem name wäre `title === 'Untitled'`, würde aber in Slug-Resolution (`App.jsx:28` `slugify(p.title) === slug`) und Header-Popup landen. | Wenn `data.isWaypoint`: `this.title = ''` (oder `null`), und `slugify`-Lookup in `resolveSlug`/`getSlug` Waypoints überspringen, da sie keine eigene Detail-URL haben dürfen. | `website/src/model/Point.js:8`; `website/src/App.jsx:26-35` (resolveSlug, getSlug). |
| `Trip.js` Konstruktor sortiert `points` nach `order` — Waypoints sind Teil derselben Liste. `getDateRange()` filtert per `getParsedDate() !== null`, also unkritisch (Waypoints haben kein `date` → null). | Kein direkter Fix nötig; aber `getCollapsedSegments(points, routes)` als neue Helper-Methode auf `Trip` (oder eigener Helper) hinzufügen, der die Sidebar bedient. | `website/src/model/Trip.js:8-17, 34-52`. |
| **Veraltete Annahme (Backward-Kompatibilität):** Vereinzelt setzen Stellen `point.date != null` als Indikator für vorhandenes Datum, aber `point.title`/`point.desc` werden ohne Null-Check gerendert (`HeroSection`, `StopCard`, `mapHelpers.createPopupContent`). Auch ohne Waypoints kann ein normaler Point mit leeren Strings im JSON heute schon zu hässlichem Output führen ("Untitled" + leeres Bild). | Mit Waypoint-Flag wird dies explizit: Waypoints werden gar nicht in StopCard/PointDetail/Popup gerendert; daher entfällt die Frage. **Aber**: alle drei o.g. Stellen sollten zusätzlich `if (point.isWaypoint) return null;` als Schutzschicht erhalten (Defense-in-Depth, falls jemand versehentlich einen Waypoint dort durchreicht). | `website/src/components/HeroSection.jsx:6-50`, `website/src/components/StopCard.jsx:8-65`, `website/src/components/mapHelpers.js:5-45`, `website/src/components/PointDetail.jsx:96-189`. |
| **Veraltete Annahme:** `manage_points_page.dart:_saveData()` (Zeile 99) instanziiert `InterestPoint(...)` und übergibt **alle** Felder — bei Waypoints wären `titleImagePath`/`otherMediaPaths`/`name` leer; das ist OK, aber das Konstruktor-Signaturen-Feld `isWaypoint` muss zusätzlich übergeben werden, sonst wird beim Re-Save in einer Manage-Page-Operation das Flag auf `false` zurückgefallen. | `InterestPoint`-Konstruktor erweitern um `bool isWaypoint = false`, in **allen** Aufrufstellen explizit `isWaypoint: p.isWaypoint` mit-übergeben. | Aufrufstellen: `flutter_app/lib/pages/manage_points_page.dart:99-112`, `flutter_app/lib/pages/create_point_page.dart:426-437`. |

---

## 10. Betroffene Aufrufer (Impact-Analyse)

> **Hinweis:** Vom `impact-analyzer` Agent befüllt.

### 10.1 Direkte Aufrufer

**Flutter App — Datenmodell / Instanziierung:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `flutter_app/lib/model/interest_point.dart` | 4-27 | Klasse `InterestPoint` mit Feldern `id`, `name`, `shortDescription`, `titleImagePath`, `otherMediaPaths`, `lat`, `lon`, `date`, `description`, `tripOrder` | Neues Feld `bool isWaypoint` (default `false`); in Konstruktor + `toJson` + `fromJson` ergänzen (`isWaypoint: json['isWaypoint'] ?? false`). |
| `flutter_app/lib/model/interest_point.dart` | 29-40 | `toJson()` serialisiert 10 Felder | Feld `'isWaypoint': isWaypoint` am Ende hinzufügen. |
| `flutter_app/lib/model/interest_point.dart` | 42-55 | `fromJson()` liest 10 Felder | `isWaypoint: json['isWaypoint'] ?? false`. |
| `flutter_app/lib/services/storage_service.dart` | 42 | `points = jsonList.map((json) => InterestPoint.fromJson(json)).toList();` | Unverändert (geht durch den erweiterten `fromJson`). Nur Verhalten prüfen. |
| `flutter_app/lib/services/storage_service.dart` | 103 | 2. Stelle `InterestPoint.fromJson` | Unverändert, dito. |
| `flutter_app/lib/pages/manage_points_page.dart` | 99-112 | `InterestPoint(id:..., name:..., ..., tripOrder: p.tripOrder)` im `_saveData()`-Cleanup | `isWaypoint: p.isWaypoint` am Ende hinzufügen; sonst fällt das Flag beim Re-Save auf `false` zurück. |
| `flutter_app/lib/pages/create_point_page.dart` | 426-437 | `InterestPoint point = InterestPoint(... tripOrder: ...)` | Explizit `isWaypoint: false` setzen (defensiver expliziter Default) — dieser Flow ist nur für normale Punkte. |

**Flutter App — UI-Aufrufer mit impliziten Annahmen:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `flutter_app/lib/pages/manage_points_page.dart` | 333-362 | `itemBuilder` erzeugt pro Punkt unbedingt `PointWithRouteCard` | Conditional: `if (point.isWaypoint) return WaypointCard(...)` (neues Widget) `else return PointWithRouteCard(...)`. |
| `flutter_app/lib/pages/manage_points_page.dart` | 148-156 | `_editPoint(point)` öffnet `AddInterestPointPage` für jeden Punkt | Für Waypoint nicht aufrufen (Tap-on-Card = no-op; stattdessen expliziter "Position ändern"-Button auf WaypointCard → öffnet Map-Picker / Lat-Lon-Dialog). |
| `flutter_app/lib/pages/manage_points_page.dart` | 118-146 | `_deletePoint(point)` zeigt Dialog mit `point.name` | Für Waypoint: Dialog ohne Namen (z.B. "Wegpunkt löschen?" + Koordinaten). |
| `flutter_app/lib/pages/manage_points_page.dart` | 270 (Actions) + Button-Area zum Hinzufügen | Aktuell fehlt hier sichtbar der "+ Punkt"-Flow (startet von `StartPage`/anderswo); "+ Wegpunkt"-Button muss hier oder im App-Menu neu ergänzt werden. | Neuer FAB / Header-Button "+ Wegpunkt hinzufügen" auf Manage-Page; Routing zu neuem Flow (siehe neuer Plan `03_App_CreateWaypoint.md`). |
| `flutter_app/lib/widgets/point_with_route_card.dart` | 189-221 (Thumbnail), 223-258 (PointInfo) | Rendert `point.titleImagePath`, `point.name`, `point.date` ohne Waypoint-Check | Entweder komplett via `if (point.isWaypoint)` branchen, oder eigene `WaypointCard` schreiben und in `manage_points_page.dart` dispatchen (empfohlen). |
| `flutter_app/lib/services/sync_service.dart` | 240-248 (`hasUnsyncedChanges`), 294-298 (`sync`) | Liest `point.titleImagePath` / `point.otherMediaPaths` — Waypoints haben diese leer → automatisch übersprungen | Keine Code-Änderung nötig; Verhalten ist korrekt. Aber explizit in `loadPoints()`-Kommentar / Test dokumentieren. |
| `flutter_app/lib/pages/sync_status_page.dart` | 51-56 | Dto. — iteriert über `points`, fügt Media hinzu | Keine Änderung nötig. |

**Website — Datenmodell:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `website/src/model/Point.js` | 5-18 | `constructor(data, password)` liest 9 Felder aus `data` | `this.isWaypoint = data.isWaypoint === true;` (strikt `true`, damit `undefined`/`false` beide zu `false` werden). Für Waypoint: `this.title = ''` / `null`, Thumb/Image URLs bleiben per `imagePath = null` automatisch leer. |
| `website/src/model/Trip.js` | 8-17 | `constructor` mappt alle Points; `routes` werden 1:1 übernommen | Unverändert; aber neue Methode `getCollapsedSegments(fromId, toId)` oder freie Funktion `collapseWaypoints(points, routes)` für die Sidebar. |
| `website/src/model/Trip.js` | 54-67 | `getTotalDistance()` summiert über `this.routes` — funktioniert mit Waypoints automatisch korrekt | Keine Änderung nötig. |
| `website/src/model/Trip.js` | 73-78 (`getRouteBetween`), 80-87 (`getDistanceBetween`) | Primitive Lookups per ID-Paar | Bleiben als Basis-Operationen; werden intern von `collapseWaypoints` verwendet. |

**Website — Map-Rendering:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `website/src/components/mapHelpers.js` | 125-134 | `buildMarkerHtml(isNew)` — orange Dot + optional Pulse-Ring | Neue Signatur (oder zweite Funktion `buildWaypointMarkerHtml()`); orange wenn nicht Waypoint, sonst grau (`#9CA3AF`) ~6px ohne Pulse. |
| `website/src/components/MapView.jsx` | 153-185 (`addPointMarkers`) | `trip.points.forEach(point => { ... buildMarkerHtml(newPointIds.has(point.id)) ... bindPopup ... markersRef.current[point.id] = marker })` | Wenn `point.isWaypoint`: kleineren Marker hinzufügen, Click-/Hover-Handler weglassen, Popup nicht binden, **nicht** in `markersRef.current` eintragen. `newPointIds.has(point.id)` ist für Waypoints irrelevant (nie "neu"). |
| `website/src/components/mapHelpers.js` | 144-152 (`findClosestMarker`) | iteriert `trip.points.forEach(point => { ... closestStop = point })` | `if (point.isWaypoint) return;` einfügen, damit Klicks nicht auf Waypoints snappen. |
| `website/src/components/mapHelpers.js` | 70-74 (`addImageGpsMarkers`) | Iteriert Points und liest `point.imagePath`/`otherPaths` | Waypoints haben beide leer → keine Änderung nötig; implizit korrekt. |
| `website/src/controller/routingService.js` | 153-162 (`fetchAllRoutes` Fallback) | Iteriert `trip.routes`, liest Points per ID | Waypoints sind ganz normale IDs → keine Änderung nötig. **Backend `/routes`** (`fileserver.js:676-708`) ebenfalls unverändert (koordinaten-basiert). |

**Website — Sidebar / Navigation / Detail:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `website/src/components/Sidebar.jsx` | 23-26 (Thumb-Preload) | `trip.points.map(p => p.titleThumbUrl).filter(Boolean)` | `filter(p => !p.isWaypoint).map(...)` — Waypoints haben eh `null`, aber klarer. |
| `website/src/components/Sidebar.jsx` | 59 | `{trip.points.length} Stopps` | `{trip.points.filter(p => !p.isWaypoint).length} Stopps`. |
| `website/src/components/Sidebar.jsx` | 66-97 | `trip.points.map((point, index) => ( <StopCard point={point} /> <RouteSegment fromPoint={point} toPoint={trip.points[index + 1]} /> ))` | Vor dem Map über `collapseWaypoints(trip.points, trip.routes)` iterieren. Ergebnis: geordnete Liste aus `{type: 'stop', point}` und `{type: 'segments', badges: [{mode, distance}, ...]}`. StopCard nur für normale Points, Badges-Gruppe pro Segment-Slot. |
| `website/src/components/RouteSegment.jsx` | 5-43 | Rendert 1 Badge zwischen 2 Points via `getRouteBetween`+`getDistanceBetween` | Neue Variante (oder Refactor): rendert eine `badges: [{mode, distance}]`-Liste hintereinander (Distanzen bereits aggregiert). |
| `website/src/components/MapView.jsx` | 60 | `trip.points.filter(p => p.lat && p.lng)` für Bounds | Waypoints haben lat/lng → bleiben in Bounds. Keine Änderung nötig. |
| `website/src/App.jsx` | 26-35 (`resolveSlug`, `getSlug`) | `trip.points.find(p => slugify(p.title) === slug)` | Waypoints haben leeren Titel → `slugify('')` würde leer sein und fälschlich matchen, wenn URL einen leeren Slug hat. Filter: `trip.points.filter(p => !p.isWaypoint).find(...)`. |
| `website/src/App.jsx` | 112 | `const activePoint = detailId ? trip?.getPoint(detailId) : null;` | Kein Fix nötig, weil Waypoints nie `detailId` werden können (nicht klickbar, nicht in `markersRef`). Aber Defensivcheck: `if (activePoint?.isWaypoint) return null;`. |
| `website/src/components/PointDetail.jsx` | 96-189 | Rendert `point.title`, `point.description`, `point.lat`/`lng` etc. | Defensiv: `if (point.isWaypoint) return null;` direkt nach `if (!point) return null;`. |
| `website/src/components/HeroSection.jsx` | 4-50 | Rendert `point.title`/`point.date`/`point.desc`/`point.lat`/`lng` | Wird nie mit Waypoint aufgerufen, aber Defensivcheck einfügen. |
| `website/src/components/StopCard.jsx` | 4-65 | Rendert Card mit allen Point-Feldern | Wird durch Sidebar-Kollabierung nie für Waypoints aufgerufen. |

**Website — "Neue Punkte"-Erkennung:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `website/src/controller/useTripLoader.js` | 32-45 | `const orders = loadedTrip.points.map(p => p.order); const maxOrder = Math.max(...orders); const newIds = new Set(loadedTrip.points.filter(p => p.order > lastKnown).map(p => p.id)); ... localStorage.setItem('lastKnownPointOrder', String(maxOrder));` | Vorfilter: `const realPoints = loadedTrip.points.filter(p => !p.isWaypoint);`. Danach `orders`/`newIds`/`firstNew` über `realPoints` statt `loadedTrip.points`. |

**Server:**
| Datei | Zeile | Aktueller Aufruf | Muss geändert zu |
|-------|-------|------------------|------------------|
| `fileserver.js` | 500-530 (`/files/data/:file` Rewrite) | Iteriert `data.points`, rewritet `titleImagePath`/`otherImagePaths` | Waypoints haben leere Pfade — `pt.titleImagePath` ist falsy → `if (pt.titleImagePath)` überspringt automatisch. Keine Änderung nötig. |
| `fileserver.js` | 676-708 (`/routes`) | Iteriert `trips`, löst `byId` Points auf, berechnet Route | Waypoints sind ganz normale `points`-Einträge → bereits korrekt. Keine Änderung nötig. |
| `fileserver.js` | 849-866 (Auto-Push-Trigger) | `if (points.length > prevPoints.length) { ... newPoints = points.filter(p => !prevIds.has(p.id)); latest = newPoints.reduce(...tripOrder); sendPushToAll({ body: latest?.name ... }) }` | Filter einfügen: `const realPrev = prevPoints.filter(p => !p.isWaypoint); const realNow = points.filter(p => !p.isWaypoint);` — Push nur wenn `realNow.length > realPrev.length`, und `newPoints` aus `realNow` gegen `realPrev`-IDs. |
| `fileserver.js` | 817-847 (`/write`) | Schreibt rohen JSON-Content | Keine Änderung nötig — `isWaypoint` wird transparent durchgereicht. |

### 10.2 Transitive Aufrufer
| Datei | Aufrufkette | Muss geändert werden? |
|-------|-------------|----------------------|
| `flutter_app/lib/main.dart` | `MyApp` → `/manage_points` Route → `ManagePointsPage` → `_buildPointsList()` → `PointWithRouteCard` bzw. neuer `WaypointCard` | Nur indirekt: wenn neuer Create-Waypoint-Flow eine neue Route braucht (z.B. `/create_waypoint`), hier registrieren. Andernfalls unverändert. |
| `flutter_app/lib/pages/start_page.dart` | Start-Page → `/manage_points` | Unverändert (Start-Page weiß nichts von Waypoints). |
| `flutter_app/lib/services/storage_service.dart::savePointsAndTrips` | Aufrufer: `manage_points_page.dart:_saveData()`, `create_point_page.dart:_saveData()`, zukünftig Waypoint-Create-Flow | Signatur bleibt (`List<InterestPoint>`); der neue Flow ruft dieselbe Methode. |
| `flutter_app/lib/services/sync_service.dart::sync()` | Aufrufer: `syncFromStorage()` (in `storage_service.dart:66` und Workmanager-Callback `main.dart:219`) | Unverändert; das `toJson`-erweiterte Point-Feld fließt transparent durch `points.map((e) => e.toJson())`. |
| `website/src/App.jsx` | Ist Entry-Point für alle Komponenten. Hängt an `useTripLoader` → `trip`, `newPointIds`. Trip → `Sidebar`, `MapView`, `PointDetail`. | Die geänderte `newPointIds`-Logik in `useTripLoader` wirkt direkt hier; kein Code-Fix in `App.jsx` selbst (außer `resolveSlug`/`getSlug`-Filter, siehe 10.1). |
| `website/src/controller/useHistoryNavigation.js` | nutzt `resolveSlug`/`getSlug` aus `App.jsx` | Wenn dort Waypoints gefiltert werden, funktioniert das transitiv korrekt (Waypoints kriegen sowieso keinen Deep-Link). |
| `website/src/components/Header.jsx` | `trip?.getTotalDistance()` und `trip?.getDateRange()` | Unverändert — beide Methoden aggregieren über alle Routes/Dates und sind mit Waypoints selbstkonsistent. |
| `website/src/components/Legend.jsx` | `trip.routes.map(r => r.mode)` in `MapView.jsx:15` | Unverändert — zeigt alle verwendeten Modi, auch in Waypoint-Segmenten. |
| `website/src/controller/routingService.js::fetchAllRoutes` | `MapView.jsx:74` `drawRoutes(map, trip)` → `fetchAllRoutes` → Backend `/routes` oder lokales OSRM | Unverändert — segmentweises Rendering läuft über `trip.routes`, nicht über `trip.points`. |
| `website/src/controller/apiService.js::fetchJson('points.json')` | Aufrufer: `Trip.getInstance()` (`Trip.js:21`) | Unverändert — roher JSON wird durchgereicht. |
| `fileserver.js::/files/data/:file` | Serviert points.json → Browser → `Trip.getInstance` | Unverändert; `isWaypoint` fließt transparent durch. |
| `fileserver.js::/write` → Push-Trigger (849-866) | Aufrufer: Sync-Service der App (über `POST /write` mit `path: 'data/points.json'`) | Push-Filter muss ergänzt werden (siehe 10.1). |

### 10.3 Betroffene Tests

**Keine funktionalen Tests vorhanden.**

| Test-Datei | Beschreibung | Anpassung nötig |
|------------|--------------|-----------------|
| `flutter_app/test/widget_test.dart` | Default-Flutter-Counter-Test (aus `flutter create`-Template). Ruft `MyApp()`, sucht nach Text "0" und Icon `Icons.add`. Testet **nichts** aus diesem Projekt (existiert weder Counter noch `Icons.add` im echten `MyApp`). | **Bereits kaputt** — würde bei Ausführung fehlschlagen. Im Rahmen des Features neu schreiben als echten Smoke-Test (z.B. `InterestPoint.fromJson` mit und ohne `isWaypoint`-Feld) oder löschen. |
| `website/**` | Keine Test-Dateien (`*.test.js`/`*.test.jsx`/`__tests__/`) vorhanden. `package.json` hat keinen `test`-Script. Die einzigen Treffer waren in `node_modules/` (fremde Libs, irrelevant). | **Keine Tests vorhanden.** Optional: Für Feature-Qualität Unit-Tests für die neue `collapseWaypoints`-Helper-Funktion einrichten (Vitest wäre bei Vite nahe liegend), da sie die einzige rein-logische Neu-Komponente ist (Sektion 3, Akzeptanzkriterium "Sidebar-Kollabierungs-Logik ist eine reine, testbare Funktion"). |
| `fileserver.js` / Server | Keine Tests vorhanden. | **Keine Tests vorhanden.** Push-Filter-Logik (Zeilen 849-866) könnte mit einem isolierten JS-Modul + Vitest-ähnlichem Test abgedeckt werden — aktuell aber nicht aufgesetzt. |

---

## 11. Akzeptanzkriterien

> **Wichtig:** Das Feature ist erst fertig wenn ALLE Kriterien erfüllt sind.

### Funktionale Kriterien

**App:**
- [ ] In Manage-Points-Page gibt es einen "+ Wegpunkt" Button.
- [ ] Wegpunkt kann per Map-Tap **oder** manueller Koordinaten-Eingabe erstellt werden.
- [ ] Wegpunkt erscheint als kompakte Card in der Liste (Label "Wegpunkt", Koordinaten, keine Bilder, Reorder-Handle).
- [ ] Wegpunkt kann per Drag-and-Drop umsortiert werden (bestehende Reorder-Logik greift).
- [ ] TripMethod vor und nach einem Wegpunkt kann unabhängig gesetzt werden.
- [ ] Wegpunkt kann gelöscht werden.
- [ ] Wegpunkt wird korrekt zum Server synchronisiert (JSON enthält `isWaypoint: true`).
- [ ] **Legacy-Test (App):** Eine alte `points.json` ohne `isWaypoint`-Feld lädt und rendert fehlerfrei; alle Punkte werden als normale Punkte behandelt.

**Website:**
- [ ] Waypoints erscheinen als kleine, unauffällige, graue Marker auf der Karte (keine orange Farbe, kein pulsierender Ring, kein Popup).
- [ ] Klick auf einen Waypoint-Marker tut **nichts** (keine Sidebar-Scroll, kein Popup).
- [ ] Routenlinien verlaufen über Waypoints (wie bei jedem TripElement).
- [ ] An einem Waypoint mit Methodenwechsel ist die Farbänderung der Polyline auf der Karte sichtbar.
- [ ] Sidebar zeigt Waypoints **nicht** als StopCard.
- [ ] Sidebar zeigt zwischen zwei normalen Punkten **einen** Route-Badge, wenn alle dazwischenliegenden TripElements dieselbe Methode haben (Distanz summiert).
- [ ] Sidebar zeigt **mehrere** Route-Badges hintereinander, wenn sich die Methode an einem Waypoint ändert.
- [ ] `getTotalDistance()` berücksichtigt Waypoint-Segmente korrekt.
- [ ] "Neue Punkte" Erkennung (`lastKnownPointOrder`) ignoriert Waypoints.
- [ ] **Legacy-Test (Website):** Eine alte `points.json` ohne `isWaypoint`-Feld rendert unverändert — alle Punkte als orange Marker und Sidebar-Cards.

**Server:**
- [ ] `POST /write` speichert das `isWaypoint`-Feld durch (keine Silent-Filterung).
- [ ] Auto-Push-Notification feuert **nicht** für neu hinzugefügte Waypoints.

### Technische Kriterien (automatisch geprüft)
- [ ] Kein alter Code mehr vorhanden (alle Einträge aus Sektion 9 gelöscht)
- [ ] Alle Aufrufer umgestellt (alle Einträge aus Sektion 10 erledigt)
- [ ] Flutter-App build (`flutter build`) läuft fehlerfrei.
- [ ] Website build (`npm run build` oder vergleichbar) läuft fehlerfrei.
- [ ] Keine `// TODO` Kommentare im neuen Code.
- [ ] Keine auskommentierten Code-Blöcke.
- [ ] Alle neuen Dateien haben korrekte Imports.

### Qualitätskriterien
- [ ] Code folgt bestehenden Patterns (Flutter: Stateful/Stateless nach Bedarf, Service-Singletons; JS: ES-Modules, Hook-Pattern in React).
- [ ] Keine Duplikation von Marker- oder Routing-Logik.
- [ ] Sidebar-Kollabierungs-Logik ist eine reine, testbare Funktion.

---

## 12. Nächste Schritte

Nach Freigabe dieses Masterplans:
1. `impact-analyzer` ausführen → Sektionen 9 + 10 befüllen.
2. Recherche: `flutter_map` verfügbar? Gibt es bereits Map-Picker-Komponenten?
3. Erstellung der Implementierungspläne in `plans/` (geplante Aufteilung):
   - `01_DataModel_Shared.md` — `InterestPoint`/`Point` Feld + Serialisierung (Flutter + JS).
   - `02_App_ManagePage.md` — Waypoint-Card + "+ Wegpunkt" Button.
   - `03_App_CreateWaypoint.md` — Map-Picker + Koordinaten-Dialog.
   - `04_Website_Marker.md` — kleine graue Marker + Klick-Deaktivierung.
   - `05_Website_Sidebar.md` — Kollabierungs-Logik + Badge-Merging.
   - `06_Server_PushFilter.md` — Auto-Push ignoriert Waypoints.
   - `07_Website_NewPointDetection.md` — `useTripLoader` ignoriert Waypoints beim Zählen.
4. Plan-Größe prüfen → ggf. Sub-Pläne erstellen (Map-Picker könnte groß werden).
5. Kohärenz-Check.
6. Start der Implementierung via `/execute`.

---

*Erstellt am: 2026-04-22*
*Letzte Aktualisierung: 2026-04-22*
