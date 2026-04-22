import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

import '../colors.dart'; // Using the theme colors
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/info_icon.dart';
import '../widgets/point_with_route_card.dart';
import '../services/storage_service.dart';
import '../widgets/travel_method_dialog.dart';
import '../strings.dart';
import 'create_point_page.dart';

class ManagePointsPage extends StatefulWidget {
  const ManagePointsPage({super.key});

  @override
  State<ManagePointsPage> createState() => _ManagePointsPageState();
}

class _ManagePointsPageState extends State<ManagePointsPage> {
  final StorageService _storage = StorageService();
  List<InterestPoint> _points = [];
  List<TripElement> _tripElements = [];
  Map<int, TripElement> _tripsByDestination = {};
  bool _isLoading = true;

  void _rebuildTripIndex() {
    _tripsByDestination = {
      for (final t in _tripElements) t.pointId2: t,
    };
  }

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
    _loadPoints();
  }

  Future<void> _loadPoints() async {
    setState(() => _isLoading = true);
    try {
      final data = await _storage.loadPointsAndTrips();
      final appDir = await getApplicationDocumentsDirectory();

      List<InterestPoint> points = data['points'] as List<InterestPoint>;

      // Convert filenames to full paths for UI display using MediaFile
      for (var p in points) {
        if (p.titleImagePath.isNotEmpty) {
          final media = MediaFile.fromFilenameSync(
              p.titleImagePath, appDir.path);
          p.titleImagePath = media.file.path; // Full path for UI
        }

        p.otherMediaPaths = p.otherMediaPaths.map((filename) {
          if (filename.isNotEmpty) {
            final media = MediaFile.fromFilenameSync(filename, appDir.path);
            return media.file.path; // Full path for UI
          }
          return filename;
        }).toList();
      }

      setState(() {
        _points = points;
        _tripElements = data['trips'] as List<TripElement>;
        _rebuildTripIndex();
      });
    } catch (e) {
      _showErrorSnackBar('${AppStrings.error_loading_points} $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveData() async {
    final cleanedPoints = _points.map((p) {
      final titleName = path.basename(p.titleImagePath);
      final otherNames = p.otherMediaPaths
          .where((pathStr) => pathStr.isNotEmpty)
          .map((pathStr) =>
      pathStr.contains(Platform.pathSeparator)
          ? path.basename(pathStr)
          : pathStr)
          .toList();

      return InterestPoint(
        id: p.id,
        name: p.name,
        shortDescription: p.shortDescription,
        titleImagePath: titleName,
        // Nur Dateiname!
        otherMediaPaths: otherNames,
        // Nur Dateinamen!
        lat: p.lat,
        lon: p.lon,
        date: p.date,
        description: p.description,
        tripOrder: p.tripOrder,
      );
    }).toList();

    await _storage.savePointsAndTrips(cleanedPoints, _tripElements);
  }

  Future<void> _deletePoint(InterestPoint point) async {
    final confirm = await GradientConfirmDialog.show(
      context,
      title: AppStrings.delete_point_title,
      content: '${AppStrings.delete_point_confirm_prefix}\n"${point
          .name}"\n${AppStrings.delete_point_confirm_suffix}',
      confirmText: AppStrings.button_delete,
      cancelText: AppStrings.button_cancel,
    );
    if (confirm != true) return;

    try {
      await _storage.deletePointMedia(point);
      _tripElements.removeWhere((trip) => trip.pointId2 == point.id);

      final deletedOrder = point.tripOrder;
      _points.removeWhere((p) => p.id == point.id);

      for (var p in _points) {
        if (p.tripOrder > deletedOrder) p.tripOrder--;
      }

      await _saveData();
      await _loadPoints();
      _showSuccessSnackBar('${AppStrings.snack_deleted} "${point.name}"');
    } catch (e) {
      _showErrorSnackBar('${AppStrings.snack_error} $e');
    }
  }

  Future<void> _editPoint(InterestPoint point) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AddInterestPointPage(existingPoint: point),
      ),
    );
    if (result == true) await _loadPoints();
  }

  void _reorderPointsWithRoutes(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) newIndex -= 1;


    setState(() {
      // Create a map to store each point's incoming route (route TO this point)
      // Key: pointId2 (destination), Value: TripElement
      Map<int, TripElement> incomingRoutes = {};
      for (var trip in _tripElements) {
        incomingRoutes[trip.pointId2] = trip;
      }

      // Remove and reinsert the point
      final point = _points.removeAt(oldIndex);
      _points.insert(newIndex, point);

      // Update trip orders
      for (int i = 0; i < _points.length; i++) {
        _points[i].tripOrder = i;
      }

      // Rebuild trip elements while preserving the travel method attached to each point
      List<TripElement> newTripElements = [];
      for (int i = 0; i < _points.length; i++) {
        if (i > 0) {
          // Get the route that was originally attached to this point (coming INTO it)
          var existingRoute = incomingRoutes[_points[i].id];

          if (existingRoute != null) {
            // Update only pointId1 (the previous point), keep pointId2 and method
            existingRoute.pointId1 = _points[i - 1].id;
            newTripElements.add(existingRoute);
          } else {
            // Create new route if none existed
            newTripElements.add(TripElement(
              pointId1: _points[i - 1].id,
              pointId2: _points[i].id,
            ));
          }
        }
      }
      _tripElements = newTripElements;
      _rebuildTripIndex();
    });

    _saveData();
  }

  Future<void> _changeTripMethod(TripElement trip) async {
    final result = await TravelMethodDialog.show(
      context,
      currentMethod: trip.method,
    );

    if (result != null) {
      setState(() {
        trip.method = result;
      });
      await _saveData();
      _showSuccessSnackBar(AppStrings.snack_method_updated);
    }
  }


  void _showErrorSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red, // Functional red stays red
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_outline, color: Colors.white),
            const SizedBox(width: 12),
            Text(message),
          ],
        ),
        backgroundColor: accent, // Refactored to theme accent
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text(AppStrings.manage_points_title),
        systemOverlayStyle: SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        centerTitle: true,
        backgroundColor: accent,
        // Refactored to theme accent
        foregroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
        actions: const [
          InfoIcon(infoText: AppStrings.info_manage_points),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(primary)))
          : _points.isEmpty
          ? _buildEmptyState()
          : _buildPointsList(),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
                color: pale, shape: BoxShape.circle),
            // Refactored to theme pale
            child: const Icon(Icons.place_outlined, size: 80,
                color: primary), // Refactored to theme primary
          ),
          const SizedBox(height: 24),
          const Text(AppStrings.empty_points_title,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(AppStrings.empty_points_subtitle,
              style: TextStyle(fontSize: 15, color: Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildPointsList() {
    return ScrollConfiguration(
      behavior: const ScrollBehavior().copyWith(
        physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics()),
      ),
      child: ReorderableListView.builder(
        padding: const EdgeInsets.all(16),
        onReorder: _reorderPointsWithRoutes,
        itemCount: _points.length,
        // Explicitly set physics for the builder
        physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics()),
        proxyDecorator: (child, index, animation) {
          return AnimatedBuilder(
            animation: animation,
            builder: (context, child) {
              return Material(
                color: Colors.transparent,
                elevation: 0,
                child: child,
              );
            },
            child: child,
          );
        },
        itemBuilder: (context, index) {
          final point = _points[index];
          TripElement? tripBefore;

          if (index > 0) {
            final prevPoint = _points[index - 1];
            final existing = _tripsByDestination[point.id];
            if (existing != null && existing.pointId1 == prevPoint.id) {
              tripBefore = existing;
            } else {
              final newTrip = TripElement(
                  pointId1: prevPoint.id, pointId2: point.id);
              _tripElements.add(newTrip);
              _tripsByDestination[point.id] = newTrip;
              _saveData();
              tripBefore = newTrip;
            }
          }

          return PointWithRouteCard(
            key: ValueKey('point_route_${point.id}'),
            point: point,
            orderNumber: index + 1,
            tripBefore: tripBefore,
            onEdit: () => _editPoint(point),
            onDelete: () => _deletePoint(point),
            onChangeTripMethod: tripBefore != null ? () =>
                _changeTripMethod(tripBefore!) : null,
          );
        },
      ),
    );
  }
}