class InterestPoint {
  int id;
  String name;
  String shortDescription;
  String titleImagePath;
  List<String> otherMediaPaths;
  double? lat;
  double? lon;
  String? date;
  String description;
  int tripOrder;
  bool isWaypoint;
  DateTime? updatedAt;
  DateTime? deletedAt;

  InterestPoint({
    required this.id,
    this.name = '',
    this.shortDescription = '',
    required this.titleImagePath,
    this.otherMediaPaths = const [],
    this.lat,
    this.lon,
    this.date,
    this.description = '',
    required this.tripOrder,
    this.isWaypoint = false,
    this.updatedAt,
    this.deletedAt,
  });

  void touch() {
    updatedAt = DateTime.now().toUtc();
  }

  void markDeleted() {
    final now = DateTime.now().toUtc();
    deletedAt = now;
    updatedAt = now;
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'shortDescription': shortDescription,
    'titleImagePath': titleImagePath,
    'otherImagePaths': otherMediaPaths,
    'lat': lat,
    'lon': lon,
    'date': date,
    'description': description,
    'tripOrder': tripOrder,
    'isWaypoint': isWaypoint,
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    if (deletedAt != null) 'deletedAt': deletedAt!.toIso8601String(),
  };

  factory InterestPoint.fromJson(Map<String, dynamic> json) {
    return InterestPoint(
      id: json['id'],
      name: json['name'] ?? '',
      shortDescription: json['shortDescription'] ?? '',
      titleImagePath: json['titleImagePath'] ?? '',
      otherMediaPaths: List<String>.from(json['otherImagePaths'] ?? []),
      lat: json['lat']?.toDouble(),
      lon: json['lon']?.toDouble(),
      date: json['date'],
      description: json['description'] ?? '',
      tripOrder: json['tripOrder'] ?? 0,
      isWaypoint: json['isWaypoint'] == true,
      updatedAt: _parseDate(json['updatedAt']),
      deletedAt: _parseDate(json['deletedAt']),
    );
  }

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    if (v is String && v.isEmpty) return null;
    return DateTime.tryParse(v.toString());
  }
}
