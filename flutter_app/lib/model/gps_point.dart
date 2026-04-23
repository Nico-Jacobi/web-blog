class GpsPoint {
  final double lat;
  final double lon;
  final DateTime timestamp;

  GpsPoint({required this.lat, required this.lon, required this.timestamp});

  Map<String, dynamic> toJson() => {
    'lat': lat,
    'lon': lon,
    'ts': timestamp.toIso8601String(),
  };

  factory GpsPoint.fromJson(Map<String, dynamic> json) => GpsPoint(
    lat: (json['lat'] as num).toDouble(),
    lon: (json['lon'] as num).toDouble(),
    timestamp: DateTime.parse(json['ts'] as String),
  );
}
