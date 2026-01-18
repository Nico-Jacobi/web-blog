// lib/strings.dart
class AppStrings {
  // pages/browse_files_page.dart
  static const browse_files_appBar_title = "Dateien durchsuchen";
  static const path_prefix = "Pfad: ";
  static const snackBar_deleted = "Erfolgreich gelöscht";
  static const snackBar_error = "Fehler: ";
  static const button_retry = "Erneut versuchen";
  static const noData_text = "Keine Dateien gefunden";
  static const parent_folder = "..";
  static const modified_prefix = "Geändert: ";
  static const size_prefix = "Größe: ";

  // pages/coordinate_picker_page.dart
  static const coordinate_picker_appBar_title = "Koordinaten wählen";
  static const search_hint = "Ort suchen...";
  static const button_cancel = "Abbrechen";
  static const button_confirm = "Bestätigen";

  // pages/add_interest_point_page.dart
  static const add_point_title_new = "Neuer Wegpunkt";
  static const add_point_title_edit = "Wegpunkt bearbeiten";
  static const add_point_title_image = "Titelbild hinzufügen";
  static const field_name = "Name";
  static const field_short_description = "Kurzbeschreibung";
  static const field_latitude = "Breitengrad";
  static const field_longitude = "Längengrad";
  static const field_date = "Datum";
  static const field_full_description = "Vollständige Beschreibung";
  static const tooltip_pick_on_map = "Auf Karte wählen";
  static const gallery_title = "Bildergalerie";
  static const link_previous_title = "Verbindung zum vorherigen Punkt";
  static const link_previous_connect_to = "Verbinden mit: ";
  static const travel_method_title = "Reiseart";
  static const button_save_point = "Punkt speichern";
  static const button_update_point = "Änderungen speichern";
  static const discard_changes_title = "Änderungen verwerfen?";
  static const discard_changes_message = "Möchtest du die Änderungen wirklich verwerfen? Ungepeicherte Daten gehen verloren.";
  static const button_discard = "Verwerfen";
  static const error_title_image_required = "Ein Titelbild ist erforderlich";
  static const info_date_location = "Datum und Standort werden automatisch aus den deinen Bilder ermittelt, können aber jederzeit geändert werden. (Standort nur wenn GPS beim Fotografieren aktiv war) ";

  // pages/manage_points_page.dart
  static const manage_points_title = "Wegpunkte verwalten";
  static const info_manage_points = "Tippen zum Bearbeiten. Halten und Ziehen zum Sortieren. Tippe auf das Routen-Icon, um das Verkehrsmittel zu ändern.";
  static const empty_points_title = "Noch keine Punkte";
  static const empty_points_subtitle = "Erstelle deinen ersten Wegpunkt!";
  static const delete_point_title = "Punkt löschen?";
  static const delete_point_confirm_prefix = "Möchtest du";
  static const delete_point_confirm_suffix = "wirklich löschen? Dabei wird auch die Route zu diesem Punkt entfernt.";
  static const button_delete = "Löschen";
  static const error_loading_points = "Fehler beim Laden:";
  static const snack_deleted = "Punkt gelöscht";
  static const snack_method_updated = "Reiseart aktualisiert";
  static const snack_error = "Fehler:";

  // pages/settings_page.dart
  static const settings_title = "Einstellungen";
  static const field_server_url = "Server-URL";
  static const hint_server_url = "https://dein-server.de";
  static const field_auth_token = "Authentifizierungs-Token";
  static const button_save_settings = "Einstellungen speichern";
  static const snack_settings_saved = "Einstellungen erfolgreich gespeichert";

  // pages/start_page.dart
  static const app_hero_title = "Australien Blog";
  static const add_point_button = "Punkt hinzufügen";

  // widgets/info_icon.dart
  static const info_dialog_title = "Information";
  static const button_close = "Schließen";
  static const info_tooltip = "Info anzeigen";

  // widgets/travel_method_dialog.dart
  static const travel_method_dialog_title = "Verkehrsmittel wählen";

  // TripMethod labels
  static const tripMethod_boat = "Boot";
  static const tripMethod_car = "Auto";
  static const tripMethod_rv = "Wohnmobil";
  static const tripMethod_plane = "Flugzeug";
  static const tripMethod_foot = "Zu Fuß";
  static const tripMethod_misc = "Sonstiges";
  static const tripMethod_bus = "Bus";

  static const sync_files_appBar_title = "Datein synchronisieren";

  static const sync_spinner_text = "Syncing...";
}