import 'dart:async';
import 'dart:convert';

import 'package:geolocator/geolocator.dart';

import '../model/data_file.dart';
import '../model/gps_point.dart';

class GpsTrackingService {
  static final GpsTrackingService _instance = GpsTrackingService._internal();
  factory GpsTrackingService() => _instance;
  GpsTrackingService._internal();

  StreamSubscription<Position>? _positionSub;
  bool _isTracking = false;

  bool get isTracking => _isTracking;

  Future<void> startTracking() async {
    if (_isTracking) return;
    _isTracking = true;
    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 50,
    );
    _positionSub = Geolocator.getPositionStream(locationSettings: settings)
        .listen((pos) async {
      await appendPoint(GpsPoint(
        lat: pos.latitude,
        lon: pos.longitude,
        timestamp: DateTime.now().toUtc(),
      ));
    }, onError: (_) {});
  }

  Future<void> stopTracking() async {
    _isTracking = false;
    await _positionSub?.cancel();
    _positionSub = null;
  }

  /// Records a single GPS fix — safe to call from a workmanager background isolate.
  static Future<void> recordBackgroundPosition() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      ).timeout(const Duration(seconds: 15));
      await appendPoint(GpsPoint(
        lat: pos.latitude,
        lon: pos.longitude,
        timestamp: DateTime.now().toUtc(),
      ));
    } catch (_) {}
  }

  static Future<void> appendPoint(GpsPoint point) async {
    try {
      final track = await loadTrack();
      track.add(point);
      await saveTrack(track);
    } catch (_) {}
  }

  static Future<List<GpsPoint>> loadTrack() async {
    final dataFile = DataFile.gpsTrack;
    if (!await dataFile.exists()) return [];
    final file = await dataFile.file;
    final raw = await file.readAsString();
    final json = jsonDecode(raw) as List;
    return json.map((e) => GpsPoint.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> saveTrack(List<GpsPoint> track) async {
    final dataFile = DataFile.gpsTrack;
    final file = await dataFile.file;
    await file.writeAsString(
      jsonEncode(track.map((p) => p.toJson()).toList()),
    );
  }
}
