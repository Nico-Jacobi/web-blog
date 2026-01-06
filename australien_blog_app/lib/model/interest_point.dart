// --- Updated Model ---
import 'package:flutter/material.dart';

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
  int tripOrder; // New field for ordering

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
    required this.tripOrder,
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
    'tripOrder': tripOrder,
  };

  factory InterestPoint.fromJson(Map<String, dynamic> json) {
    return InterestPoint(
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
    );
  }
}

// --- New Trip Element Model ---
enum TripMethod {
  boat,
  car,
  bus,
  rv,
  plane,
  foot,
  misc;

  IconData get icon {
    switch (this) {
      case TripMethod.boat:
        return Icons.directions_boat;
      case TripMethod.car:
        return Icons.directions_car;
      case TripMethod.rv:
        return Icons.rv_hookup;
      case TripMethod.plane:
        return Icons.flight;
      case TripMethod.foot:
        return Icons.directions_walk;
      case TripMethod.misc:
        return Icons.more_horiz;
      case TripMethod.bus:
        return Icons.directions_bus;
    }
  }

  String get label {
    switch (this) {
      case TripMethod.boat:
        return 'Boat';
      case TripMethod.car:
        return 'Car';
      case TripMethod.rv:
        return 'RV';
      case TripMethod.plane:
        return 'Plane';
      case TripMethod.foot:
        return 'Walking';
      case TripMethod.misc:
        return 'Other';
      case TripMethod.bus:
        return 'Bus';
    }
  }
}

class TripElement {
  int pointId1;
  int pointId2;
  TripMethod method;

  TripElement({
    required this.pointId1,
    required this.pointId2,
    this.method = TripMethod.car,
  });

  Map<String, dynamic> toJson() => {
    'pointId1': pointId1,
    'pointId2': pointId2,
    'method': method.name,
  };

  factory TripElement.fromJson(Map<String, dynamic> json) {
    return TripElement(
      pointId1: json['pointId1'],
      pointId2: json['pointId2'],
      method: TripMethod.values.firstWhere(
            (e) => e.name == json['method'],
        orElse: () => TripMethod.car,
      ),
    );
  }
}