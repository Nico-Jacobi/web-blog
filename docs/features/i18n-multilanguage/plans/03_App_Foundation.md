# Plan 03: Flutter App i18n Foundation

## Ziel
Offizielles Flutter-Lokalisierungssystem aufsetzen: Packages hinzufügen, ARB-Dateien mit allen 83 Keys in Deutsch und Englisch erstellen, Code-Generator ausführen, `LanguageProvider` bauen und `MaterialApp` für Lokalisierung konfigurieren.

## Schnittstellen

### Input (Voraussetzungen)
- Keine vorherigen App-Pläne nötig

### Output (für Pläne 04.1 + 04.2)
- Generierte `AppLocalizations`-Klasse verfügbar via `import 'package:flutter_gen/gen_l10n/app_localizations.dart'`
- `AppLocalizations.of(context)!` funktioniert in allen Widgets unterhalb des `MaterialApp`
- `LanguageProvider` steht bereit für Sprachswitch in Settings
- `strings.dart` bleibt bis Plan 04.2 erhalten (parallel zum neuen System)

---

## Implementierungsschritte

### Schritt 1: `pubspec.yaml` aktualisieren

Unter `dependencies:` hinzufügen (korrekt eingerückt, nicht unter `flutter_icons`):
```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0
  # ... restliche dependencies bleiben
```

Unter `flutter:` Block hinzufügen:
```yaml
flutter:
  generate: true
  uses-material-design: true
  # ... restliche flutter-Einträge bleiben
```

### Schritt 2: `flutter_app/l10n.yaml` erstellen
```yaml
arb-dir: lib/l10n
template-arb-file: app_de.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
```

### Schritt 3: `flutter_app/lib/l10n/app_de.arb` erstellen
Alle 83 Keys aus `strings.dart` als ARB-Format (Deutsch):
```json
{
  "@@locale": "de",

  "browseFilesTitle": "Dateien durchsuchen",
  "@browseFilesTitle": {},

  "pathPrefix": "Pfad: ",
  "@pathPrefix": {},

  "snackBarDeleted": "Erfolgreich gelöscht",
  "@snackBarDeleted": {},

  "snackBarError": "Fehler: ",
  "@snackBarError": {},

  "buttonRetry": "Erneut versuchen",
  "@buttonRetry": {},

  "noDataText": "Keine Dateien gefunden",
  "@noDataText": {},

  "parentFolder": "..",
  "@parentFolder": {},

  "modifiedPrefix": "Geändert: ",
  "@modifiedPrefix": {},

  "sizePrefix": "Größe: ",
  "@sizePrefix": {},

  "coordinatePickerTitle": "Koordinaten wählen",
  "@coordinatePickerTitle": {},

  "searchHint": "Ort suchen...",
  "@searchHint": {},

  "buttonCancel": "Abbrechen",
  "@buttonCancel": {},

  "buttonConfirm": "Bestätigen",
  "@buttonConfirm": {},

  "addPointTitleNew": "Neuer Wegpunkt",
  "@addPointTitleNew": {},

  "addPointTitleEdit": "Wegpunkt bearbeiten",
  "@addPointTitleEdit": {},

  "addPointTitleImage": "Titelbild hinzufügen",
  "@addPointTitleImage": {},

  "fieldName": "Name",
  "@fieldName": {},

  "fieldShortDescription": "Kurzbeschreibung",
  "@fieldShortDescription": {},

  "fieldLatitude": "Breitengrad",
  "@fieldLatitude": {},

  "fieldLongitude": "Längengrad",
  "@fieldLongitude": {},

  "fieldDate": "Datum",
  "@fieldDate": {},

  "fieldFullDescription": "Vollständige Beschreibung",
  "@fieldFullDescription": {},

  "tooltipPickOnMap": "Auf Karte wählen",
  "@tooltipPickOnMap": {},

  "galleryTitle": "Bildergalerie",
  "@galleryTitle": {},

  "linkPreviousTitle": "Verbindung zum vorherigen Punkt",
  "@linkPreviousTitle": {},

  "linkPreviousConnectTo": "Verbinden mit: ",
  "@linkPreviousConnectTo": {},

  "travelMethodTitle": "Reiseart",
  "@travelMethodTitle": {},

  "buttonSavePoint": "Punkt speichern",
  "@buttonSavePoint": {},

  "buttonUpdatePoint": "Änderungen speichern",
  "@buttonUpdatePoint": {},

  "discardChangesTitle": "Änderungen verwerfen?",
  "@discardChangesTitle": {},

  "discardChangesMessage": "Möchtest du die Änderungen wirklich verwerfen? Ungespeicherte Daten gehen verloren.",
  "@discardChangesMessage": {},

  "buttonDiscard": "Verwerfen",
  "@buttonDiscard": {},

  "errorTitleImageRequired": "Ein Titelbild ist erforderlich",
  "@errorTitleImageRequired": {},

  "infoDateLocation": "Datum und Standort werden automatisch aus deinen Bildern ermittelt, können aber jederzeit geändert werden. (Standort nur wenn GPS beim Fotografieren aktiv war)",
  "@infoDateLocation": {},

  "labelMediaGallery": "Galerie",
  "@labelMediaGallery": {},

  "mediaAddTitle": "Medien hinzufügen",
  "@mediaAddTitle": {},

  "mediaImagesTitle": "Bilder",
  "@mediaImagesTitle": {},

  "mediaImagesSubtitle": "Mehrere Fotos hinzufügen",
  "@mediaImagesSubtitle": {},

  "mediaVideoTitle": "Video",
  "@mediaVideoTitle": {},

  "mediaVideoSubtitle": "Video hinzufügen (max. 5 Min.)",
  "@mediaVideoSubtitle": {},

  "errorPickerFailed": "Bilder konnten nicht gewählt werden",
  "@errorPickerFailed": {},

  "managePointsTitle": "Wegpunkte verwalten",
  "@managePointsTitle": {},

  "infoManagePoints": "Tippen zum Bearbeiten. Halten und Ziehen zum Sortieren. Tippe auf das Routen-Icon, um das Verkehrsmittel zu ändern.",
  "@infoManagePoints": {},

  "emptyPointsTitle": "Noch keine Punkte",
  "@emptyPointsTitle": {},

  "emptyPointsSubtitle": "Erstelle deinen ersten Wegpunkt!",
  "@emptyPointsSubtitle": {},

  "deletePointTitle": "Punkt löschen?",
  "@deletePointTitle": {},

  "deletePointConfirmPrefix": "Möchtest du",
  "@deletePointConfirmPrefix": {},

  "deletePointConfirmSuffix": "wirklich löschen? Dabei wird auch die Route zu diesem Punkt entfernt.",
  "@deletePointConfirmSuffix": {},

  "buttonDelete": "Löschen",
  "@buttonDelete": {},

  "errorLoadingPoints": "Fehler beim Laden:",
  "@errorLoadingPoints": {},

  "snackDeleted": "Punkt gelöscht",
  "@snackDeleted": {},

  "snackMethodUpdated": "Reiseart aktualisiert",
  "@snackMethodUpdated": {},

  "snackError": "Fehler:",
  "@snackError": {},

  "settingsTitle": "Einstellungen",
  "@settingsTitle": {},

  "fieldServerUrl": "Server-URL",
  "@fieldServerUrl": {},

  "hintServerUrl": "https://dein-server.de",
  "@hintServerUrl": {},

  "fieldAuthToken": "Authentifizierungs-Token",
  "@fieldAuthToken": {},

  "buttonSaveSettings": "Einstellungen speichern",
  "@buttonSaveSettings": {},

  "snackSettingsSaved": "Einstellungen erfolgreich gespeichert",
  "@snackSettingsSaved": {},

  "deactivateSyncSetting": "Synchronisierung",
  "@deactivateSyncSetting": {},

  "googlePhotoPickerSetting": "Google Photos",
  "@googlePhotoPickerSetting": {},

  "settingsLanguage": "Sprache",
  "@settingsLanguage": {},

  "appHeroTitle": "Australien Blog",
  "@appHeroTitle": {},

  "addPointButton": "Punkt hinzufügen",
  "@addPointButton": {},

  "infoDialogTitle": "Information",
  "@infoDialogTitle": {},

  "buttonClose": "Schließen",
  "@buttonClose": {},

  "infoTooltip": "Info anzeigen",
  "@infoTooltip": {},

  "travelMethodDialogTitle": "Verkehrsmittel wählen",
  "@travelMethodDialogTitle": {},

  "tripMethodBoat": "Boot",
  "@tripMethodBoat": {},

  "tripMethodCar": "Auto",
  "@tripMethodCar": {},

  "tripMethodRv": "Wohnmobil",
  "@tripMethodRv": {},

  "tripMethodPlane": "Flugzeug",
  "@tripMethodPlane": {},

  "tripMethodFoot": "Zu Fuß",
  "@tripMethodFoot": {},

  "tripMethodMisc": "Sonstiges",
  "@tripMethodMisc": {},

  "tripMethodBus": "Bus",
  "@tripMethodBus": {},

  "syncSpinnerText": "Wird synchronisiert...",
  "@syncSpinnerText": {},

  "syncFilesTitle": "Dateien synchronisieren",
  "@syncFilesTitle": {},

  "syncStatusTitle": "Synchronisierungsstatus",
  "@syncStatusTitle": {},

  "syncStatusErrorLoading": "Fehler beim Laden des Status: ",
  "@syncStatusErrorLoading": {},

  "syncStatusInProgress": "Synchronisierung bereits im Gange",
  "@syncStatusInProgress": {},

  "syncStatusSuccess": "Synchronisierung erfolgreich abgeschlossen!",
  "@syncStatusSuccess": {},

  "syncStatusFailed": "Synchronisierung fehlgeschlagen: ",
  "@syncStatusFailed": {},

  "syncDownloading": "Lade vom Server...",
  "@syncDownloading": {},

  "syncDownloadSuccess": "Erfolgreich vom Server geladen",
  "@syncDownloadSuccess": {},

  "syncDownloadFailed": "Download vom Server fehlgeschlagen",
  "@syncDownloadFailed": {},

  "syncDataReplaced": "Lokale Daten wurden durch Server-Daten ersetzt",
  "@syncDataReplaced": {},

  "syncReverseFailed": "Download fehlgeschlagen: ",
  "@syncReverseFailed": {},

  "syncDialogTitle": "Daten herunterladen?",
  "@syncDialogTitle": {},

  "syncDialogContent": "Dies ersetzt ALLE lokalen Daten mit Daten vom Server. Nicht synchronisierte lokale Änderungen gehen verloren.\n\nMöchtest du fortfahren?",
  "@syncDialogContent": {},

  "syncDialogConfirm": "Fortfahren",
  "@syncDialogConfirm": {},

  "syncStatSynced": "Synchr.",
  "@syncStatSynced": {},

  "syncStatUnsynced": "Nicht Synchr.",
  "@syncStatUnsynced": {},

  "syncStatTotal": "Gesamt",
  "@syncStatTotal": {},

  "buttonSyncUpload": "Hochladen",
  "@buttonSyncUpload": {},

  "buttonSyncDownload": "Von Server laden",
  "@buttonSyncDownload": {},

  "syncNoFiles": "Keine Dateien zum Synchronisieren",
  "@syncNoFiles": {},

  "syncFileMetadata": "Metadaten",
  "@syncFileMetadata": {},

  "syncFileSynced": "Synchronisiert",
  "@syncFileSynced": {},

  "syncFileNotSynced": "Nicht synchronisiert",
  "@syncFileNotSynced": {},

  "syncFileNotFound": "Datei lokal nicht gefunden",
  "@syncFileNotFound": {},

  "deleteItemTitle": "Element löschen",
  "@deleteItemTitle": {},

  "deleteItemConfirmPrefix": "Willst du",
  "@deleteItemConfirmPrefix": {},

  "deleteItemConfirmSuffix": "wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
  "@deleteItemConfirmSuffix": {},

  "permRequiredTitle": "Speicherberechtigung erforderlich",
  "@permRequiredTitle": {},

  "permRequiredBody": "Diese App benötigt Zugriff auf den Speicher, um Dateien in deinen Downloads-Ordner herunterzuladen.\n\nBitte gewähre die Berechtigung \"Zugriff auf alle Dateien\" in den Einstellungen.",
  "@permRequiredBody": {},

  "permDeniedSnackbar": "Speicherberechtigung ist erforderlich, um Dateien im Downloads-Ordner herunterzuladen",
  "@permDeniedSnackbar": {},

  "downloadSuccessPrefix": "✅ Backup gespeichert in:\nDownload/",
  "@downloadSuccessPrefix": {},

  "waypointLabel": "Wegpunkt",
  "@waypointLabel": {},

  "waypointDeleteTitle": "Wegpunkt löschen?",
  "@waypointDeleteTitle": {},

  "waypointDeleteContent": "Diesen Wegpunkt wirklich entfernen?",
  "@waypointDeleteContent": {},

  "buttonChangePosition": "Position ändern",
  "@buttonChangePosition": {},

  "buttonAddWaypoint": "Wegpunkt",
  "@buttonAddWaypoint": {},

  "waypointPositionUpdated": "Position aktualisiert",
  "@waypointPositionUpdated": {},

  "waypointAdded": "Wegpunkt hinzugefügt",
  "@waypointAdded": {},

  "createWaypointTitle": "Wegpunkt erstellen",
  "@createWaypointTitle": {},

  "chooseOnMap": "Auf Karte auswählen",
  "@chooseOnMap": {},

  "enterCoordinatesManually": "Koordinaten manuell eingeben",
  "@enterCoordinatesManually": {},

  "labelLat": "Breitengrad (Lat)",
  "@labelLat": {},

  "labelLon": "Längengrad (Lon)",
  "@labelLon": {},

  "errorInvalidCoordinates": "Ungültige Koordinaten",
  "@errorInvalidCoordinates": {},

  "buttonSave": "Speichern",
  "@buttonSave": {},

  "errorSavingData": "Fehler beim Speichern der Daten",
  "@errorSavingData": {},

  "errorPickerFailed": "Bilder konnten nicht gewählt werden",
  "@errorPickerFailed": {},

  "notifSyncTitle": "Sync abgeschlossen",
  "@notifSyncTitle": {},

  "notifSync1": "Alle Kängurus wurden erfolgreich durchs Kabel geschubst.",
  "@notifSync1": {},

  "notifSync2": "Deine Koalas sind sicher im Cloud-Eukalyptus gelandet.",
  "@notifSync2": {},

  "notifSync3": "Krokodile abgewehrt, Daten erfolgreich hochgeladen.",
  "@notifSync3": {},

  "notifSync4": "Daten-Roadtrip beendet. Alles sicher verstaut!",
  "@notifSync4": {},

  "notifSync5": "Wombats haben deine Dateien artgerecht vergraben.",
  "@notifSync5": {},

  "notifSync6": "Die Emus haben die Daten nach Hause gebracht.",
  "@notifSync6": {}
}
```

### Schritt 4: `flutter_app/lib/l10n/app_en.arb` erstellen
Gleiche Key-Struktur, englische Werte:
```json
{
  "@@locale": "en",

  "browseFilesTitle": "Browse Files",
  "pathPrefix": "Path: ",
  "snackBarDeleted": "Successfully deleted",
  "snackBarError": "Error: ",
  "buttonRetry": "Retry",
  "noDataText": "No files found",
  "parentFolder": "..",
  "modifiedPrefix": "Modified: ",
  "sizePrefix": "Size: ",
  "coordinatePickerTitle": "Pick Coordinates",
  "searchHint": "Search location...",
  "buttonCancel": "Cancel",
  "buttonConfirm": "Confirm",
  "addPointTitleNew": "New Waypoint",
  "addPointTitleEdit": "Edit Waypoint",
  "addPointTitleImage": "Add Cover Image",
  "fieldName": "Name",
  "fieldShortDescription": "Short Description",
  "fieldLatitude": "Latitude",
  "fieldLongitude": "Longitude",
  "fieldDate": "Date",
  "fieldFullDescription": "Full Description",
  "tooltipPickOnMap": "Pick on Map",
  "galleryTitle": "Photo Gallery",
  "linkPreviousTitle": "Link to Previous Point",
  "linkPreviousConnectTo": "Connect to: ",
  "travelMethodTitle": "Travel Method",
  "buttonSavePoint": "Save Point",
  "buttonUpdatePoint": "Save Changes",
  "discardChangesTitle": "Discard Changes?",
  "discardChangesMessage": "Do you really want to discard your changes? Unsaved data will be lost.",
  "buttonDiscard": "Discard",
  "errorTitleImageRequired": "A cover image is required",
  "infoDateLocation": "Date and location are automatically extracted from your photos, but can be changed at any time. (Location only if GPS was active while taking photos)",
  "labelMediaGallery": "Gallery",
  "mediaAddTitle": "Add Media",
  "mediaImagesTitle": "Photos",
  "mediaImagesSubtitle": "Add multiple photos",
  "mediaVideoTitle": "Video",
  "mediaVideoSubtitle": "Add video (max. 5 min.)",
  "errorPickerFailed": "Could not select images",
  "managePointsTitle": "Manage Waypoints",
  "infoManagePoints": "Tap to edit. Hold and drag to reorder. Tap the route icon to change the travel method.",
  "emptyPointsTitle": "No points yet",
  "emptyPointsSubtitle": "Create your first waypoint!",
  "deletePointTitle": "Delete Point?",
  "deletePointConfirmPrefix": "Do you want to delete",
  "deletePointConfirmSuffix": "? This will also remove the route to this point.",
  "buttonDelete": "Delete",
  "errorLoadingPoints": "Error loading:",
  "snackDeleted": "Point deleted",
  "snackMethodUpdated": "Travel method updated",
  "snackError": "Error:",
  "settingsTitle": "Settings",
  "fieldServerUrl": "Server URL",
  "hintServerUrl": "https://your-server.com",
  "fieldAuthToken": "Authentication Token",
  "buttonSaveSettings": "Save Settings",
  "snackSettingsSaved": "Settings saved successfully",
  "deactivateSyncSetting": "Synchronization",
  "googlePhotoPickerSetting": "Google Photos",
  "settingsLanguage": "Language",
  "appHeroTitle": "Australia Blog",
  "addPointButton": "Add Point",
  "infoDialogTitle": "Information",
  "buttonClose": "Close",
  "infoTooltip": "Show info",
  "travelMethodDialogTitle": "Choose Travel Method",
  "tripMethodBoat": "Boat",
  "tripMethodCar": "Car",
  "tripMethodRv": "Motorhome",
  "tripMethodPlane": "Plane",
  "tripMethodFoot": "On foot",
  "tripMethodMisc": "Other",
  "tripMethodBus": "Bus",
  "syncSpinnerText": "Syncing...",
  "syncFilesTitle": "Sync Files",
  "syncStatusTitle": "Sync Status",
  "syncStatusErrorLoading": "Error loading status: ",
  "syncStatusInProgress": "Sync already in progress",
  "syncStatusSuccess": "Sync completed successfully!",
  "syncStatusFailed": "Sync failed: ",
  "syncDownloading": "Downloading from server...",
  "syncDownloadSuccess": "Successfully downloaded from server",
  "syncDownloadFailed": "Download from server failed",
  "syncDataReplaced": "Local data replaced with server data",
  "syncReverseFailed": "Download failed: ",
  "syncDialogTitle": "Download Data?",
  "syncDialogContent": "This will replace ALL local data with data from the server. Unsynced local changes will be lost.\n\nDo you want to continue?",
  "syncDialogConfirm": "Continue",
  "syncStatSynced": "Synced",
  "syncStatUnsynced": "Unsynced",
  "syncStatTotal": "Total",
  "buttonSyncUpload": "Upload",
  "buttonSyncDownload": "Download from Server",
  "syncNoFiles": "No files to sync",
  "syncFileMetadata": "Metadata",
  "syncFileSynced": "Synced",
  "syncFileNotSynced": "Not synced",
  "syncFileNotFound": "File not found locally",
  "deleteItemTitle": "Delete Item",
  "deleteItemConfirmPrefix": "Do you want to delete",
  "deleteItemConfirmSuffix": "? This cannot be undone.",
  "permRequiredTitle": "Storage Permission Required",
  "permRequiredBody": "This app needs access to storage to download files to your Downloads folder.\n\nPlease grant \"Access to all files\" permission in Settings.",
  "permDeniedSnackbar": "Storage permission is required to download files to the Downloads folder",
  "downloadSuccessPrefix": "✅ Backup saved in:\nDownload/",
  "waypointLabel": "Waypoint",
  "waypointDeleteTitle": "Delete Waypoint?",
  "waypointDeleteContent": "Remove this waypoint?",
  "buttonChangePosition": "Change Position",
  "buttonAddWaypoint": "Waypoint",
  "waypointPositionUpdated": "Position updated",
  "waypointAdded": "Waypoint added",
  "createWaypointTitle": "Create Waypoint",
  "chooseOnMap": "Choose on Map",
  "enterCoordinatesManually": "Enter coordinates manually",
  "labelLat": "Latitude (Lat)",
  "labelLon": "Longitude (Lon)",
  "errorInvalidCoordinates": "Invalid coordinates",
  "buttonSave": "Save",
  "errorSavingData": "Error saving data",
  "errorPickerFailed": "Could not select images",
  "notifSyncTitle": "Sync complete",
  "notifSync1": "All kangaroos successfully pushed through the cable.",
  "notifSync2": "Your koalas have safely landed in the cloud eucalyptus.",
  "notifSync3": "Crocodiles repelled, data successfully uploaded.",
  "notifSync4": "Data road trip complete. Everything stored safely!",
  "notifSync5": "Wombats have buried your files in their natural habitat.",
  "notifSync6": "The emus have brought the data home."
}
```

### Schritt 5: Code generieren
```bash
cd flutter_app
flutter gen-l10n
```
Prüfen ob `.dart_tool/flutter_gen/gen_l10n/app_localizations.dart` erzeugt wurde.

### Schritt 6: `flutter_app/lib/providers/language_provider.dart` erstellen
```dart
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageProvider extends ChangeNotifier {
  static const _key = 'app_language';
  Locale _locale = const Locale('de');

  Locale get locale => _locale;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_key);
    if (code != null) {
      _locale = Locale(code);
      notifyListeners();
    }
  }

  Future<void> setLanguage(String languageCode) async {
    _locale = Locale(languageCode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, languageCode);
    notifyListeners();
  }
}
```

### Schritt 7: `main.dart` — MaterialApp konfigurieren

Imports hinzufügen:
```dart
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:provider/provider.dart';
import 'providers/language_provider.dart';
```

`main()`-Funktion: `LanguageProvider` laden vor `runApp`:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final languageProvider = LanguageProvider();
  await languageProvider.load();
  // ... restliche Initialisierung
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: languageProvider),
        // ... restliche Provider
      ],
      child: const MyApp(),
    ),
  );
}
```

`MaterialApp` erweitern:
```dart
Consumer<LanguageProvider>(
  builder: (context, langProvider, child) => MaterialApp(
    locale: langProvider.locale,
    supportedLocales: AppLocalizations.supportedLocales,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    // ... restliche MaterialApp-Properties
  ),
)
```

---

## Neue Dateien
| Datei | Beschreibung |
|-------|-------------|
| `flutter_app/l10n.yaml` | Code-Generator-Konfiguration |
| `flutter_app/lib/l10n/app_de.arb` | Deutsche Übersetzungen (90 Keys) |
| `flutter_app/lib/l10n/app_en.arb` | Englische Übersetzungen (90 Keys) |
| `flutter_app/lib/providers/language_provider.dart` | Sprach-State-Management |

## Geänderte Dateien
| Datei | Änderung |
|-------|---------|
| `flutter_app/pubspec.yaml` | `flutter_localizations`, `intl`, `generate: true` |
| `flutter_app/lib/main.dart` | Imports, Provider-Wrap, MaterialApp-Locale |

## Größen-Check
- Neue Dateien: 4 ✓ (unter Schwellwert 5)
- Geänderte Dateien: 2 ✓ (unter Schwellwert 10)
- Implementierungsschritte: 7 ✓ (unter Schwellwert 8)

## Verifikation
- [ ] `flutter pub get` läuft fehlerfrei
- [ ] `flutter gen-l10n` erzeugt `app_localizations.dart`
- [ ] `AppLocalizations.of(context)` gibt in einem Test-Widget nicht null zurück
- [ ] App startet ohne Fehler
- [ ] `LanguageProvider` lässt sich per `context.read<LanguageProvider>()` auslesen

---
*Plan 03 von 5 | Erstellt: 2026-04-22*
