# Waypoint - Plan 03: Waypoint-Erstellungs-Flow (Flutter)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Eine neue `CreateWaypointPage`, die mit minimaler UI einen Waypoint erzeugt. Zwei Modi: "Auf Karte setzen" (öffnet den existierenden `CoordinatePickerPage`) oder "Koordinaten manuell eingeben" (Lat/Lon-TextFields). Gibt einen voll konstruierten `InterestPoint` mit `isWaypoint: true` zurück via `Navigator.pop`. |
| **Abhängig von** | Plan 01 (Datenmodell), Plan 02 (Navigator.push aus Manage-Page erwartet diese Page) |
| **Betroffene Bereiche** | Flutter-App / UI |
| **Geschätzte Komplexität** | Niedrig |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 4 | >8 → Sub-Pläne |
| Neue Dateien | 1 (`create_waypoint_page.dart`) | >5 → Sub-Pläne |
| Zu ändernde Dateien | 1 (`strings.dart`) | >10 → Sub-Pläne |

OK.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | `InterestPoint`-Konstruktor akzeptiert `isWaypoint: true`. | `flutter_app/lib/model/interest_point.dart` |
| Bestehender Code | `CoordinatePickerPage` existiert und gibt `LatLng?` via `Navigator.pop` zurück. | `flutter_app/lib/pages/coordinate_picker.dart:180,191` |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| Plan 02 | `Navigator.push<InterestPoint>(...)` liefert einen voll befüllten Waypoint (`isWaypoint: true`, `lat`, `lon`, `id`, leere sonstige Felder). Der Aufrufer (`_addWaypoint` in Plan 02) weist `tripOrder` zu und fügt ihn der Liste hinzu. | `flutter_app/lib/pages/create_waypoint_page.dart` |

### Architektur-Entscheidungen
- **Keine Änderung am bestehenden `CreatePointPage`** (`create_point_page.dart`). Der Waypoint-Flow ist komplett getrennt — kein Conditional im Bild-Upload-Code.
- **ID-Generierung:** `DateTime.now().millisecondsSinceEpoch` (selbes Pattern wie bestehende Points — prüfen in `create_point_page.dart` für Konsistenz).
- **Modus-Auswahl:** Kleiner Dialog mit zwei Buttons ("Auf Karte auswählen" / "Manuell eingeben") beim Öffnen der Page. Kein Wechsel nachträglich — wer den Modus ändern will, bricht ab und startet neu.
- **Manuelle Eingabe:** Zwei `TextField` (Lat, Lon) mit Zahlen-Tastatur und Validierung (parseable double, Range `-90..90` / `-180..180`).

## Voraussetzungen

- [ ] Plan 01 abgeschlossen.
- [ ] `CoordinatePickerPage` existiert und funktioniert (bestätigt — existiert in `flutter_app/lib/pages/coordinate_picker.dart`).

## Betroffene Dateien

### Neue Dateien
| Datei | Beschreibung |
|-------|--------------|
| `flutter_app/lib/pages/create_waypoint_page.dart` | Page mit Modus-Dialog, Koordinaten-Eingabe-Form, Map-Picker-Integration und Save-Action. |

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `flutter_app/lib/strings.dart` | Neue Strings: `create_waypoint_title`, `choose_on_map`, `enter_coordinates_manually`, `label_lat`, `label_lon`, `error_invalid_coordinates`. |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: ID-Generierung verifizieren

**Kontext:** Wie werden heute IDs für neue Points vergeben?

Vor Implementierung kurz prüfen: `flutter_app/lib/pages/create_point_page.dart` Zeile ~426-437 anschauen — das Muster `DateTime.now().millisecondsSinceEpoch` wird vermutlich dort verwendet. Dasselbe Muster übernehmen für Waypoints. Falls es anders ist (z.B. `max(points.map((p) => p.id)) + 1`), das verwenden.

**Ergebnis:** ID-Generierungs-Strategie im folgenden Schritt exakt spiegeln.

### Schritt 2: `create_waypoint_page.dart` erstellen

**Datei (neu):** `flutter_app/lib/pages/create_waypoint_page.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:latlong2/latlong.dart';

import '../colors.dart';
import '../model/interest_point.dart';
import '../strings.dart';
import 'coordinate_picker.dart';

class CreateWaypointPage extends StatefulWidget {
  const CreateWaypointPage({super.key});

  @override
  State<CreateWaypointPage> createState() => _CreateWaypointPageState();
}

class _CreateWaypointPageState extends State<CreateWaypointPage> {
  LatLng? _pickedLocation;
  final _latController = TextEditingController();
  final _lonController = TextEditingController();
  String? _errorText;

  @override
  void initState() {
    super.initState();
    // Nach dem ersten Frame: Modus-Dialog zeigen
    WidgetsBinding.instance.addPostFrameCallback((_) => _showModeDialog());
  }

  Future<void> _showModeDialog() async {
    final choice = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(AppStrings.create_waypoint_title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.map_outlined, color: primary),
              title: Text(AppStrings.choose_on_map),
              onTap: () => Navigator.pop(ctx, 'map'),
            ),
            ListTile(
              leading: const Icon(Icons.edit, color: primary),
              title: Text(AppStrings.enter_coordinates_manually),
              onTap: () => Navigator.pop(ctx, 'manual'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(AppStrings.button_cancel),
          ),
        ],
      ),
    );

    if (choice == 'map') {
      await _pickOnMap();
    } else if (choice == null) {
      if (mounted) Navigator.pop(context);  // Abbruch
    }
    // 'manual' → bleibt auf dieser Page, Nutzer tippt in TextFields
  }

  Future<void> _pickOnMap() async {
    final result = await Navigator.push<LatLng>(
      context,
      MaterialPageRoute(builder: (_) => const CoordinatePickerPage()),
    );
    if (result == null) {
      if (mounted) Navigator.pop(context);
      return;
    }
    setState(() {
      _pickedLocation = result;
      _latController.text = result.latitude.toStringAsFixed(6);
      _lonController.text = result.longitude.toStringAsFixed(6);
    });
  }

  void _onSave() {
    final lat = double.tryParse(_latController.text);
    final lon = double.tryParse(_lonController.text);
    if (lat == null || lon == null || lat.abs() > 90 || lon.abs() > 180) {
      setState(() => _errorText = AppStrings.error_invalid_coordinates);
      return;
    }

    final waypoint = InterestPoint(
      id: DateTime.now().millisecondsSinceEpoch,  // ODER: Strategie aus Schritt 1
      name: '',
      shortDescription: '',
      titleImagePath: '',
      otherMediaPaths: const [],
      lat: lat,
      lon: lon,
      date: null,
      description: '',
      tripOrder: 0,  // wird vom Caller (Manage-Page) überschrieben
      isWaypoint: true,
    );
    Navigator.pop(context, waypoint);
  }

  @override
  void dispose() {
    _latController.dispose();
    _lonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.create_waypoint_title),
        backgroundColor: accent,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _latController,
              keyboardType: const TextInputType.numberWithOptions(
                  decimal: true, signed: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
              ],
              decoration: InputDecoration(
                labelText: AppStrings.label_lat,
                errorText: _errorText,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lonController,
              keyboardType: const TextInputType.numberWithOptions(
                  decimal: true, signed: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
              ],
              decoration: InputDecoration(
                labelText: AppStrings.label_lon,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _pickOnMap,
              icon: const Icon(Icons.map_outlined),
              label: Text(AppStrings.choose_on_map),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _onSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text(AppStrings.button_save),
            ),
          ],
        ),
      ),
    );
  }
}
```

**Erklärung:**
- Beim Öffnen kommt sofort ein Modus-Dialog. "Auf Karte" → `CoordinatePickerPage` pushen und bei Rückkehr TextFields mit Werten pre-fillen. "Manuell" → Dialog schließt, Nutzer tippt. "Abbruch" → komplette Page verlassen.
- Nach Auswahl auf Karte kann Nutzer die TextField-Werte noch händisch fein-korrigieren, bevor er Save drückt.
- `_onSave` validiert, erzeugt `InterestPoint` mit `isWaypoint: true` und pop'ed ihn zurück.

### Schritt 3: Strings ergänzen

**Datei:** `flutter_app/lib/strings.dart`

```dart
// CreateWaypoint
static const String create_waypoint_title = 'Wegpunkt erstellen';
static const String choose_on_map = 'Auf Karte auswählen';
static const String enter_coordinates_manually = 'Koordinaten manuell eingeben';
static const String label_lat = 'Breitengrad (Lat)';
static const String label_lon = 'Längengrad (Lon)';
static const String error_invalid_coordinates = 'Ungültige Koordinaten';
```

(Falls `button_save` noch nicht existiert, auch hinzufügen — vermutlich aber da, da create_point_page.dart es nutzt.)

### Schritt 4: Integration-Test mit Plan 02

**Abhängigkeit:** Plan 02 importiert `CreateWaypointPage` in `manage_points_page.dart`. Das Import ist:
```dart
import 'create_waypoint_page.dart';
```

Nach Fertigstellung dieses Plans: App neu bauen, Plan 02 testet automatisch (weil `_addWaypoint` funktional wird).

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `flutter_app/lib/pages/manage_points_page.dart` (aus Plan 02) | ~180 | `Navigator.push(...CreateWaypointPage())` | Funktional gemacht (existiert jetzt). |

---

## Validierung

### Manuelle Tests
- [ ] FAB "+ Wegpunkt" tippen → Modus-Dialog erscheint.
- [ ] "Auf Karte auswählen" → CoordinatePickerPage öffnet sich; nach Tap auf Karte und Confirm → zurück auf CreateWaypointPage mit prefilled Lat/Lon.
- [ ] "Manuell eingeben" → Dialog schließt; Nutzer tippt `-33.85` in Lat, `151.21` in Lon → Save → Waypoint erscheint in Manage-Liste.
- [ ] Ungültige Koordinaten (`91`, `abc`) → Save zeigt Error.
- [ ] Abbruch im Modus-Dialog → Zurück zur Manage-Page ohne neuen Eintrag.
- [ ] Nach Save: `points.json` enthält neuen Eintrag mit `isWaypoint: true`, leerem `name`, `titleImagePath: ''`, korrekten `lat`/`lon`.

### Automatisierte Tests
```bash
cd flutter_app && flutter analyze
cd flutter_app && flutter build apk --debug
```

### Erwartetes Verhalten
- Nach Fertigstellung ist die gesamte App-Seite des Features funktional: Wegpunkt erstellen → erscheint in Manage-Liste → wird synchronisiert → landet in `points.json` auf dem Server.

## Rollback-Plan

1. `create_waypoint_page.dart` löschen.
2. Import + Verwendung in `manage_points_page.dart` entfernen.
3. Strings zurückrollen.

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
