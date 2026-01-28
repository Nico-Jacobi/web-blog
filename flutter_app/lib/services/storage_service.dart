// services/storage_service.dart
import 'dart:convert';
import 'dart:io';
import 'package:australien_blog_app/services/sync_service.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
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
}