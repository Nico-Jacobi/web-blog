# Fix #1: Race Condition in GPS-Track-Persistierung

## Symptom
`appendPoint` führt read-modify-write auf `gps_track.json` ohne jede Synchronisation aus. Zwei Writer, die sich in der Praxis sehen:

1. **Foreground-Stream** in `GpsTrackingService.startTracking()` — schreibt bei jedem Position-Update (distanceFilter 50m).
2. **Background-Isolate** via Workmanager (`callbackDispatcher` → `recordBackgroundPosition`) — läuft in eigenem Dart-Isolate, kennt den Singleton im UI-Isolate nicht.

Beide rufen `appendPoint` → `loadTrack` → `track.add(p)` → `saveTrack(track)`. Zwischen `loadTrack` des einen und `saveTrack` des anderen wird der Punkt des ersten überschrieben.

## Ziel
Keine Datenverluste. Parallele Writer serialisieren sich.

## Optionen

### Option A: In-Memory-Mutex pro Isolate + append-only File-IO (empfohlen)
- Pro Isolate ein `Completer`-basiertes Lock um `appendPoint`.
- Statt die komplette Datei read-modify-write: **Append** eine einzelne Zeile im NDJSON-Format (`{"lat":...,"lon":...,"ts":"..."}\n`) an die Datei. File-Append auf POSIX/Android ist auf Zeilen-Level atomar bei kleinen Writes (<PIPE_BUF, hier ~100 Bytes). Siehe Fix #2 für das Format.
- Cross-Isolate: Workmanager-Isolate nutzt ebenfalls das File-Append → keine read-modify-write-Kollision mehr, da niemand mehr die Datei als Ganzes rewrited.

Vorteile: löst #1 + #2 auf einen Schlag. File-Append-Semantik ist robust genug.

### Option B: OS-Level File-Lock via `file_lock`-Package
- Mehr Komplexität, plattform-spezifische Edge-Cases.

### Option C: Alle GPS-Writes durch einen Channel zurück ins UI-Isolate routen
- Funktioniert nicht mehr, wenn App nicht läuft (Background-Isolate hat keine UI). Verworfen.

**Entscheidung: Option A** (gekoppelt an Fix #2).

## Implementation Steps

1. **Format-Migration** (Abhängigkeit von Plan #2):
   - Neues Persistierungs-Format: NDJSON in `gps_track.ndjson` statt monolithisches JSON-Array in `gps_track.json`.
   - Bei App-Start: wenn nur `gps_track.json` existiert, einmalig in `gps_track.ndjson` migrieren und `.json` löschen.

2. **`GpsTrackingService.appendPoint` umbauen**:
   ```dart
   static final _writeLock = Lock(); // package:synchronized
   static Future<void> appendPoint(GpsPoint point) async {
     await _writeLock.synchronized(() async {
       final file = await DataFile.gpsTrack.file; // jetzt .ndjson
       await file.writeAsString(
         '${jsonEncode(point.toJson())}\n',
         mode: FileMode.append,
         flush: false,
       );
     });
   }
   ```
   - `_writeLock` schützt innerhalb des Isolates gegen parallele Stream-Events.
   - File-Append ist atomar auf Zeilen-Level (<PIPE_BUF) → cross-Isolate sicher genug für GPS-Samples.

3. **`loadTrack` umbauen**: Zeilenweise parsen statt `jsonDecode(raw) as List`.
   ```dart
   final lines = await file.readAsLines();
   return lines
       .where((l) => l.trim().isNotEmpty)
       .map((l) => GpsPoint.fromJson(jsonDecode(l) as Map<String, dynamic>))
       .toList();
   ```

4. **`saveTrack` entfernen** — wird nicht mehr gebraucht; Append-Only.

5. **Upload im Sync-Service**: 
   - `sync_service.dart:428-448` liest jetzt `.ndjson`, parst zu Array, uploaded als JSON-Array (Server-Format bleibt unverändert → Website muss nicht angepasst werden).
   - Alternativ: Server-Endpoint `/me/blog/gps/append` mit line-delta-Upload. Nicht Teil dieses Fixes.

6. **Test**: Neuer Unit-Test `gps_tracking_service_test.dart` mit 200 parallelen `appendPoint`-Calls — Erwartung: 200 Einträge am Ende.

## Betroffene Dateien
- `flutter_app/lib/services/gps_tracking_service.dart`
- `flutter_app/lib/model/data_file.dart` (path → `.ndjson`)
- `flutter_app/lib/services/sync_service.dart` (GPS-Sync-Phase)
- `flutter_app/pubspec.yaml` (`synchronized`-Package)
- Neu: `flutter_app/test/gps_tracking_service_test.dart`

## Risiken
- Migration-Step einmalig, robust testen (auch den Fall "alte Datei kaputt")
- NDJSON vs. JSON für Server-Upload: Upload-Pfad parst clientseitig zu Array → Server kriegt weiter JSON-Array. Zero Breaking Change für Website.
