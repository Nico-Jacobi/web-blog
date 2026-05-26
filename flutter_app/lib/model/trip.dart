// --- New Trip Element Model ---
import 'package:flutter/material.dart';

import '../strings.dart';

enum TripMethod {
  boat,
  car,
  bus,
  rv,
  plane,
  foot,
  train,
  bike,
  misc;

  IconData get icon {
    switch (this) {
      case TripMethod.boat:
        return Icons.directions_boat;
      case TripMethod.car:
        return Icons.directions_car;
      case TripMethod.rv:
        return Icons.local_car_wash_rounded;
      case TripMethod.plane:
        return Icons.flight;
      case TripMethod.foot:
        return Icons.directions_walk;
      case TripMethod.misc:
        return Icons.scuba_diving;
      case TripMethod.bus:
        return Icons.directions_bus;
      case TripMethod.train:
        return Icons.train;
      case TripMethod.bike:
        return Icons.directions_bike;
    }
  }

  String get label {
    switch (this) {
      case TripMethod.boat:
        return AppStrings.tripMethod_boat;
      case TripMethod.car:
        return AppStrings.tripMethod_car;
      case TripMethod.rv:
        return AppStrings.tripMethod_rv;
      case TripMethod.plane:
        return AppStrings.tripMethod_plane;
      case TripMethod.foot:
        return AppStrings.tripMethod_foot;
      case TripMethod.misc:
        return AppStrings.tripMethod_misc;
      case TripMethod.bus:
        return AppStrings.tripMethod_bus;
      case TripMethod.train:
        return AppStrings.tripMethod_train;
      case TripMethod.bike:
        return AppStrings.tripMethod_bike;
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