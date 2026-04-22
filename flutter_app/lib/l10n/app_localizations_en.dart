// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get browseFilesTitle => 'Browse Files';

  @override
  String get pathPrefix => 'Path: ';

  @override
  String get snackBarDeleted => 'Successfully deleted';

  @override
  String get snackBarError => 'Error: ';

  @override
  String get buttonRetry => 'Retry';

  @override
  String get noDataText => 'No files found';

  @override
  String get parentFolder => '..';

  @override
  String get modifiedPrefix => 'Modified: ';

  @override
  String get sizePrefix => 'Size: ';

  @override
  String get coordinatePickerTitle => 'Pick Coordinates';

  @override
  String get searchHint => 'Search location...';

  @override
  String get buttonCancel => 'Cancel';

  @override
  String get buttonConfirm => 'Confirm';

  @override
  String get addPointTitleNew => 'New Waypoint';

  @override
  String get addPointTitleEdit => 'Edit Waypoint';

  @override
  String get addPointTitleImage => 'Add Cover Image';

  @override
  String get fieldName => 'Name';

  @override
  String get fieldShortDescription => 'Short Description';

  @override
  String get fieldLatitude => 'Latitude';

  @override
  String get fieldLongitude => 'Longitude';

  @override
  String get fieldDate => 'Date';

  @override
  String get fieldFullDescription => 'Full Description';

  @override
  String get tooltipPickOnMap => 'Pick on Map';

  @override
  String get galleryTitle => 'Photo Gallery';

  @override
  String get linkPreviousTitle => 'Link to Previous Point';

  @override
  String get linkPreviousConnectTo => 'Connect to: ';

  @override
  String get travelMethodTitle => 'Travel Method';

  @override
  String get buttonSavePoint => 'Save Point';

  @override
  String get buttonUpdatePoint => 'Save Changes';

  @override
  String get discardChangesTitle => 'Discard Changes?';

  @override
  String get discardChangesMessage =>
      'Do you really want to discard your changes? Unsaved data will be lost.';

  @override
  String get buttonDiscard => 'Discard';

  @override
  String get errorTitleImageRequired => 'A cover image is required';

  @override
  String get infoDateLocation =>
      'Date and location are automatically extracted from your photos, but can be changed at any time. (Location only if GPS was active while taking photos)';

  @override
  String get labelMediaGallery => 'Gallery';

  @override
  String get mediaAddTitle => 'Add Media';

  @override
  String get mediaImagesTitle => 'Photos';

  @override
  String get mediaImagesSubtitle => 'Add multiple photos';

  @override
  String get mediaVideoTitle => 'Video';

  @override
  String get mediaVideoSubtitle => 'Add video (max. 5 min.)';

  @override
  String get errorPickerFailed => 'Could not select images';

  @override
  String get managePointsTitle => 'Manage Waypoints';

  @override
  String get infoManagePoints =>
      'Tap to edit. Hold and drag to reorder. Tap the route icon to change the travel method.';

  @override
  String get emptyPointsTitle => 'No points yet';

  @override
  String get emptyPointsSubtitle => 'Create your first waypoint!';

  @override
  String get deletePointTitle => 'Delete Point?';

  @override
  String get deletePointConfirmPrefix => 'Do you want to delete';

  @override
  String get deletePointConfirmSuffix =>
      '? This will also remove the route to this point.';

  @override
  String get buttonDelete => 'Delete';

  @override
  String get errorLoadingPoints => 'Error loading:';

  @override
  String get snackDeleted => 'Point deleted';

  @override
  String get snackMethodUpdated => 'Travel method updated';

  @override
  String get snackError => 'Error:';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get fieldServerUrl => 'Server URL';

  @override
  String get hintServerUrl => 'https://your-server.com';

  @override
  String get fieldAuthToken => 'Authentication Token';

  @override
  String get buttonSaveSettings => 'Save Settings';

  @override
  String get snackSettingsSaved => 'Settings saved successfully';

  @override
  String get deactivateSyncSetting => 'Synchronization';

  @override
  String get googlePhotoPickerSetting => 'Google Photos';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get appHeroTitle => 'My Blog';

  @override
  String get addPointButton => 'Add Point';

  @override
  String get infoDialogTitle => 'Information';

  @override
  String get buttonClose => 'Close';

  @override
  String get infoTooltip => 'Show info';

  @override
  String get travelMethodDialogTitle => 'Choose Travel Method';

  @override
  String get tripMethodBoat => 'Boat';

  @override
  String get tripMethodCar => 'Car';

  @override
  String get tripMethodRv => 'Motorhome';

  @override
  String get tripMethodPlane => 'Plane';

  @override
  String get tripMethodFoot => 'On foot';

  @override
  String get tripMethodMisc => 'Other';

  @override
  String get tripMethodBus => 'Bus';

  @override
  String get syncSpinnerText => 'Syncing...';

  @override
  String get syncFilesTitle => 'Sync Files';

  @override
  String get syncStatusTitle => 'Sync Status';

  @override
  String get syncStatusErrorLoading => 'Error loading status: ';

  @override
  String get syncStatusInProgress => 'Sync already in progress';

  @override
  String get syncStatusSuccess => 'Sync completed successfully!';

  @override
  String get syncStatusFailed => 'Sync failed: ';

  @override
  String get syncDownloading => 'Downloading from server...';

  @override
  String get syncDownloadSuccess => 'Successfully downloaded from server';

  @override
  String get syncDownloadFailed => 'Download from server failed';

  @override
  String get syncDataReplaced => 'Local data replaced with server data';

  @override
  String get syncReverseFailed => 'Download failed: ';

  @override
  String get syncDialogTitle => 'Download Data?';

  @override
  String get syncDialogContent =>
      'This will replace ALL local data with data from the server. Unsynced local changes will be lost.\n\nDo you want to continue?';

  @override
  String get syncDialogConfirm => 'Continue';

  @override
  String get syncStatSynced => 'Synced';

  @override
  String get syncStatUnsynced => 'Unsynced';

  @override
  String get syncStatTotal => 'Total';

  @override
  String get buttonSyncUpload => 'Upload';

  @override
  String get buttonSyncDownload => 'Download from Server';

  @override
  String get syncNoFiles => 'No files to sync';

  @override
  String get syncFileMetadata => 'Metadata';

  @override
  String get syncFileSynced => 'Synced';

  @override
  String get syncFileNotSynced => 'Not synced';

  @override
  String get syncFileNotFound => 'File not found locally';

  @override
  String get deleteItemTitle => 'Delete Item';

  @override
  String get deleteItemConfirmPrefix => 'Do you want to delete';

  @override
  String get deleteItemConfirmSuffix => '? This cannot be undone.';

  @override
  String get permRequiredTitle => 'Storage Permission Required';

  @override
  String get permRequiredBody =>
      'This app needs access to storage to download files to your Downloads folder.\n\nPlease grant \"Access to all files\" permission in Settings.';

  @override
  String get permDeniedSnackbar =>
      'Storage permission is required to download files to the Downloads folder';

  @override
  String get downloadSuccessPrefix => '✅ Backup saved in:\nDownload/';

  @override
  String get waypointLabel => 'Waypoint';

  @override
  String get waypointDeleteTitle => 'Delete Waypoint?';

  @override
  String get waypointDeleteContent => 'Remove this waypoint?';

  @override
  String get buttonChangePosition => 'Change Position';

  @override
  String get buttonAddWaypoint => 'Waypoint';

  @override
  String get waypointPositionUpdated => 'Position updated';

  @override
  String get waypointAdded => 'Waypoint added';

  @override
  String get createWaypointTitle => 'Create Waypoint';

  @override
  String get chooseOnMap => 'Choose on Map';

  @override
  String get enterCoordinatesManually => 'Enter coordinates manually';

  @override
  String get labelLat => 'Latitude (Lat)';

  @override
  String get labelLon => 'Longitude (Lon)';

  @override
  String get errorInvalidCoordinates => 'Invalid coordinates';

  @override
  String get buttonSave => 'Save';

  @override
  String get errorSavingData => 'Error saving data';

  @override
  String get notifSyncTitle => 'Sync complete';

  @override
  String get notifSync1 =>
      'All kangaroos successfully pushed through the cable.';

  @override
  String get notifSync2 =>
      'Your koalas have safely landed in the cloud eucalyptus.';

  @override
  String get notifSync3 => 'Crocodiles repelled, data successfully uploaded.';

  @override
  String get notifSync4 => 'Data road trip complete. Everything stored safely!';

  @override
  String get notifSync5 =>
      'Wombats have buried your files in their natural habitat.';

  @override
  String get notifSync6 => 'The emus have brought the data home.';

  @override
  String get loginTitle => 'Sign In';

  @override
  String get loginUsernameLabel => 'Username';

  @override
  String get loginPasswordLabel => 'Password';

  @override
  String get loginButton => 'Sign in';

  @override
  String get loginNoAccountLink => 'No account yet? Create one';

  @override
  String get registerTitle => 'Create your blog';

  @override
  String get registerUsernameLabel => 'Username';

  @override
  String get registerUsernameError => 'At least 3 characters';

  @override
  String get registerPasswordLabel => 'Password';

  @override
  String get registerPasswordError => 'At least 8 characters';

  @override
  String get registerBlogTitleLabel => 'Blog title';

  @override
  String get registerBlogTitleError => 'Required';

  @override
  String get registerBlogSlugLabel => 'URL slug';

  @override
  String get registerBlogSlugHelper => 'Used in your blog URL, e.g. /anna-trip';

  @override
  String get registerBlogSlugError =>
      '3-32 chars, lowercase letters, digits, _ or -';

  @override
  String get registerReadPasswordLabel => 'Read password (optional)';

  @override
  String get registerReadPasswordHelper =>
      'Visitors of your blog need this to view it';

  @override
  String get registerSubmitButton => 'Create blog';

  @override
  String get registerBackToLogin => 'Already have an account? Sign in';

  @override
  String get settingsAccountSection => 'Account';

  @override
  String settingsLoggedInAs(String username) {
    return 'Signed in as $username';
  }

  @override
  String settingsBlogSlugLabel(String slug) {
    return 'Blog: /$slug';
  }

  @override
  String get settingsLogoutButton => 'Sign out';

  @override
  String get settingsLogoutConfirm =>
      'Sign out of this account? Cached data on this device will be removed.';

  @override
  String get settingsBlogLink => 'Blog settings';

  @override
  String get blogSettingsTitle => 'Blog settings';

  @override
  String get blogSettingsAppearance => 'Appearance';

  @override
  String get blogSettingsTitleLabel => 'Title';

  @override
  String get blogSettingsTitleRequired => 'Required';

  @override
  String get blogSettingsSubtitleLabel => 'Subtitle';

  @override
  String get blogSettingsDateRangeLabel => 'Date range';

  @override
  String get blogSettingsDateRangeHelper =>
      'Free text shown next to the title, e.g. \'Mar 2026 — Aug 2026\'';

  @override
  String get blogSettingsOwnerLabel => 'Owner display name';

  @override
  String get blogSettingsLanguageLabel => 'Default language';

  @override
  String get blogSettingsThemeSection => 'Theme';

  @override
  String get blogSettingsThemePrimaryLabel => 'Primary color';

  @override
  String get blogSettingsThemeAccentLabel => 'Accent color';

  @override
  String get blogSettingsThemeHelper =>
      'Color name (orange, slate, purple…) or any CSS color the website understands';

  @override
  String get blogSettingsPushSection => 'Push notifications';

  @override
  String get blogSettingsPushTextLabel => 'Notification text';

  @override
  String blogSettingsPushTextHelper(Object owner) {
    return 'Use $owner as a placeholder for the owner\'s display name';
  }

  @override
  String get blogSettingsReadPwSection => 'Read password';

  @override
  String get blogSettingsReadPwHasOne =>
      'A read password is currently set. Visitors need it to view the blog.';

  @override
  String get blogSettingsReadPwNone =>
      'No read password set — the blog is publicly viewable on the website.';

  @override
  String get blogSettingsChangeReadPw => 'Change read password';

  @override
  String get blogSettingsReadPwNewLabel => 'New read password';

  @override
  String get blogSettingsClearReadPw => 'Remove read password';

  @override
  String get blogSettingsClearReadPwHelper =>
      'Makes the blog publicly accessible to anyone with the URL.';
}
