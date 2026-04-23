# Fix #2: GPS-Tracking Performance (O(n²))

## Symptom
Jeder GPS-Fix liest die gesamte `gps_track.json`-Datei, parst sie, hängt einen Eintrag an, schreibt sie neu. Nach N Fixes ist Gesamtaufwand O(N²). Bei realistischen Tracking-Szenarien (50m distanceFilter, 10k Punkte) führt das zu spürbaren UI-Rucklern und massivem IO.

## Ziel
O(1) pro Fix. Keine Regression für Upload/Read-Back.

## Lösung
**Siehe Fix #1 Option A**: Format-Umstellung auf NDJSON mit File-Append. Dies löst #2 automatisch mit.

## Alternative (falls Fix #1 nicht mit-migriert werden soll)
- **In-Memory-Buffer**: `GpsTrackingService` hält `List<GpsPoint>` im Memory, flush't alle 60 Sekunden oder bei 100 Einträgen.
  - Problem: App-Kill verliert ungeflushte Einträge. Für Always-On-Tracking unakzeptabel.
- **Chunk-Files**: pro Tag eine neue Datei (`gps_track_2026-04-23.json`), aktive Datei hat <2000 Einträge.
  - Komplexer Sync-Pfad, mehr Buchhaltung.

## Entscheidung
Kopple an Fix #1 (NDJSON + Append). Kein Extra-Plan.

## Verifikation
- Benchmark-Test: 10k `appendPoint` in Schleife → muss <3 Sekunden dauern (vorher: quadratisch, minutenlang).
