# Waypoint - Plan 02: Manage-Points-Page anpassen (Flutter)

## Übersicht

| Aspekt | Details |
|--------|---------|
| **Ziel** | Manage-Points-Page rendert Waypoints als kompakte Card-Variante (eigene `WaypointCard`), bietet einen "+ Wegpunkt"-FAB-Button, leitet Tap/Delete korrekt, und bewahrt das `isWaypoint`-Flag beim `_saveData()`-Cleanup. |
| **Abhängig von** | Plan 01 (Datenmodell) |
| **Betroffene Bereiche** | Flutter-App / UI |
| **Geschätzte Komplexität** | Mittel |

### Größen-Check

| Metrik | Wert | Schwellwert |
|--------|------|-------------|
| Implementierungsschritte | 6 | >8 → Sub-Pläne |
| Neue Dateien | 1 (`waypoint_card.dart`) | >5 → Sub-Pläne |
| Zu ändernde Dateien | 2 | >10 → Sub-Pläne |

OK — unter allen Schwellwerten.

## Schnittstellen (Kohärenz-Vertrag)

### Inputs
| Von Plan | Was wird erwartet | Konkret |
|----------|-------------------|---------|
| Plan 01 | `InterestPoint.isWaypoint: bool` existiert mit Default `false`, wird von `fromJson`/`toJson` gehandhabt. | `flutter_app/lib/model/interest_point.dart` |

### Outputs
| Für Plan | Was wird geliefert | Konkret |
|----------|-------------------|---------|
| Plan 03 (CreateWaypoint) | `ManagePointsPage` hat einen Callback/Navigator-Punkt, der nach erfolgreicher Waypoint-Erstellung die Liste neu lädt (`_loadPoints`). Der Waypoint-Create-Flow wird per Button in Plan 03 ausgelöst; dieser Plan stellt **nur** den Button bereit und verbindet ihn per `Navigator.push` mit der neuen Page aus Plan 03. | Siehe Schritt 4. |

### Architektur-Entscheidungen
- **Eigenes Widget `WaypointCard`** statt Conditional im `PointWithRouteCard`: sauber, testbar, und vermeidet Null/Empty-Check-Lawinen in der bestehenden Card.
- **Tap auf WaypointCard**: kein Edit-Dialog. Statt dessen explizite Buttons direkt auf der Card (Delete + "Position ändern" — letzteres ruft den selben Map-Picker auf, der in Plan 03 für Create verwendet wird).
- **"+ Wegpunkt"-Button:** als zweiter `FloatingActionButton` unten rechts (neben oder unter dem bestehenden "+ Punkt"-FAB — falls es keinen gibt, wird hier nur der Wegpunkt-FAB ergänzt; der Punkt-Add-Flow läuft weiterhin über die StartPage).
- **`_saveData()`-Fix:** `isWaypoint: p.isWaypoint` beim Re-Instanziieren übergeben (Zeile 99-112), sonst geht das Flag beim Save verloren.
- **`_deletePoint`-Anpassung:** Dialog-Text für Waypoints ohne `point.name` (z.B. Koordinaten statt Name).

## Voraussetzungen

- [ ] Plan 01 abgeschlossen — `InterestPoint.isWaypoint` verfügbar.

## Betroffene Dateien

### Neue Dateien
| Datei | Beschreibung |
|-------|--------------|
| `flutter_app/lib/widgets/waypoint_card.dart` | Kompakte Card-Variante für Waypoints. Zeigt "Wegpunkt"-Label, Koordinaten, Reorder-Handle, Delete + "Position ändern". |

### Zu ändernde Dateien
| Datei | Art der Änderung |
|-------|------------------|
| `flutter_app/lib/pages/manage_points_page.dart` | `itemBuilder` dispatcht zwischen `PointWithRouteCard` und `WaypointCard`; `_saveData()` bewahrt `isWaypoint`; `_deletePoint` passt Dialog an; FAB für "+ Wegpunkt". |
| `flutter_app/lib/strings.dart` | Neue Strings: `waypoint_label`, `waypoint_delete_title`, `button_change_position`, `button_add_waypoint`. |

### Zu löschende Dateien/Code
Keine.

## Implementierung

### Schritt 1: `waypoint_card.dart` erstellen

**Datei (neu):** `flutter_app/lib/widgets/waypoint_card.dart`

**Struktur:**
```dart
import 'package:flutter/material.dart';
import '../colors.dart';
import '../model/interest_point.dart';
import '../model/trip.dart';
import '../strings.dart';
import 'travel_method_dialog.dart';  // falls wiederverwendet — sonst raus

class WaypointCard extends StatelessWidget {
  final InterestPoint point;
  final int orderNumber;
  final TripElement? tripBefore;
  final VoidCallback onDelete;
  final VoidCallback onChangePosition;
  final VoidCallback? onChangeTripMethod;

  const WaypointCard({
    super.key,
    required this.point,
    required this.orderNumber,
    required this.tripBefore,
    required this.onDelete,
    required this.onChangePosition,
    this.onChangeTripMethod,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Optional: Trip-Badge ABOVE (wie in PointWithRouteCard), falls tripBefore != null
        if (tripBefore != null) _buildTripMethodBadge(context),

        Card(
          margin: const EdgeInsets.symmetric(vertical: 4),
          elevation: 1,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey[300]!, width: 1),
          ),
          child: ListTile(
            leading: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: Colors.grey[200],
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.flag_outlined, color: Colors.grey, size: 22),
            ),
            title: Text(AppStrings.waypoint_label,
              style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.black87),
            ),
            subtitle: Text(
              '${point.lat?.toStringAsFixed(5) ?? '-'}, ${point.lon?.toStringAsFixed(5) ?? '-'}',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.edit_location_alt_outlined, color: primary),
                  tooltip: AppStrings.button_change_position,
                  onPressed: onChangePosition,
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  onPressed: onDelete,
                ),
                // Reorder-Handle kommt automatisch von ReorderableListView (drag durch long-press)
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTripMethodBadge(BuildContext context) {
    // Analog zum Trip-Badge in PointWithRouteCard (Transportmittel-Icon + Label),
    // klein gehalten, tap auf Badge ruft onChangeTripMethod.
    // Implementation: Icon + Text + Tap, keine Bilder.
    return InkWell(
      onTap: onChangeTripMethod,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(tripBefore!.method?.icon ?? Icons.help_outline, size: 16, color: Colors.grey[700]),
            const SizedBox(width: 6),
            Text(tripBefore!.method?.label ?? '—',
              style: TextStyle(fontSize: 12, color: Colors.grey[700])),
          ],
        ),
      ),
    );
  }
}
```

**Erklärung:**
- Minimalistische Card — nur das Nötigste.
- `onChangePosition` callback → öffnet den Map-Picker (wird in Plan 03 definiert), Ergebnis wird per `setState` des Parents in `_points` gespeichert.
- Das Trip-Method-Badge wird gleich gerendert wie bei `PointWithRouteCard`, damit Nutzer denselben UX-Pfad haben um die Methode zu ändern.

### Schritt 2: `manage_points_page.dart` — `itemBuilder` dispatchen

**Datei:** `flutter_app/lib/pages/manage_points_page.dart`

**Änderung:** Die `itemBuilder`-Callback (aktuell Zeilen 333-362) so umbauen:

```dart
itemBuilder: (context, index) {
  final point = _points[index];
  TripElement? tripBefore;

  if (index > 0) {
    final prevPoint = _points[index - 1];
    final existing = _tripsByDestination[point.id];
    if (existing != null && existing.pointId1 == prevPoint.id) {
      tripBefore = existing;
    } else {
      final newTrip = TripElement(pointId1: prevPoint.id, pointId2: point.id);
      _tripElements.add(newTrip);
      _tripsByDestination[point.id] = newTrip;
      _saveData();
      tripBefore = newTrip;
    }
  }

  if (point.isWaypoint) {
    return WaypointCard(
      key: ValueKey('waypoint_${point.id}'),
      point: point,
      orderNumber: index + 1,
      tripBefore: tripBefore,
      onDelete: () => _deletePoint(point),
      onChangePosition: () => _changeWaypointPosition(point),
      onChangeTripMethod: tripBefore != null ? () => _changeTripMethod(tripBefore!) : null,
    );
  }

  return PointWithRouteCard(
    key: ValueKey('point_route_${point.id}'),
    point: point,
    orderNumber: index + 1,
    tripBefore: tripBefore,
    onEdit: () => _editPoint(point),
    onDelete: () => _deletePoint(point),
    onChangeTripMethod: tripBefore != null ? () => _changeTripMethod(tripBefore!) : null,
  );
},
```

Neuer Import oben: `import '../widgets/waypoint_card.dart';`.

### Schritt 3: `_saveData()` — `isWaypoint` bewahren

**Datei:** `flutter_app/lib/pages/manage_points_page.dart`

**Änderung:** Zeilen 99-112 (der Re-Instanziierungs-Block) erweitern:

```dart
return InterestPoint(
  id: p.id,
  name: p.name,
  shortDescription: p.shortDescription,
  titleImagePath: titleName,
  otherMediaPaths: otherNames,
  lat: p.lat,
  lon: p.lon,
  date: p.date,
  description: p.description,
  tripOrder: p.tripOrder,
  isWaypoint: p.isWaypoint,  // NEU
);
```

**Erklärung:** Ohne diese Zeile würde jede Reorder-Operation oder Edit eines anderen Punktes alle Waypoint-Flags beim nächsten `_saveData()` löschen — kritischer Bug, der ohne diesen Fix den gesamten Feature-Flow brechen würde.

### Schritt 4: Neue Methode `_changeWaypointPosition` + "+ Wegpunkt"-FAB

**Datei:** `flutter_app/lib/pages/manage_points_page.dart`

**Änderung a) Neue Methode** (direkt neben `_editPoint` einfügen, ca. Zeile 157):

```dart
Future<void> _changeWaypointPosition(InterestPoint waypoint) async {
  // Reuse CoordinatePickerPage (existiert bereits in lib/pages/coordinate_picker.dart)
  final result = await Navigator.push<LatLng>(
    context,
    MaterialPageRoute(builder: (_) => const CoordinatePickerPage()),
  );
  if (result == null) return;

  setState(() {
    waypoint.lat = result.latitude;
    waypoint.lon = result.longitude;
  });
  await _saveData();
  _showSuccessSnackBar(AppStrings.waypoint_position_updated);
}

Future<void> _addWaypoint() async {
  // Delegiert an Plan 03 Flow (neue Page oder Dialog)
  final result = await Navigator.push<InterestPoint>(
    context,
    MaterialPageRoute(builder: (_) => const CreateWaypointPage()),  // aus Plan 03
  );
  if (result == null) return;

  // Anfügen am Ende + TripElement zum vorherigen Point
  setState(() {
    result.tripOrder = _points.length;
    _points.add(result);
    if (_points.length > 1) {
      final prev = _points[_points.length - 2];
      final trip = TripElement(pointId1: prev.id, pointId2: result.id);
      _tripElements.add(trip);
      _rebuildTripIndex();
    }
  });
  await _saveData();
  _showSuccessSnackBar(AppStrings.waypoint_added);
}
```

Imports ergänzen:
```dart
import 'package:latlong2/latlong.dart';
import 'coordinate_picker.dart';
import 'create_waypoint_page.dart';  // aus Plan 03
```

**Änderung b) FAB in `Scaffold`** (im `build`, vermutlich direkt nach `body`):

```dart
floatingActionButton: FloatingActionButton.extended(
  onPressed: _addWaypoint,
  backgroundColor: accent,
  foregroundColor: Colors.white,
  icon: const Icon(Icons.flag_outlined),
  label: Text(AppStrings.button_add_waypoint),
),
```

**Erklärung:** Es gibt aktuell keinen FAB auf der Manage-Page (der "+ Punkt"-Flow läuft über StartPage). Dieser FAB ist ausschließlich für Waypoints.

### Schritt 5: `_deletePoint` für Waypoint anpassen

**Datei:** `flutter_app/lib/pages/manage_points_page.dart`

**Änderung:** Zeilen 118-146 (`_deletePoint`) — der Dialog-Text benutzt aktuell `point.name`, was bei Waypoints leer ist. Branching:

```dart
Future<void> _deletePoint(InterestPoint point) async {
  final String dialogContent = point.isWaypoint
      ? '${AppStrings.waypoint_delete_content}\n'
        '(${point.lat?.toStringAsFixed(5)}, ${point.lon?.toStringAsFixed(5)})'
      : '${AppStrings.delete_point_confirm_prefix}\n'
        '"${point.name}"\n${AppStrings.delete_point_confirm_suffix}';

  final String dialogTitle = point.isWaypoint
      ? AppStrings.waypoint_delete_title
      : AppStrings.delete_point_title;

  final confirm = await GradientConfirmDialog.show(
    context,
    title: dialogTitle,
    content: dialogContent,
    confirmText: AppStrings.button_delete,
    cancelText: AppStrings.button_cancel,
  );
  if (confirm != true) return;

  try {
    // deletePointMedia ist no-op bei leeren Pfaden, aber zur Sicherheit skip:
    if (!point.isWaypoint) {
      await _storage.deletePointMedia(point);
    }
    _tripElements.removeWhere((trip) => trip.pointId2 == point.id);

    final deletedOrder = point.tripOrder;
    _points.removeWhere((p) => p.id == point.id);

    for (var p in _points) {
      if (p.tripOrder > deletedOrder) p.tripOrder--;
    }

    await _saveData();
    await _loadPoints();

    final String successLabel = point.isWaypoint
        ? AppStrings.waypoint_label
        : '"${point.name}"';
    _showSuccessSnackBar('${AppStrings.snack_deleted} $successLabel');
  } catch (e) {
    _showErrorSnackBar('${AppStrings.snack_error} $e');
  }
}
```

### Schritt 6: Strings ergänzen

**Datei:** `flutter_app/lib/strings.dart`

**Änderung:** Folgende Konstanten zur Klasse `AppStrings` hinzufügen (Position egal, gruppiert mit anderen Delete/Manage-Strings):

```dart
// Waypoint
static const String waypoint_label = 'Wegpunkt';
static const String waypoint_delete_title = 'Wegpunkt löschen?';
static const String waypoint_delete_content = 'Diesen Wegpunkt wirklich entfernen?';
static const String button_change_position = 'Position ändern';
static const String button_add_waypoint = '+ Wegpunkt';
static const String waypoint_position_updated = 'Position aktualisiert';
static const String waypoint_added = 'Wegpunkt hinzugefügt';
```

---

## Aufrufer umstellen

| Datei | Zeile | Alter Aufruf | Neuer Aufruf |
|-------|-------|--------------|--------------|
| `flutter_app/lib/pages/manage_points_page.dart` | 99-112 | `InterestPoint(... tripOrder: p.tripOrder)` | `InterestPoint(... tripOrder: p.tripOrder, isWaypoint: p.isWaypoint)` |
| `flutter_app/lib/pages/manage_points_page.dart` | 352 | `PointWithRouteCard(...)` unconditional | Conditional: `isWaypoint ? WaypointCard(...) : PointWithRouteCard(...)` |
| `flutter_app/lib/pages/manage_points_page.dart` | 122-123 | `'${delete_point_confirm_prefix}\n"${point.name}"...'` | Dispatch: Waypoint-eigener Dialog-Text. |

---

## Validierung

### Manuelle Tests
- [ ] App starten → Manage-Page öffnen → "+ Wegpunkt"-FAB sichtbar unten rechts.
- [ ] Bestehende (normale) Punkte werden weiterhin als `PointWithRouteCard` gerendert.
- [ ] Manuell in `points.json` ein `isWaypoint: true` eintragen → nach App-Neustart erscheint dieser Punkt als `WaypointCard` mit "Wegpunkt"-Label + Koordinaten.
- [ ] Tap auf "Position ändern" öffnet `CoordinatePickerPage`; nach Auswahl ist die Position aktualisiert.
- [ ] Tap auf Delete-Button → Dialog mit Waypoint-spezifischem Text.
- [ ] Reorder: Waypoint kann per Long-Press nach oben/unten geschoben werden, `tripOrder` und `TripElement`s bleiben konsistent.
- [ ] Nach Reorder/Save: `points.json` enthält weiterhin `isWaypoint: true` für diesen Punkt (Flag nicht verloren).

### Automatisierte Tests
```bash
cd flutter_app && flutter analyze
cd flutter_app && flutter build apk --debug  # oder iOS-Äquivalent
```

### Erwartetes Verhalten
- Manage-Page kennt zwei Card-Typen.
- `_saveData` bewahrt alle Felder inkl. `isWaypoint`.
- FAB navigiert zu `CreateWaypointPage` (die in Plan 03 entsteht) und fügt bei Erfolg einen neuen Punkt hinzu.

## Rollback-Plan

1. `itemBuilder` wieder unconditional `PointWithRouteCard`.
2. FAB aus Scaffold entfernen.
3. Neue `waypoint_card.dart` löschen.
4. Imports/Strings entfernen.
5. `_saveData` kann mit dem `isWaypoint:`-Parameter bleiben (defensiver Default).

---

*Status: Ausstehend*
*Erstellt am: 2026-04-22*
