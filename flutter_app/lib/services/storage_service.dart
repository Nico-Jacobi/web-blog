import 'dart:convert';
import 'dart:io';
import 'package:image_picker_android/image_picker_android.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:path/path.dart' as path;
import '../app_config.dart';
import '../model/data_file.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import 'blog_paths.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  Future<Map<String, dynamic>> loadPointsAndTrips() async {
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
  }

  Future<void> resetApp({bool deleteImages = true}) async {
    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    if (await pointsData.exists()) {
      await (await pointsData.file).delete();
    }
    if (await tripsData.exists()) {
      await (await tripsData.file).delete();
    }

    if (deleteImages) {
      final blogDir = await BlogPaths.dir();
      final files = blogDir.listSync(recursive: true);
      for (final f in files) {
        if (f is File) {
          try { await f.delete(); } catch (_) { /* ignore */ }
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
    final points = jsonList.map((json) => InterestPoint.fromJson(json)).toList();
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
    final blogDir = await BlogPaths.dir();

    if (point.titleImagePath.isNotEmpty) {
      final media = MediaFile.fromFilenameSync(
        path.basename(point.titleImagePath),
        blogDir.path,
      );
      if (await media.file.exists()) {
        await media.file.delete();
      }
    }

    for (var mediaPath in point.otherMediaPaths) {
      final media = MediaFile.fromFilenameSync(
        path.basename(mediaPath),
        blogDir.path,
      );
      if (await media.file.exists()) {
        await media.file.delete();
      }
    }
  }

  static void updatePickerImplementation() {
    final ImagePickerPlatform implementation = ImagePickerPlatform.instance;
    if (implementation is ImagePickerAndroid) {
      implementation.useAndroidPhotoPicker = useModernPicker;
    }
  }
}
