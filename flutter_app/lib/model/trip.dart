// --- New Trip Element Model ---
import 'package:flutter/material.dart';

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
        return Icons.local_car_wash_rounded;
      case TripMethod.plane:
        return Icons.flight;
      case TripMethod.foot:
        return Icons.directions_walk;
      case TripMethod.misc:
        return Icons.scuba_diving;
      case TripMethod.bus:
        return Icons.directions_bus;
    }
  }

}

class TripElement {
  /// Stable identity for cross-device merge. Mutations to pointId1/pointId2
  /// (e.g. reorder) keep the same id; the server merges by this key.
  int id;
  int pointId1;
  int pointId2;
  TripMethod method;
  DateTime? updatedAt;
  DateTime? deletedAt;

  TripElement({
    required this.id,
    required this.pointId1,
    required this.pointId2,
    this.method = TripMethod.car,
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

  /// Next monotonic id for a new trip. Deterministic fallback for any legacy
  /// (pre-id) entries is computed in [fromJson], so `max(existing.id) + 1`
  /// is always collision-safe.
  static int nextId(Iterable<TripElement> existing) {
    int maxId = 0;
    for (final t in existing) {
      if (t.id > maxId) maxId = t.id;
    }
    return maxId + 1;
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'pointId1': pointId1,
    'pointId2': pointId2,
    'method': method.name,
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
    if (deletedAt != null) 'deletedAt': deletedAt!.toIso8601String(),
  };

  factory TripElement.fromJson(Map<String, dynamic> json) {
    final int p1 = json['pointId1'];
    final int p2 = json['pointId2'];
    // Legacy entries without id get a deterministic synthetic id from the
    // composite — every device computes the same value, so merges still line up.
    final int id = json['id'] ?? (p1 * 1000000 + p2);
    return TripElement(
      id: id,
      pointId1: p1,
      pointId2: p2,
      method: TripMethod.values.firstWhere(
            (e) => e.name == json['method'],
        orElse: () => TripMethod.car,
      ),
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