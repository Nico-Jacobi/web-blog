import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:latlong2/latlong.dart';

import '../colors.dart';
import '../model/interest_point.dart';
import '../services/storage_service.dart';
import '../strings.dart';
import 'coordinate_picker.dart';

/// A minimal page for creating a Waypoint (an InterestPoint with isWaypoint=true).
///
/// Two modes are offered through an initial dialog:
///   - "Auf Karte auswählen": opens [CoordinatePickerPage], pre-fills the lat/lon
///     fields with the picked location.
///   - "Koordinaten manuell eingeben": closes the dialog and lets the user type
///     lat/lon directly.
///
/// On save, the page validates the coordinates and pops with a fully constructed
/// [InterestPoint] (isWaypoint: true, all narrative fields empty). The caller is
/// responsible for assigning a final tripOrder before persisting.
class CreateWaypointPage extends StatefulWidget {
  const CreateWaypointPage({super.key});

  @override
  State<CreateWaypointPage> createState() => _CreateWaypointPageState();
}

class _CreateWaypointPageState extends State<CreateWaypointPage> {
  final StorageService _storage = StorageService();

  final TextEditingController _latController = TextEditingController();
  final TextEditingController _lonController = TextEditingController();

  String? _errorText;

  @override
  void initState() {
    super.initState();
    // Show mode-selection dialog after the first frame so we have a valid context.
    WidgetsBinding.instance.addPostFrameCallback((_) => _showModeDialog());
  }

  @override
  void dispose() {
    _latController.dispose();
    _lonController.dispose();
    super.dispose();
  }

  Future<void> _showModeDialog() async {
    final choice = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text(AppStrings.create_waypoint_title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.map_outlined, color: primary),
              title: const Text(AppStrings.choose_on_map),
              onTap: () => Navigator.pop(ctx, 'map'),
            ),
            ListTile(
              leading: const Icon(Icons.edit, color: primary),
              title: const Text(AppStrings.enter_coordinates_manually),
              onTap: () => Navigator.pop(ctx, 'manual'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(AppStrings.button_cancel),
          ),
        ],
      ),
    );

    if (!mounted) return;

    if (choice == 'map') {
      await _pickOnMap();
    } else if (choice == null) {
      // User cancelled the mode dialog -> abort the whole page.
      Navigator.pop(context);
    }
    // 'manual' -> stay on this page; user types into the text fields.
  }

  Future<void> _pickOnMap() async {
    final result = await Navigator.push<LatLng>(
      context,
      MaterialPageRoute(builder: (_) => const CoordinatePickerPage()),
    );

    if (!mounted) return;

    if (result == null) {
      // User cancelled the picker -> abort the page.
      Navigator.pop(context);
      return;
    }

    setState(() {
      _latController.text = result.latitude.toStringAsFixed(6);
      _lonController.text = result.longitude.toStringAsFixed(6);
      _errorText = null;
    });
  }

  /// Generates a new ID using the same strategy as create_point_page.dart:
  /// max(existing ids) + 1, or 1 if list is empty.
  Future<int> _generateNewId() async {
    final data = await _storage.loadPointsAndTrips();
    final List<InterestPoint> points = data['points'] as List<InterestPoint>;
    if (points.isEmpty) return 1;
    return points.map((e) => e.id).reduce((a, b) => a > b ? a : b) + 1;
  }

  Future<void> _onSave() async {
    final lat = double.tryParse(_latController.text.trim());
    final lon = double.tryParse(_lonController.text.trim());

    if (lat == null ||
        lon == null ||
        lat.abs() > 90 ||
        lon.abs() > 180) {
      setState(() => _errorText = AppStrings.error_invalid_coordinates);
      return;
    }

    final id = await _generateNewId();

    if (!mounted) return;

    final waypoint = InterestPoint(
      id: id,
      name: '',
      shortDescription: '',
      titleImagePath: '',
      otherMediaPaths: const [],
      lat: lat,
      lon: lon,
      date: null,
      description: '',
      tripOrder: 0, // Caller (manage page) overwrites with the actual order.
      isWaypoint: true,
    );

    Navigator.pop(context, waypoint);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text(AppStrings.create_waypoint_title),
        backgroundColor: accent,
        foregroundColor: Colors.white,
        centerTitle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _latController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
              ],
              decoration: InputDecoration(
                labelText: AppStrings.label_lat,
                errorText: _errorText,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
                fillColor: Colors.white,
                prefixIcon: const Icon(Icons.place_outlined, color: primary),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _lonController,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
              ],
              decoration: InputDecoration(
                labelText: AppStrings.label_lon,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                filled: true,
                fillColor: Colors.white,
                prefixIcon: const Icon(Icons.place_outlined, color: primary),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _pickOnMap,
              icon: const Icon(Icons.map_outlined, color: primary),
              label: const Text(
                AppStrings.choose_on_map,
                style: TextStyle(color: primary),
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: pale, width: 2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
            const Spacer(),
            SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: _onSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Text(
                  AppStrings.button_save,
                  style: TextStyle(fontSize: 16, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
