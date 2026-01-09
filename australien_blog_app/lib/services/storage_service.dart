// services/storage_service.dart
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../model/interest_point.dart';

class StorageService {



  static final StorageService _instance = StorageService._internal();
  factory StorageService() {
    return _instance;
  }
  StorageService._internal();

  Future<Map<String, dynamic>> loadPointsAndTrips() async {
    final appDir = await getApplicationDocumentsDirectory();
    final pointsFile = File('${appDir.path}/points.json');
    final tripsFile = File('${appDir.path}/trips.json');

    List<InterestPoint> points = [];
    List<TripElement> trips = [];

    if (await pointsFile.exists()) {
      final jsonString = await pointsFile.readAsString();
      final List<dynamic> jsonList = jsonDecode(jsonString);

      points = jsonList.map((json) => InterestPoint(
        id: json['id'],
        name: json['name'] ?? '',
        shortDescription: json['shortDescription'] ?? '',
        titleImagePath: json['titleImagePath'] ?? '',
        otherImagePaths: List<String>.from(json['otherImagePaths'] ?? []),
        lat: json['lat']?.toDouble(),
        lon: json['lon']?.toDouble(),
        date: json['date'],
        description: json['description'] ?? '',
        tripOrder: json['tripOrder'] ?? 0,
      )).toList();

      points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
    }

    if (await tripsFile.exists()) {
      final jsonString = await tripsFile.readAsString();
      final List<dynamic> jsonList = jsonDecode(jsonString);
      trips = jsonList.map((json) => TripElement.fromJson(json)).toList();
    }

    return {'points': points, 'trips': trips};
  }

  Future<void> savePointsAndTrips(
      List<InterestPoint> points, List<TripElement> trips) async {
    final appDir = await getApplicationDocumentsDirectory();

    final pointsFile = File('${appDir.path}/points.json');
    await pointsFile.writeAsString(
        jsonEncode(points.map((p) => p.toJson()).toList()));

    final tripsFile = File('${appDir.path}/trips.json');
    await tripsFile.writeAsString(
        jsonEncode(trips.map((t) => t.toJson()).toList()));
  }

  Future<void> deletePointImages(InterestPoint point) async {
    if (point.titleImagePath.isNotEmpty) {
      final titleFile = File(point.titleImagePath);
      if (await titleFile.exists()) await titleFile.delete();
    }
    for (var imgPath in point.otherImagePaths) {
      final imgFile = File(imgPath);
      if (await imgFile.exists()) await imgFile.delete();
    }
  }

  Future<void> resetApp({bool deleteImages = true}) async {
    final appDir = await getApplicationDocumentsDirectory();

    final pointsFile = File('${appDir.path}/points.json');
    final tripsFile  = File('${appDir.path}/trips.json');

    // delete stored data
    if (await pointsFile.exists()) await pointsFile.delete();
    if (await tripsFile.exists())  await tripsFile.delete();

    if (deleteImages) {
      // savage mode: wipe all files except the jsons (already dead)
      final files = appDir.listSync(recursive: true);
      for (final f in files) {
        if (f is File) {
          await f.delete();
        }
      }
    }
  }

  Future<List<InterestPoint>> loadPoints() async {
    final appDir = await getApplicationDocumentsDirectory();
    final pointsFile = File('${appDir.path}/points.json');

    if (!await pointsFile.exists()) return [];

    final jsonString = await pointsFile.readAsString();
    final List<dynamic> jsonList = jsonDecode(jsonString);

    final points = jsonList.map((json) => InterestPoint(
      id: json['id'],
      name: json['name'] ?? '',
      shortDescription: json['shortDescription'] ?? '',
      titleImagePath: json['titleImagePath'] ?? '',
      otherImagePaths: List<String>.from(json['otherImagePaths'] ?? []),
      lat: json['lat']?.toDouble(),
      lon: json['lon']?.toDouble(),
      date: json['date'],
      description: json['description'] ?? '',
      tripOrder: json['tripOrder'] ?? 0,
    )).toList();

    points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
    return points;
  }

  Future<List<TripElement>> loadTrips() async {
    final appDir = await getApplicationDocumentsDirectory();
    final tripsFile = File('${appDir.path}/trips.json');

    if (!await tripsFile.exists()) return [];

    final jsonString = await tripsFile.readAsString();
    final List<dynamic> jsonList = jsonDecode(jsonString);

    return jsonList.map((json) => TripElement.fromJson(json)).toList();
  }


}
