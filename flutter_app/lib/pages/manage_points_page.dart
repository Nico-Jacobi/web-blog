import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:latlong2/latlong.dart';
import 'package:path/path.dart' as path;

import '../colors.dart'; // Using the theme colors
import '../services/blog_paths.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/info_icon.dart';
import '../widgets/point_with_route_card.dart';
import '../widgets/waypoint_card.dart';
import '../services/storage_service.dart';
import '../services/sync_service.dart';
import '../widgets/travel_method_dialog.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import 'coordinate_picker.dart';
import 'create_point_page.dart';
import 'create_waypoint_page.dart';

class ManagePointsPage extends StatefulWidget {
  const ManagePointsPage({super.key});

  @override
  State<ManagePointsPage> createState() => _ManagePointsPageState();
}

class _ManagePointsPageState extends State<ManagePointsPage> {
  final StorageService _storage = StorageService();
  List<InterestPoint> _points = [];
  List<TripElement> _tripElements = [];
  // Deleted items kept for sync propagation; filtered from UI.
  List<InterestPoint> _pointTombstones = [];
  List<TripElement> _tripTombstones = [];
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
      final appDir = await BlogPaths.dir();

      final allPoints = data['points'] as List<InterestPoint>;
      final allTrips  = data['trips']  as List<TripElement>;

      final visiblePoints = allPoints.where((p) => p.deletedAt == null).toList();
      final tombstonePoints = allPoints.where((p) => p.deletedAt != null).toList();
      final visibleTrips = allTrips.where((t) => t.deletedAt == null).toList();
      final tombstoneTrips = allTrips.where((t) => t.deletedAt != null).toList();

      // Convert filenames to full paths for UI display using MediaFile
      for (var p in visiblePoints) {
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
        _points = visiblePoints;
        _tripElements = visibleTrips;
        _pointTombstones = tombstonePoints;
        _tripTombstones = tombstoneTrips;
        _rebuildTripIndex();
      });
    } catch (e) {
      if (mounted) {
        final l10n = AppLocalizations.of(context)!;
        _showErrorSnackBar('${l10n.errorLoadingPoints} $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveData() async {
    // Strip any absolute UI paths back down to bare filenames (sync expects
    // filenames, UI uses full paths) — tombstones keep their original state.
    final cleanedVisible = _points.map((p) {
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
        otherMediaPaths: otherNames,
        lat: p.lat,
        lon: p.lon,
        date: p.date,
        description: p.description,
        tripOrder: p.tripOrder,
        isWaypoint: p.isWaypoint,
        updatedAt: p.updatedAt,
        deletedAt: p.deletedAt,
      );
    }).toList();

    final allPoints = [...cleanedVisible, ..._pointTombstones];
    final allTrips  = [..._tripElements, ..._tripTombstones];

    await _storage.savePointsAndTrips(allPoints, allTrips);
    SyncService().syncFromStorage().catchError((e) { debugPrint('[sync] $e'); return null; });
  }

  Future<void> _deletePoint(InterestPoint point) async {
    final l10n = AppLocalizations.of(context)!;
    final String dialogTitle = point.isWaypoint
        ? l10n.waypointDeleteTitle
        : l10n.deletePointTitle;

    final String dialogContent = point.isWaypoint
        ? '${l10n.waypointDeleteContent}\n'
            '(${point.lat?.toStringAsFixed(5) ?? '-'}, ${point.lon?.toStringAsFixed(5) ?? '-'})'
        : '${l10n.deletePointConfirmPrefix}\n"${point.name}"\n${l10n.deletePointConfirmSuffix}';

    final confirm = await GradientConfirmDialog.show(
      context,
      title: dialogTitle,
      content: dialogContent,
      confirmText: l10n.buttonDelete,
      cancelText: l10n.buttonCancel,
    );
    if (confirm != true) return;

    try {
      // Waypoints have no media files -> skip the media-deletion round-trip.
      if (!point.isWaypoint) {
        await _storage.deletePointMedia(point);
        SyncService().syncFromStorage().catchError((e) { debugPrint('[sync] $e'); return null; });
      }

      // Tombstone the incoming trip (so other clients learn it's gone too).
      for (final trip in _tripElements.where((t) => t.pointId2 == point.id)) {
        trip.markDeleted();
        _tripTombstones.add(trip);
      }
      _tripElements.removeWhere((trip) => trip.pointId2 == point.id);

      final deletedOrder = point.tripOrder;

      // Tombstone the point itself and move out of the visible list.
      point.markDeleted();
      _pointTombstones.add(point);
      _points.removeWhere((p) => p.id == point.id);

      // Renumber remaining visible points (order changed -> touch).
      for (var p in _points) {
        if (p.tripOrder > deletedOrder) {
          p.tripOrder--;
          p.touch();
        }
      }

      await _saveData();
      await _loadPoints();

      if (!mounted) return;
      final l10nAfter = AppLocalizations.of(context)!;
      final String successLabel = point.isWaypoint
          ? l10nAfter.waypointLabel
          : '"${point.name}"';
      _showSuccessSnackBar('${l10nAfter.snackDeleted} $successLabel');
    } catch (e) {
      if (!mounted) return;
      final l10nErr = AppLocalizations.of(context)!;
      _showErrorSnackBar('${l10nErr.snackError} $e');
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

  /// Opens the CoordinatePicker to update a waypoint's lat/lon in place.
  Future<void> _changeWaypointPosition(InterestPoint waypoint) async {
    final LatLng? result = await Navigator.push<LatLng>(
      context,
      MaterialPageRoute(builder: (_) => const CoordinatePickerPage()),
    );
    if (result == null) return;

    setState(() {
      waypoint.lat = result.latitude;
      waypoint.lon = result.longitude;
      waypoint.touch();
    });
    await _saveData();
    if (!mounted) return;
    _showSuccessSnackBar(AppLocalizations.of(context)!.waypointPositionUpdated);
  }

  /// Launches the CreateWaypointPage and appends the returned waypoint.
  /// Also wires up a TripElement to the previously-last point so the route
  /// graph stays connected.
  Future<void> _addWaypoint() async {
    final result = await Navigator.push<InterestPoint>(
      context,
      MaterialPageRoute(builder: (_) => const CreateWaypointPage()),
    );
    if (result == null) return;

    setState(() {
      result.tripOrder = _points.length;
      result.touch();
      final InterestPoint? previousLast =
          _points.isNotEmpty ? _points.last : null;
      _points.add(result);
      if (previousLast != null) {
        final trip = TripElement(
          id: TripElement.nextId([..._tripElements, ..._tripTombstones]),
          pointId1: previousLast.id,
          pointId2: result.id,
        );
        trip.touch();
        _tripElements.add(trip);
        _rebuildTripIndex();
      }
    });
    await _saveData();
    await _loadPoints();
    if (!mounted) return;
    _showSuccessSnackBar(AppLocalizations.of(context)!.waypointAdded);
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

      // Update trip orders (touch changed ones so sync propagates the new order)
      for (int i = 0; i < _points.length; i++) {
        if (_points[i].tripOrder != i) {
          _points[i].tripOrder = i;
          _points[i].touch();
        }
      }

      // Rebuild trip elements while preserving the travel method attached to each point.
      // Trip ids are stable — mutating pointId1 on an existing trip preserves cross-device
      // identity (no orphan on the server). Fresh trips get a monotonically-new id.
      int nextTripId = TripElement.nextId([..._tripElements, ..._tripTombstones]);
      List<TripElement> newTripElements = [];
      for (int i = 0; i < _points.length; i++) {
        if (i > 0) {
          var existingRoute = incomingRoutes[_points[i].id];
          final newPrevId = _points[i - 1].id;

          if (existingRoute != null) {
            if (existingRoute.pointId1 != newPrevId) {
              existingRoute.pointId1 = newPrevId;
              existingRoute.touch();
            }
            newTripElements.add(existingRoute);
          } else {
            final newTrip = TripElement(
              id: nextTripId++,
              pointId1: newPrevId,
              pointId2: _points[i].id,
            );
            newTrip.touch();
            newTripElements.add(newTrip);
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
        trip.touch();
      });
      await _saveData();
      if (!mounted) return;
      _showSuccessSnackBar(AppLocalizations.of(context)!.snackMethodUpdated);
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
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.managePointsTitle),
        systemOverlayStyle: const SystemUiOverlayStyle(
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
        actions: [
          InfoIcon(infoText: l10n.infoManagePoints),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(primary)))
          : _points.isEmpty
          ? _buildEmptyState()
          : _buildPointsList(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addWaypoint,
        backgroundColor: accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.flag_outlined),
        label: Text(l10n.buttonAddWaypoint),
      ),
    );
  }

  Widget _buildEmptyState() {
    final l10n = AppLocalizations.of(context)!;
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
          Text(l10n.emptyPointsTitle,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(l10n.emptyPointsSubtitle,
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
                id: TripElement.nextId([..._tripElements, ..._tripTombstones]),
                pointId1: prevPoint.id,
                pointId2: point.id,
              );
              newTrip.touch();
              _tripElements.add(newTrip);
              _tripsByDestination[point.id] = newTrip;
              _saveData();
              tripBefore = newTrip;
            }
          }

          if (point.isWaypoint) {
            return WaypointCard(
              key: ValueKey('waypoint_${point.id}'),
              point: point,
              orderNumber: index + 1,
              tripBefore: tripBefore,
              onDelete: () => _deletePoint(point),
              onChangePosition: () => _changeWaypointPosition(point),
              onChangeTripMethod: tripBefore != null
                  ? () => _changeTripMethod(tripBefore!)
                  : null,
            );
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
