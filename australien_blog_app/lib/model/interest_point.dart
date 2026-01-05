// --- Model ---
class InterestPoint {
  int id;
  String name;
  String shortDescription;
  String titleImagePath;
  List<String> otherImagePaths;
  double? lat;
  double? lon;
  String? date;
  String description;

  InterestPoint({
    required this.id,
    this.name = '',
    this.shortDescription = '',
    required this.titleImagePath,
    this.otherImagePaths = const [],
    this.lat,
    this.lon,
    this.date,
    this.description = '',
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'shortDescription': shortDescription,
    'titleImagePath': titleImagePath,
    'otherImagePaths': otherImagePaths,
    'lat': lat,
    'lon': lon,
    'date': date,
    'description': description,
  };
}