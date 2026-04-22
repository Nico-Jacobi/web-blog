import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('de'),
    Locale('en'),
  ];

  /// No description provided for @browseFilesTitle.
  ///
  /// In de, this message translates to:
  /// **'Dateien durchsuchen'**
  String get browseFilesTitle;

  /// No description provided for @pathPrefix.
  ///
  /// In de, this message translates to:
  /// **'Pfad: '**
  String get pathPrefix;

  /// No description provided for @snackBarDeleted.
  ///
  /// In de, this message translates to:
  /// **'Erfolgreich gelöscht'**
  String get snackBarDeleted;

  /// No description provided for @snackBarError.
  ///
  /// In de, this message translates to:
  /// **'Fehler: '**
  String get snackBarError;

  /// No description provided for @buttonRetry.
  ///
  /// In de, this message translates to:
  /// **'Erneut versuchen'**
  String get buttonRetry;

  /// No description provided for @noDataText.
  ///
  /// In de, this message translates to:
  /// **'Keine Dateien gefunden'**
  String get noDataText;

  /// No description provided for @parentFolder.
  ///
  /// In de, this message translates to:
  /// **'..'**
  String get parentFolder;

  /// No description provided for @modifiedPrefix.
  ///
  /// In de, this message translates to:
  /// **'Geändert: '**
  String get modifiedPrefix;

  /// No description provided for @sizePrefix.
  ///
  /// In de, this message translates to:
  /// **'Größe: '**
  String get sizePrefix;

  /// No description provided for @coordinatePickerTitle.
  ///
  /// In de, this message translates to:
  /// **'Koordinaten wählen'**
  String get coordinatePickerTitle;

  /// No description provided for @searchHint.
  ///
  /// In de, this message translates to:
  /// **'Ort suchen...'**
  String get searchHint;

  /// No description provided for @buttonCancel.
  ///
  /// In de, this message translates to:
  /// **'Abbrechen'**
  String get buttonCancel;

  /// No description provided for @buttonConfirm.
  ///
  /// In de, this message translates to:
  /// **'Bestätigen'**
  String get buttonConfirm;

  /// No description provided for @addPointTitleNew.
  ///
  /// In de, this message translates to:
  /// **'Neuer Wegpunkt'**
  String get addPointTitleNew;

  /// No description provided for @addPointTitleEdit.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt bearbeiten'**
  String get addPointTitleEdit;

  /// No description provided for @addPointTitleImage.
  ///
  /// In de, this message translates to:
  /// **'Titelbild hinzufügen'**
  String get addPointTitleImage;

  /// No description provided for @fieldName.
  ///
  /// In de, this message translates to:
  /// **'Name'**
  String get fieldName;

  /// No description provided for @fieldShortDescription.
  ///
  /// In de, this message translates to:
  /// **'Kurzbeschreibung'**
  String get fieldShortDescription;

  /// No description provided for @fieldLatitude.
  ///
  /// In de, this message translates to:
  /// **'Breitengrad'**
  String get fieldLatitude;

  /// No description provided for @fieldLongitude.
  ///
  /// In de, this message translates to:
  /// **'Längengrad'**
  String get fieldLongitude;

  /// No description provided for @fieldDate.
  ///
  /// In de, this message translates to:
  /// **'Datum'**
  String get fieldDate;

  /// No description provided for @fieldFullDescription.
  ///
  /// In de, this message translates to:
  /// **'Vollständige Beschreibung'**
  String get fieldFullDescription;

  /// No description provided for @tooltipPickOnMap.
  ///
  /// In de, this message translates to:
  /// **'Auf Karte wählen'**
  String get tooltipPickOnMap;

  /// No description provided for @galleryTitle.
  ///
  /// In de, this message translates to:
  /// **'Bildergalerie'**
  String get galleryTitle;

  /// No description provided for @linkPreviousTitle.
  ///
  /// In de, this message translates to:
  /// **'Verbindung zum vorherigen Punkt'**
  String get linkPreviousTitle;

  /// No description provided for @linkPreviousConnectTo.
  ///
  /// In de, this message translates to:
  /// **'Verbinden mit: '**
  String get linkPreviousConnectTo;

  /// No description provided for @travelMethodTitle.
  ///
  /// In de, this message translates to:
  /// **'Reiseart'**
  String get travelMethodTitle;

  /// No description provided for @buttonSavePoint.
  ///
  /// In de, this message translates to:
  /// **'Punkt speichern'**
  String get buttonSavePoint;

  /// No description provided for @buttonUpdatePoint.
  ///
  /// In de, this message translates to:
  /// **'Änderungen speichern'**
  String get buttonUpdatePoint;

  /// No description provided for @discardChangesTitle.
  ///
  /// In de, this message translates to:
  /// **'Änderungen verwerfen?'**
  String get discardChangesTitle;

  /// No description provided for @discardChangesMessage.
  ///
  /// In de, this message translates to:
  /// **'Möchtest du die Änderungen wirklich verwerfen? Ungespeicherte Daten gehen verloren.'**
  String get discardChangesMessage;

  /// No description provided for @buttonDiscard.
  ///
  /// In de, this message translates to:
  /// **'Verwerfen'**
  String get buttonDiscard;

  /// No description provided for @errorTitleImageRequired.
  ///
  /// In de, this message translates to:
  /// **'Ein Titelbild ist erforderlich'**
  String get errorTitleImageRequired;

  /// No description provided for @infoDateLocation.
  ///
  /// In de, this message translates to:
  /// **'Datum und Standort werden automatisch aus deinen Bildern ermittelt, können aber jederzeit geändert werden. (Standort nur wenn GPS beim Fotografieren aktiv war)'**
  String get infoDateLocation;

  /// No description provided for @labelMediaGallery.
  ///
  /// In de, this message translates to:
  /// **'Galerie'**
  String get labelMediaGallery;

  /// No description provided for @mediaAddTitle.
  ///
  /// In de, this message translates to:
  /// **'Medien hinzufügen'**
  String get mediaAddTitle;

  /// No description provided for @mediaImagesTitle.
  ///
  /// In de, this message translates to:
  /// **'Bilder'**
  String get mediaImagesTitle;

  /// No description provided for @mediaImagesSubtitle.
  ///
  /// In de, this message translates to:
  /// **'Mehrere Fotos hinzufügen'**
  String get mediaImagesSubtitle;

  /// No description provided for @mediaVideoTitle.
  ///
  /// In de, this message translates to:
  /// **'Video'**
  String get mediaVideoTitle;

  /// No description provided for @mediaVideoSubtitle.
  ///
  /// In de, this message translates to:
  /// **'Video hinzufügen (max. 5 Min.)'**
  String get mediaVideoSubtitle;

  /// No description provided for @errorPickerFailed.
  ///
  /// In de, this message translates to:
  /// **'Bilder konnten nicht gewählt werden'**
  String get errorPickerFailed;

  /// No description provided for @managePointsTitle.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkte verwalten'**
  String get managePointsTitle;

  /// No description provided for @infoManagePoints.
  ///
  /// In de, this message translates to:
  /// **'Tippen zum Bearbeiten. Halten und Ziehen zum Sortieren. Tippe auf das Routen-Icon, um das Verkehrsmittel zu ändern.'**
  String get infoManagePoints;

  /// No description provided for @emptyPointsTitle.
  ///
  /// In de, this message translates to:
  /// **'Noch keine Punkte'**
  String get emptyPointsTitle;

  /// No description provided for @emptyPointsSubtitle.
  ///
  /// In de, this message translates to:
  /// **'Erstelle deinen ersten Wegpunkt!'**
  String get emptyPointsSubtitle;

  /// No description provided for @deletePointTitle.
  ///
  /// In de, this message translates to:
  /// **'Punkt löschen?'**
  String get deletePointTitle;

  /// No description provided for @deletePointConfirmPrefix.
  ///
  /// In de, this message translates to:
  /// **'Möchtest du'**
  String get deletePointConfirmPrefix;

  /// No description provided for @deletePointConfirmSuffix.
  ///
  /// In de, this message translates to:
  /// **'wirklich löschen? Dabei wird auch die Route zu diesem Punkt entfernt.'**
  String get deletePointConfirmSuffix;

  /// No description provided for @buttonDelete.
  ///
  /// In de, this message translates to:
  /// **'Löschen'**
  String get buttonDelete;

  /// No description provided for @errorLoadingPoints.
  ///
  /// In de, this message translates to:
  /// **'Fehler beim Laden:'**
  String get errorLoadingPoints;

  /// No description provided for @snackDeleted.
  ///
  /// In de, this message translates to:
  /// **'Punkt gelöscht'**
  String get snackDeleted;

  /// No description provided for @snackMethodUpdated.
  ///
  /// In de, this message translates to:
  /// **'Reiseart aktualisiert'**
  String get snackMethodUpdated;

  /// No description provided for @snackError.
  ///
  /// In de, this message translates to:
  /// **'Fehler:'**
  String get snackError;

  /// No description provided for @settingsTitle.
  ///
  /// In de, this message translates to:
  /// **'Einstellungen'**
  String get settingsTitle;

  /// No description provided for @fieldServerUrl.
  ///
  /// In de, this message translates to:
  /// **'Server-URL'**
  String get fieldServerUrl;

  /// No description provided for @hintServerUrl.
  ///
  /// In de, this message translates to:
  /// **'https://dein-server.de'**
  String get hintServerUrl;

  /// No description provided for @fieldAuthToken.
  ///
  /// In de, this message translates to:
  /// **'Authentifizierungs-Token'**
  String get fieldAuthToken;

  /// No description provided for @buttonSaveSettings.
  ///
  /// In de, this message translates to:
  /// **'Einstellungen speichern'**
  String get buttonSaveSettings;

  /// No description provided for @snackSettingsSaved.
  ///
  /// In de, this message translates to:
  /// **'Einstellungen erfolgreich gespeichert'**
  String get snackSettingsSaved;

  /// No description provided for @deactivateSyncSetting.
  ///
  /// In de, this message translates to:
  /// **'Synchronisierung'**
  String get deactivateSyncSetting;

  /// No description provided for @googlePhotoPickerSetting.
  ///
  /// In de, this message translates to:
  /// **'Google Photos'**
  String get googlePhotoPickerSetting;

  /// No description provided for @settingsLanguage.
  ///
  /// In de, this message translates to:
  /// **'Sprache'**
  String get settingsLanguage;

  /// No description provided for @appHeroTitle.
  ///
  /// In de, this message translates to:
  /// **'Australien Blog'**
  String get appHeroTitle;

  /// No description provided for @addPointButton.
  ///
  /// In de, this message translates to:
  /// **'Punkt hinzufügen'**
  String get addPointButton;

  /// No description provided for @infoDialogTitle.
  ///
  /// In de, this message translates to:
  /// **'Information'**
  String get infoDialogTitle;

  /// No description provided for @buttonClose.
  ///
  /// In de, this message translates to:
  /// **'Schließen'**
  String get buttonClose;

  /// No description provided for @infoTooltip.
  ///
  /// In de, this message translates to:
  /// **'Info anzeigen'**
  String get infoTooltip;

  /// No description provided for @travelMethodDialogTitle.
  ///
  /// In de, this message translates to:
  /// **'Verkehrsmittel wählen'**
  String get travelMethodDialogTitle;

  /// No description provided for @tripMethodBoat.
  ///
  /// In de, this message translates to:
  /// **'Boot'**
  String get tripMethodBoat;

  /// No description provided for @tripMethodCar.
  ///
  /// In de, this message translates to:
  /// **'Auto'**
  String get tripMethodCar;

  /// No description provided for @tripMethodRv.
  ///
  /// In de, this message translates to:
  /// **'Wohnmobil'**
  String get tripMethodRv;

  /// No description provided for @tripMethodPlane.
  ///
  /// In de, this message translates to:
  /// **'Flugzeug'**
  String get tripMethodPlane;

  /// No description provided for @tripMethodFoot.
  ///
  /// In de, this message translates to:
  /// **'Zu Fuß'**
  String get tripMethodFoot;

  /// No description provided for @tripMethodMisc.
  ///
  /// In de, this message translates to:
  /// **'Sonstiges'**
  String get tripMethodMisc;

  /// No description provided for @tripMethodBus.
  ///
  /// In de, this message translates to:
  /// **'Bus'**
  String get tripMethodBus;

  /// No description provided for @syncSpinnerText.
  ///
  /// In de, this message translates to:
  /// **'Wird synchronisiert...'**
  String get syncSpinnerText;

  /// No description provided for @syncFilesTitle.
  ///
  /// In de, this message translates to:
  /// **'Dateien synchronisieren'**
  String get syncFilesTitle;

  /// No description provided for @syncStatusTitle.
  ///
  /// In de, this message translates to:
  /// **'Synchronisierungsstatus'**
  String get syncStatusTitle;

  /// No description provided for @syncStatusErrorLoading.
  ///
  /// In de, this message translates to:
  /// **'Fehler beim Laden des Status: '**
  String get syncStatusErrorLoading;

  /// No description provided for @syncStatusInProgress.
  ///
  /// In de, this message translates to:
  /// **'Synchronisierung bereits im Gange'**
  String get syncStatusInProgress;

  /// No description provided for @syncStatusSuccess.
  ///
  /// In de, this message translates to:
  /// **'Synchronisierung erfolgreich abgeschlossen!'**
  String get syncStatusSuccess;

  /// No description provided for @syncStatusFailed.
  ///
  /// In de, this message translates to:
  /// **'Synchronisierung fehlgeschlagen: '**
  String get syncStatusFailed;

  /// No description provided for @syncDownloading.
  ///
  /// In de, this message translates to:
  /// **'Lade vom Server...'**
  String get syncDownloading;

  /// No description provided for @syncDownloadSuccess.
  ///
  /// In de, this message translates to:
  /// **'Erfolgreich vom Server geladen'**
  String get syncDownloadSuccess;

  /// No description provided for @syncDownloadFailed.
  ///
  /// In de, this message translates to:
  /// **'Download vom Server fehlgeschlagen'**
  String get syncDownloadFailed;

  /// No description provided for @syncDataReplaced.
  ///
  /// In de, this message translates to:
  /// **'Lokale Daten wurden durch Server-Daten ersetzt'**
  String get syncDataReplaced;

  /// No description provided for @syncReverseFailed.
  ///
  /// In de, this message translates to:
  /// **'Download fehlgeschlagen: '**
  String get syncReverseFailed;

  /// No description provided for @syncDialogTitle.
  ///
  /// In de, this message translates to:
  /// **'Daten herunterladen?'**
  String get syncDialogTitle;

  /// No description provided for @syncDialogContent.
  ///
  /// In de, this message translates to:
  /// **'Dies ersetzt ALLE lokalen Daten mit Daten vom Server. Nicht synchronisierte lokale Änderungen gehen verloren.\n\nMöchtest du fortfahren?'**
  String get syncDialogContent;

  /// No description provided for @syncDialogConfirm.
  ///
  /// In de, this message translates to:
  /// **'Fortfahren'**
  String get syncDialogConfirm;

  /// No description provided for @syncStatSynced.
  ///
  /// In de, this message translates to:
  /// **'Synchr.'**
  String get syncStatSynced;

  /// No description provided for @syncStatUnsynced.
  ///
  /// In de, this message translates to:
  /// **'Nicht Synchr.'**
  String get syncStatUnsynced;

  /// No description provided for @syncStatTotal.
  ///
  /// In de, this message translates to:
  /// **'Gesamt'**
  String get syncStatTotal;

  /// No description provided for @buttonSyncUpload.
  ///
  /// In de, this message translates to:
  /// **'Hochladen'**
  String get buttonSyncUpload;

  /// No description provided for @buttonSyncDownload.
  ///
  /// In de, this message translates to:
  /// **'Von Server laden'**
  String get buttonSyncDownload;

  /// No description provided for @syncNoFiles.
  ///
  /// In de, this message translates to:
  /// **'Keine Dateien zum Synchronisieren'**
  String get syncNoFiles;

  /// No description provided for @syncFileMetadata.
  ///
  /// In de, this message translates to:
  /// **'Metadaten'**
  String get syncFileMetadata;

  /// No description provided for @syncFileSynced.
  ///
  /// In de, this message translates to:
  /// **'Synchronisiert'**
  String get syncFileSynced;

  /// No description provided for @syncFileNotSynced.
  ///
  /// In de, this message translates to:
  /// **'Nicht synchronisiert'**
  String get syncFileNotSynced;

  /// No description provided for @syncFileNotFound.
  ///
  /// In de, this message translates to:
  /// **'Datei lokal nicht gefunden'**
  String get syncFileNotFound;

  /// No description provided for @deleteItemTitle.
  ///
  /// In de, this message translates to:
  /// **'Element löschen'**
  String get deleteItemTitle;

  /// No description provided for @deleteItemConfirmPrefix.
  ///
  /// In de, this message translates to:
  /// **'Willst du'**
  String get deleteItemConfirmPrefix;

  /// No description provided for @deleteItemConfirmSuffix.
  ///
  /// In de, this message translates to:
  /// **'wirklich löschen? Dies kann nicht rückgängig gemacht werden.'**
  String get deleteItemConfirmSuffix;

  /// No description provided for @permRequiredTitle.
  ///
  /// In de, this message translates to:
  /// **'Speicherberechtigung erforderlich'**
  String get permRequiredTitle;

  /// No description provided for @permRequiredBody.
  ///
  /// In de, this message translates to:
  /// **'Diese App benötigt Zugriff auf den Speicher, um Dateien in deinen Downloads-Ordner herunterzuladen.\n\nBitte gewähre die Berechtigung \"Zugriff auf alle Dateien\" in den Einstellungen.'**
  String get permRequiredBody;

  /// No description provided for @permDeniedSnackbar.
  ///
  /// In de, this message translates to:
  /// **'Speicherberechtigung ist erforderlich, um Dateien im Downloads-Ordner herunterzuladen'**
  String get permDeniedSnackbar;

  /// No description provided for @downloadSuccessPrefix.
  ///
  /// In de, this message translates to:
  /// **'✅ Backup gespeichert in:\nDownload/'**
  String get downloadSuccessPrefix;

  /// No description provided for @waypointLabel.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt'**
  String get waypointLabel;

  /// No description provided for @waypointDeleteTitle.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt löschen?'**
  String get waypointDeleteTitle;

  /// No description provided for @waypointDeleteContent.
  ///
  /// In de, this message translates to:
  /// **'Diesen Wegpunkt wirklich entfernen?'**
  String get waypointDeleteContent;

  /// No description provided for @buttonChangePosition.
  ///
  /// In de, this message translates to:
  /// **'Position ändern'**
  String get buttonChangePosition;

  /// No description provided for @buttonAddWaypoint.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt'**
  String get buttonAddWaypoint;

  /// No description provided for @waypointPositionUpdated.
  ///
  /// In de, this message translates to:
  /// **'Position aktualisiert'**
  String get waypointPositionUpdated;

  /// No description provided for @waypointAdded.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt hinzugefügt'**
  String get waypointAdded;

  /// No description provided for @createWaypointTitle.
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt erstellen'**
  String get createWaypointTitle;

  /// No description provided for @chooseOnMap.
  ///
  /// In de, this message translates to:
  /// **'Auf Karte auswählen'**
  String get chooseOnMap;

  /// No description provided for @enterCoordinatesManually.
  ///
  /// In de, this message translates to:
  /// **'Koordinaten manuell eingeben'**
  String get enterCoordinatesManually;

  /// No description provided for @labelLat.
  ///
  /// In de, this message translates to:
  /// **'Breitengrad (Lat)'**
  String get labelLat;

  /// No description provided for @labelLon.
  ///
  /// In de, this message translates to:
  /// **'Längengrad (Lon)'**
  String get labelLon;

  /// No description provided for @errorInvalidCoordinates.
  ///
  /// In de, this message translates to:
  /// **'Ungültige Koordinaten'**
  String get errorInvalidCoordinates;

  /// No description provided for @buttonSave.
  ///
  /// In de, this message translates to:
  /// **'Speichern'**
  String get buttonSave;

  /// No description provided for @errorSavingData.
  ///
  /// In de, this message translates to:
  /// **'Fehler beim Speichern der Daten'**
  String get errorSavingData;

  /// No description provided for @notifSyncTitle.
  ///
  /// In de, this message translates to:
  /// **'Sync abgeschlossen'**
  String get notifSyncTitle;

  /// No description provided for @notifSync1.
  ///
  /// In de, this message translates to:
  /// **'Alle Kängurus wurden erfolgreich durchs Kabel geschubst.'**
  String get notifSync1;

  /// No description provided for @notifSync2.
  ///
  /// In de, this message translates to:
  /// **'Deine Koalas sind sicher im Cloud-Eukalyptus gelandet.'**
  String get notifSync2;

  /// No description provided for @notifSync3.
  ///
  /// In de, this message translates to:
  /// **'Krokodile abgewehrt, Daten erfolgreich hochgeladen.'**
  String get notifSync3;

  /// No description provided for @notifSync4.
  ///
  /// In de, this message translates to:
  /// **'Daten-Roadtrip beendet. Alles sicher verstaut!'**
  String get notifSync4;

  /// No description provided for @notifSync5.
  ///
  /// In de, this message translates to:
  /// **'Wombats haben deine Dateien artgerecht vergraben.'**
  String get notifSync5;

  /// No description provided for @notifSync6.
  ///
  /// In de, this message translates to:
  /// **'Die Emus haben die Daten nach Hause gebracht.'**
  String get notifSync6;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['de', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
