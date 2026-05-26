// services/storage_service.dart
import 'dart:convert';
import 'dart:io';
import 'package:australien_blog_app/services/sync_service.dart';
import 'package:image_picker_android/image_picker_android.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main.dart';
import '../model/data_file.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';




class StorageService {
  static final StorageService _instance = StorageService._internal();

  factory StorageService() {
    return _instance;
  }

  StorageService._internal();


  Future<Map<String, dynamic>> loadPointsAndTrips() async {

    // Use DataFile class
    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    List<InterestPoint> points = [];
    List<TripElement> trips = [];

    if (await pointsData.exists()) {
      final pointsFile = await pointsData.file;
      final jsonString = await pointsFile.readAsString();
      final List<dynamic> jsonList = jsonDecode(jsonString);

      points = jsonList.map((json) => InterestPoint.fromJson(json)).toList();
      points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
    }

    if (await tripsData.exists()) {
      final tripsFile = await tripsData.file;
      final jsonString = await tripsFile.readAsString();
      final List<dynamic> jsonList = jsonDecode(jsonString);
      trips = jsonList.map((json) => TripElement.fromJson(json)).toList();
    }

    return {'points': points, 'trips': trips};
  }

  Future<void> savePointsAndTrips(List<InterestPoint> points, List<TripElement> trips) async {
    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    final pointsFile = await pointsData.file;
    await pointsFile.writeAsString(jsonEncode(points.map((p) => p.toJson()).toList()));

    final tripsFile = await tripsData.file;
    await tripsFile.writeAsString(jsonEncode(trips.map((t) => t.toJson()).toList()));

    SyncService().syncFromStorage();
  }

  Future<void> resetApp({bool deleteImages = true}) async {
    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    // Delete stored data
    if (await pointsData.exists()) {
      final file = await pointsData.file;
      await file.delete();
    }
    if (await tripsData.exists()) {
      final file = await tripsData.file;
      await file.delete();
    }

    if (deleteImages) {
      final appDir = await getApplicationDocumentsDirectory();
      final files = appDir.listSync(recursive: true);
      for (final f in files) {
        if (f is File) {
          await f.delete();
        }
      }
    }
  }

  Future<List<InterestPoint>> loadPoints() async {
    final pointsData = DataFile.points;

    if (!await pointsData.exists()) return [];

    final pointsFile = await pointsData.file;
    final jsonString = await pointsFile.readAsString();
    final List<dynamic> jsonList = jsonDecode(jsonString);

    final points = jsonList.map((json) => InterestPoint.fromJson(json))
        .toList();
    points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
    return points;
  }

  Future<List<TripElement>> loadTrips() async {
    final tripsData = DataFile.trips;

    if (!await tripsData.exists()) return [];

    final tripsFile = await tripsData.file;
    final jsonString = await tripsFile.readAsString();
    final List<dynamic> jsonList = jsonDecode(jsonString);

    return jsonList.map((json) => TripElement.fromJson(json)).toList();
  }

  Future<void> deletePointMedia(InterestPoint point) async {
    final appDir = await getApplicationDocumentsDirectory();

    // Delete title image
    if (point.titleImagePath.isNotEmpty) {
      final media = MediaFile.fromFilenameSync(
          path.basename(point.titleImagePath),
          appDir.path
      );
      if (await media.file.exists()) {
        await media.file.delete();
      }
    }

    // Delete other media
    for (var mediaPath in point.otherMediaPaths) {
      final media = MediaFile.fromFilenameSync(
          path.basename(mediaPath),
          appDir.path
      );
      if (await media.file.exists()) {
        await media.file.delete();
      }
    }

    SyncService().syncFromStorage();
  }

  static void updatePickerImplementation() {
    final ImagePickerPlatform implementation = ImagePickerPlatform.instance;
    if (implementation is ImagePickerAndroid) {
      implementation.useAndroidPhotoPicker = useModernPicker;
    }
  }

  // ── ONE-TIME MIGRATION v1 ─────────────────────────────────────────────
  // Rewrites flat image paths ('media_123.jpg') to stop-based paths
  // ('sydney/media_123.jpg') in the local points.json.  Runs once and
  // sets a SharedPreferences flag so it never runs again.
  static Future<void> migrateMediaPathsIfNeeded() async {
    const flagKey = 'media_paths_migrated_v1';
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(flagKey) == true) return;

    try {
      final pointsData = DataFile.points;
      if (!await pointsData.exists()) {
        await prefs.setBool(flagKey, true);
        return;
      }

      final pointsFile = await pointsData.file;
      final List<dynamic> jsonList = jsonDecode(await pointsFile.readAsString());
      final points = jsonList.map((j) => InterestPoint.fromJson(j)).toList();

      bool changed = false;
      for (final point in points) {
        final slug = _toSlug(point.name);
        if (point.titleImagePath.isNotEmpty && !point.titleImagePath.contains('/')) {
          point.titleImagePath = '$slug/${point.titleImagePath}';
          changed = true;
        }
        for (int i = 0; i < point.otherMediaPaths.length; i++) {
          if (!point.otherMediaPaths[i].contains('/')) {
            point.otherMediaPaths[i] = '$slug/${point.otherMediaPaths[i]}';
            changed = true;
          }
        }
      }

      if (changed) {
        await pointsFile.writeAsString(jsonEncode(points.map((p) => p.toJson()).toList()));

        // Reset sync state so all files are re-uploaded with new paths.
        final appDir = await getApplicationDocumentsDirectory();
        final syncStateFile = File('${appDir.path}/sync_state.json');
        if (await syncStateFile.exists()) await syncStateFile.delete();
        final hashFile = File('${appDir.path}/sync_hashes.json');
        if (await hashFile.exists()) await hashFile.delete();

        print('[MIGRATION v1] ✅ Rewrote ${points.length} point(s) to media/{slug}/filename format');
      }

      await prefs.setBool(flagKey, true);
    } catch (e) {
      print('[MIGRATION v1] ❌ Failed: $e');
      // Don't set the flag — retry next launch.
    }
  }

  // ── ONE-TIME MIGRATION v2 ─────────────────────────────────────────────
  // v1 only fixed flat filenames (no slash).  Absolute Android paths like
  // '/data/user/0/com.example.australien_blog_app/app_flutter/media_123.jpg'
  // contain slashes and slipped through.  This pass converts them to the
  // correct 'slug/filename' format and resets sync so they re-upload.
  static Future<void> migrateAbsolutePathsIfNeeded() async {
    const flagKey = 'media_paths_migrated_v2';
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(flagKey) == true) return;

    try {
      final pointsData = DataFile.points;
      if (!await pointsData.exists()) {
        await prefs.setBool(flagKey, true);
        return;
      }

      final pointsFile = await pointsData.file;
      final List<dynamic> jsonList = jsonDecode(await pointsFile.readAsString());
      final points = jsonList.map((j) => InterestPoint.fromJson(j)).toList();

      bool changed = false;
      for (final point in points) {
        final slug = _toSlug(point.name);
        if (_isAbsoluteOrDevicePath(point.titleImagePath)) {
          point.titleImagePath = '$slug/${path.basename(point.titleImagePath)}';
          changed = true;
        }
        for (int i = 0; i < point.otherMediaPaths.length; i++) {
          if (_isAbsoluteOrDevicePath(point.otherMediaPaths[i])) {
            point.otherMediaPaths[i] = '$slug/${path.basename(point.otherMediaPaths[i])}';
            changed = true;
          }
        }
      }

      if (changed) {
        await pointsFile.writeAsString(jsonEncode(points.map((p) => p.toJson()).toList()));

        // Reset sync state so corrected paths are re-uploaded to the server.
        final appDir = await getApplicationDocumentsDirectory();
        final syncStateFile = File('${appDir.path}/sync_state.json');
        if (await syncStateFile.exists()) await syncStateFile.delete();
        final hashFile = File('${appDir.path}/sync_hashes.json');
        if (await hashFile.exists()) await hashFile.delete();

        print('[MIGRATION v2] ✅ Fixed absolute paths in ${points.length} point(s)');
      }

      await prefs.setBool(flagKey, true);
    } catch (e) {
      print('[MIGRATION v2] ❌ Failed: $e');
      // Don't set the flag — retry next launch.
    }
  }

  // Detects an absolute device path or any path containing app-internal
  // directory components that should never appear in points.json.
  static bool _isAbsoluteOrDevicePath(String p) {
    if (p.isEmpty) return false;
    if (p.startsWith('/')) return true;
    if (p.contains('com.example.')) return true;
    if (p.contains('app_flutter/')) return true;
    if (p.contains('data/user/')) return true;
    return false;
  }

  static String _toSlug(String name) {
    var s = name.toLowerCase();
    s = s.replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss');
    s = s.replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
    return s.isEmpty ? 'stop' : s;
  }
}

