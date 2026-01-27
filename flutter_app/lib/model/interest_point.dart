// --- Updated Model ---
import 'package:flutter/material.dart';

import '../strings.dart';

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
  int tripOrder; // New field for ordering

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
  });

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
    );
  }
}

