# Waypoint - Plan 01: Datenmodell (Flutter + Website)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Das Feld `isWaypoint` in beiden Datenklassen einführen: `InterestPoint` (Flutter) und `Point` (Website). Serialisierung backward-kompatibel: fehlendes Feld → `false`. |
| **Abhängig von** | — (Grundlage aller anderen Pläne) |
| **Betroffene Bereiche** | Shared / Datenmodell (Flutter-App + Website) |
| **Geschätzte Komplexität** | Niedrig |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 3 | >8 → Sub-Pläne |
| Neue Dateien | 0 | >5 → Sub-Pläne |
| Zu ändernde Dateien | 2 | >10 → Sub-Pläne |

OK — unter allen Schwellwerten.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet |
|----------|-------------------|
| — | Keine Abhängigkeiten. |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| Plan 02 (App ManagePage) | `InterestPoint.isWaypoint: bool` (default `false`) mit toJson/fromJson | `flutter_app/lib/model/interest_point.dart` |
| Plan 03 (App CreateWaypoint) | Gleiches Konstruktor-Feld zum Erzeugen | dito |
| Plan 04 (Website Marker) | `Point.isWaypoint: boolean` zur Abfrage in mapHelpers/MapView | `website/src/model/Point.js` |
| Plan 05 (Website Sidebar) | `point.isWaypoint` zur Filterung + `point.title === ''` bei Waypoints (statt `'Untitled'`) | dito |
| Plan 06 (Server PushFilter) | Im JSON der geschriebenen `points.json` enthält jeder Punkt das Feld | Serialisierung in `toJson()` |
| Plan 07 (Website NewPointDetection) | `point.isWaypoint` zur Filterung in `useTripLoader` | `website/src/model/Point.js` |

### Architektur-Entscheidungen (die andere Pläne betreffen)
- **Parsing-Regel:** `isWaypoint === true` ist der einzige Waypoint-Indikator. `undefined`/`null`/`false` → normaler Point. Strikter Vergleich, damit `{isWaypoint: 1}` o.ä. keine Fehlerfallen werden.
- **Serialisierung:** Flutter serialisiert das Feld **immer** (auch wenn `false`), damit der Output stabil ist. JS tut dasselbe (im Moment schreibt aber der Server, nicht die Website).
- **Point.title bei Waypoint:** `Point.js` muss `this.title = ''` (Leerstring) setzen, NICHT `'Untitled'`, damit spätere Slug-Matches (Plan 07) nicht fälschlich greifen.

## Voraussetzungen

- [ ] Masterplan freigegeben.
- [ ] Impact-Analyse abgeschlossen (Sektion 10 im Masterplan).

## Betroffene Dateien

### Neue Dateien
Keine.

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `flutter_app/lib/model/interest_point.dart` | Neues Feld `bool isWaypoint = false` im Konstruktor, in `toJson()`, in `fromJson()`. |
| `website/src/model/Point.js` | Neues Property `this.isWaypoint`; Title-Handling für Waypoints (`''` statt `'Untitled'`). |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: `InterestPoint` erweitern (Flutter)

**Datei:** `flutter_app/lib/model/interest_point.dart`

**Änderung:**
```dart
class InterestPoint {
  int id;
  String name;
  String shortDescription;
  String titleImagePath;
  List<String> otherMediaPaths;
  double? lat;
  double? lon;
  String? date;
  String description;
  int tripOrder;
  bool isWaypoint;  // NEU

  InterestPoint({
    required this.id,
    this.name = '',
    this.shortDescription = '',
    required this.titleImagePath,
    this.otherMediaPaths = const [],
    this.lat,
    this.lon,
    this.date,
    this.description = '',
    required this.tripOrder,
    this.isWaypoint = false,  // NEU
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'shortDescription': shortDescription,
    'titleImagePath': titleImagePath,
    'otherImagePaths': otherMediaPaths,
    'lat': lat,
    'lon': lon,
    'date': date,
    'description': description,
    'tripOrder': tripOrder,
    'isWaypoint': isWaypoint,  // NEU
  };

  factory InterestPoint.fromJson(Map<String, dynamic> json) {
    return InterestPoint(
      id: json['id'],
      name: json['name'] ?? '',
      shortDescription: json['shortDescription'] ?? '',
      titleImagePath: json['titleImagePath'] ?? '',
      otherMediaPaths: List<String>.from(json['otherImagePaths'] ?? []),
      lat: json['lat']?.toDouble(),
      lon: json['lon']?.toDouble(),
      date: json['date'],
      description: json['description'] ?? '',
      tripOrder: json['tripOrder'] ?? 0,
      isWaypoint: json['isWaypoint'] == true,  // NEU: strikt true
    );
  }
}
```

**Erklärung:**
- Default `false` im Konstruktor sorgt dafür, dass bestehende Aufrufer (die `isWaypoint` nicht übergeben) weiterhin funktionieren.
- `json['isWaypoint'] == true` ist bewusst strikt: `null`, `false`, `undefined` → alle zu `false`. Verhindert, dass versehentliche Werte zu Waypoints werden.

### Schritt 2: `Point` erweitern (Website)

**Datei:** `website/src/model/Point.js`

**Änderung:** Im Konstruktor (aktuell Zeilen 4-18) folgendes ergänzen:

```js
constructor(data, password) {
  this.id = data.id;
  this.isWaypoint = data.isWaypoint === true;  // NEU, vor title

  // title: Waypoint hat keinen Titel → Leerstring (NICHT 'Untitled')
  this.title = this.isWaypoint ? '' : (data.name || 'Untitled');

  this.desc = data.description || '';
  this.short = data.shortDescription || '';
  this.date = data.date || '';
  this.lat = parseFloat(data.lat);
  this.lng = parseFloat(data.lon);
  this.order = (data.tripOrder ?? -1) + 1;

  this.imagePath = data.titleImagePath || null;
  this.otherPaths = Array.isArray(data.otherImagePaths) ? data.otherImagePaths : [];

  this._password = password;
}
```

**Erklärung:**
- Strikter Vergleich `=== true` für Backward-Kompatibilität.
- `title = ''` bei Waypoint — wichtig für Plan 07 (Slug-Resolution soll Waypoints nicht finden) und für alle späteren UI-Guards (HeroSection etc. können per `title === ''` oder besser `isWaypoint` prüfen).
- `imagePath`/`otherPaths` bleiben automatisch leer/`null`, weil Waypoints diese Felder leer haben.
- `lat`/`lng`/`order` funktionieren normal.

### Schritt 3: Verifikation Backward-Kompatibilität

**Manuell testen:**

1. Flutter-App mit alter `points.json` (ohne `isWaypoint`-Feld) starten → keine Crashes, alle Punkte laden korrekt mit `isWaypoint = false`.
2. Im Browser DevTools: `new Point({id: 1, name: 'X', lat: 0, lon: 0, tripOrder: 0}, null)` → `isWaypoint` ist `false`, `title` ist `'X'`.
3. Im Browser: `new Point({id: 2, isWaypoint: true, lat: 0, lon: 0, tripOrder: 1}, null)` → `isWaypoint` ist `true`, `title` ist `''`.

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| — | — | — | Keine direkten Aufrufer müssen in diesem Plan geändert werden. Default-Wert `false` im Konstruktor sorgt für Rückwärtskompatibilität. |

Die Aufrufer (`manage_points_page.dart:99-112`, `create_point_page.dart:426-437`) werden in **Plan 02** bzw. **Plan 03** angepasst.

---

## Validierung

### Manuelle Tests
- [ ] `flutter analyze` wirft keine Fehler nach der Änderung.
- [ ] Alter `points.json` (ohne `isWaypoint`) lädt in App und Website ohne Crash.
- [ ] Neuer `points.json` mit `isWaypoint: true` parst korrekt (Flag landet auf Objekt).
- [ ] `point.toJson()` → `isWaypoint`-Feld ist immer im Output.

### Automatisierte Tests
```bash
cd flutter_app && flutter analyze
cd website && npm run build
```

### Erwartetes Verhalten
- Feld ist in beiden Datenmodellen präsent, backward-kompatibel, und in der Serialisierung enthalten.
- Alle bestehenden UI-Komponenten funktionieren weiterhin (sie ignorieren das neue Feld).

## Rollback-Plan

Falls dieser Schritt fehlschlägt:
1. Feld wieder entfernen aus beiden Dateien (Konstruktor + toJson + fromJson bzw. Point-Constructor).
2. `flutter analyze` und `npm run build` erneut — sollten sauber sein.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
