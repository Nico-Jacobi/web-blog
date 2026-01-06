// pages/manage_points_page.dart
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import '../colors.dart';
import '../model/interest_point.dart';
import '../widgets/point_with_route_card.dart';
import '../services/storage_service.dart';
import 'create_point_page.dart';

class ManagePointsPage extends StatefulWidget {
  const ManagePointsPage({Key? key}) : super(key: key);

  @override
  State<ManagePointsPage> createState() => _ManagePointsPageState();
}

class _ManagePointsPageState extends State<ManagePointsPage> {
  final StorageService _storage = StorageService();
  List<InterestPoint> _points = [];
  List<TripElement> _tripElements = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );
    _loadPoints();
  }

  Future<void> _loadPoints() async {
    setState(() => _isLoading = true);
    try {
      final data = await _storage.loadPointsAndTrips();
      setState(() {
        _points = data['points'] as List<InterestPoint>;
        _tripElements = data['trips'] as List<TripElement>;
      });
    } catch (e) {
      _showErrorSnackBar('Error loading points: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveData() async {
    await _storage.savePointsAndTrips(_points, _tripElements);
  }

  Future<void> _deletePoint(InterestPoint point) async {
    final confirm = await _showDeleteDialog(point.name);
    if (confirm != true) return;

    try {
      await _storage.deletePointImages(point);
      _tripElements.removeWhere((trip) => trip.pointId2 == point.id);

      final deletedOrder = point.tripOrder;
      _points.removeWhere((p) => p.id == point.id);

      for (var p in _points) {
        if (p.tripOrder > deletedOrder) p.tripOrder--;
      }

      await _saveData();
      await _loadPoints();
      _showSuccessSnackBar('Deleted "${point.name}"');
    } catch (e) {
      _showErrorSnackBar('Error deleting point: $e');
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
      final point = _points.removeAt(oldIndex);
      _points.insert(newIndex, point);

      for (int i = 0; i < _points.length; i++) {
        _points[i].tripOrder = i;
      }

      List<TripElement> newTripElements = [];
      for (int i = 0; i < _points.length; i++) {
        if (i > 0) {
          var existingTrip = _tripElements.firstWhere(
                (t) => t.pointId1 == _points[i - 1].id && t.pointId2 == _points[i].id,
            orElse: () => TripElement(
              pointId1: _points[i - 1].id,
              pointId2: _points[i].id,
            ),
          );
          newTripElements.add(existingTrip);
        }
      }
      _tripElements = newTripElements;
    });

    _saveData();
  }

  Future<void> _changeTripMethod(TripElement trip) async {
    final result = await showDialog<TripMethod>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Select Transport Method'),
        contentPadding: const EdgeInsets.symmetric(vertical: 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: TripMethod.values.map((method) {
            return ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: trip.method == method
                      ? primary.withOpacity(0.2)
                      : Colors.grey[100],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  method.icon,
                  color: trip.method == method ? primary : Colors.grey[700],
                ),
              ),
              title: Text(method.label),
              trailing: trip.method == method
                  ? const Icon(Icons.check, color: primary)
                  : null,
              onTap: () => Navigator.pop(context, method),
            );
          }).toList(),
        ),
      ),
    );

    if (result != null && result != trip.method) {
      setState(() => trip.method = result);
      await _saveData();
    }
  }

  Future<bool?> _showDeleteDialog(String pointName) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.orange[700], size: 28),
            const SizedBox(width: 12),
            const Text('Delete Point?'),
          ],
        ),
        content: Text(
          'Are you sure you want to delete "$pointName"?\n\nThis will also remove the route before this point.',
          style: const TextStyle(height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: Colors.grey[700])),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[500],
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showErrorSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red[400],
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
        backgroundColor: primary,
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
        title: const Text('Manage Points'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
        ),
      ),
      body: _isLoading
          ? const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(primary),
        ),
      )
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
              color: pale,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.place_outlined,
              size: 80,
              color: primary,
            ),
          ),
          const SizedBox(height: 24),
          const Text(
            'No points yet',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Create your first interest point!',
            style: TextStyle(fontSize: 15, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildPointsList() {
    return ReorderableListView.builder(
      padding: const EdgeInsets.all(16),
      onReorder: _reorderPointsWithRoutes,
      itemCount: _points.length,
      proxyDecorator: (child, index, animation) {
        return AnimatedBuilder(
          animation: animation,
          builder: (context, child) {
            return Material(
              elevation: 8,
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(20),
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
          tripBefore = _tripElements.firstWhere(
                (t) => t.pointId1 == prevPoint.id && t.pointId2 == point.id,
            orElse: () {
              final newTrip = TripElement(
                pointId1: prevPoint.id,
                pointId2: point.id,
              );
              _tripElements.add(newTrip);
              _saveData();
              return newTrip;
            },
          );
        }

        return PointWithRouteCard(
          key: ValueKey('point_route_${point.id}'),
          point: point,
          orderNumber: index + 1,
          tripBefore: tripBefore,
          onEdit: () => _editPoint(point),
          onDelete: () => _deletePoint(point),
          onChangeTripMethod: tripBefore != null
              ? () => _changeTripMethod(tripBefore!)
              : null,
        );
      },
    );
  }
}
