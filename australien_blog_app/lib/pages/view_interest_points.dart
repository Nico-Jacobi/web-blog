import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';

import '../model/interest_point.dart';
import 'interest_point_page.dart';

class ManagePointsPage extends StatefulWidget {
  const ManagePointsPage({Key? key}) : super(key: key);

  @override
  State<ManagePointsPage> createState() => _ManagePointsPageState();
}

class _ManagePointsPageState extends State<ManagePointsPage> {
  List<InterestPoint> _points = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();

    // Set normal navigation bar color
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
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/points.json');

      if (await file.exists()) {
        final jsonString = await file.readAsString();
        final List<dynamic> jsonList = jsonDecode(jsonString);

        _points = jsonList.map((json) => InterestPoint(
          id: json['id'],
          name: json['name'] ?? '',
          shortDescription: json['shortDescription'] ?? '',
          titleImagePath: json['titleImagePath'] ?? '',
          otherImagePaths: List<String>.from(json['otherImagePaths'] ?? []),
          lat: json['lat']?.toDouble(),
          lon: json['lon']?.toDouble(),
          date: json['date'],
          description: json['description'] ?? '',
        )).toList();

        // Sort by date (most recent first)
        _points.sort((a, b) {
          if (a.date == null && b.date == null) return 0;
          if (a.date == null) return 1;
          if (b.date == null) return -1;

          try {
            final dateA = _parseDate(a.date!);
            final dateB = _parseDate(b.date!);
            return dateB.compareTo(dateA); // Descending order
          } catch (e) {
            return 0;
          }
        });
      }
    } catch (e) {
      print('Error loading points: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading points: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  DateTime _parseDate(String dateStr) {
    // Parse DD/MM/YYYY format
    final parts = dateStr.split('/');
    if (parts.length == 3) {
      return DateTime(
        int.parse(parts[2]), // year
        int.parse(parts[1]), // month
        int.parse(parts[0]), // day
      );
    }
    return DateTime.now();
  }

  Future<void> _deletePoint(InterestPoint point) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Point?'),
        content: Text('Are you sure you want to delete "${point.name}"? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/points.json');

      // Remove from list
      final jsonList = _points
          .where((p) => p.id != point.id)
          .map((p) => p.toJson())
          .toList();

      // Save updated list
      await file.writeAsString(jsonEncode(jsonList));

      // Delete images
      try {
        if (point.titleImagePath.isNotEmpty) {
          final titleFile = File(point.titleImagePath);
          if (await titleFile.exists()) await titleFile.delete();
        }
        for (var imgPath in point.otherImagePaths) {
          final imgFile = File(imgPath);
          if (await imgFile.exists()) await imgFile.delete();
        }
      } catch (e) {
        print('Error deleting images: $e');
      }

      // Reload points
      await _loadPoints();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Deleted "${point.name}"')),
        );
      }
    } catch (e) {
      print('Error deleting point: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error deleting point: $e')),
        );
      }
    }
  }

  Future<void> _editPoint(InterestPoint point) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AddInterestPointPage(existingPoint: point),
      ),
    );

    // Reload if point was saved
    if (result == true) {
      await _loadPoints();
    }
  }

  String _formatDisplayDate(String? date) {
    if (date == null || date.isEmpty) return 'No date';
    return date;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Points'),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _points.isEmpty
          ? Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.place_outlined, size: 80, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No points yet',
              style: TextStyle(fontSize: 18, color: Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            Text(
              'Create your first interest point!',
              style: TextStyle(color: Colors.grey[500]),
            ),
          ],
        ),
      )
          : RefreshIndicator(
        onRefresh: _loadPoints,
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: _points.length,
          itemBuilder: (context, index) {
            final point = _points[index];
            return _PointCard(
              point: point,
              onEdit: () => _editPoint(point),
              onDelete: () => _deletePoint(point),
            );
          },
        ),
      ),
    );
  }
}

class _PointCard extends StatelessWidget {
  final InterestPoint point;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _PointCard({
    required this.point,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        onTap: onEdit,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Thumbnail
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 70,
                  height: 70,
                  color: Colors.grey[300],
                  child: point.titleImagePath.isNotEmpty
                      ? Image.file(
                    File(point.titleImagePath),
                    fit: BoxFit.cover,
                    cacheWidth: 140,
                    cacheHeight: 140,
                    errorBuilder: (_, __, ___) => Icon(
                      Icons.broken_image,
                      color: Colors.grey[400],
                    ),
                  )
                      : Icon(Icons.image, color: Colors.grey[400]),
                ),
              ),
              const SizedBox(width: 12),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      point.name.isNotEmpty ? point.name : 'Unnamed',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                        const SizedBox(width: 4),
                        Text(
                          point.date ?? 'No date',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                    if (point.shortDescription.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        point.shortDescription,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),

              // Actions
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit, size: 20),
                    onPressed: onEdit,
                    tooltip: 'Edit',
                    color: Colors.blue,
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete, size: 20),
                    onPressed: onDelete,
                    tooltip: 'Delete',
                    color: Colors.red,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}