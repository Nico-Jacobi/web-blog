import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:exif/exif.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:latlong2/latlong.dart';

import '../colors.dart';
import '../model/interest_point.dart';
import '../main.dart'; // Import for accent_color
import '../widgets/info_icon.dart';
import '../widgets/travel_method_dialog.dart';
import 'coordinate_picker.dart';


class AddInterestPointPage extends StatefulWidget {
  final InterestPoint? existingPoint;

  const AddInterestPointPage({this.existingPoint, Key? key}) : super(key: key);

  @override
  _AddInterestPointPageState createState() => _AddInterestPointPageState();
}

class _AddInterestPointPageState extends State<AddInterestPointPage> {
  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();

  // Controllers
  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _shortDescCtrl = TextEditingController();
  final TextEditingController _descCtrl = TextEditingController();
  final TextEditingController _latCtrl = TextEditingController();
  final TextEditingController _lonCtrl = TextEditingController();
  final TextEditingController _dateCtrl = TextEditingController();

  File? _titleImage;
  List<File> _otherImages = [];
  bool _isEditMode = false;

  // Linking variables
  bool _linkToPrevious = true;
  InterestPoint? _lastPoint;
  TripMethod _selectedMethod = TripMethod.car;

  @override
  void initState() {
    super.initState();

    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );

    if (widget.existingPoint != null) {
      _isEditMode = true;
      _loadExistingPoint(widget.existingPoint!);
    } else {
      // If creating new, try to find the last point to link to
      _loadLastPoint();
    }
  }

  Future<void> _loadLastPoint() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final file = File('${appDir.path}/points.json');
      if (await file.exists()) {
        final List<dynamic> jsonList = jsonDecode(await file.readAsString());
        if (jsonList.isNotEmpty) {
          // Sort by tripOrder to find the actual last point in the trip sequence
          final points = jsonList.map((json) => InterestPoint.fromJson(json)).toList();
          points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
          setState(() {
            _lastPoint = points.last;
          });
        }
      }
    } catch (e) {
      print("Error loading last point: $e");
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _shortDescCtrl.dispose();
    _descCtrl.dispose();
    _latCtrl.dispose();
    _lonCtrl.dispose();
    _dateCtrl.dispose();
    super.dispose();
  }

  void _loadExistingPoint(InterestPoint point) {
    _nameCtrl.text = point.name;
    _shortDescCtrl.text = point.shortDescription;
    _descCtrl.text = point.description ?? '';
    _latCtrl.text = point.lat?.toStringAsFixed(6) ?? '';
    _lonCtrl.text = point.lon?.toStringAsFixed(6) ?? '';
    _dateCtrl.text = point.date ?? '';

    if (point.titleImagePath.isNotEmpty) {
      _titleImage = File(point.titleImagePath);
    }
    _otherImages = point.otherImagePaths.map((p) => File(p)).toList();
  }

  String? _formatExifDate(String? exifDate) {
    if (exifDate == null || exifDate.isEmpty) return null;
    try {
      final parts = exifDate.split(' ');
      if (parts.isEmpty) return null;
      final dateParts = parts[0].split(':');
      if (dateParts.length != 3) return null;
      return '${dateParts[2]}/${dateParts[1]}/${dateParts[0]}';
    } catch (e) {
      return null;
    }
  }

  Future<void> _extractMetadata(File image) async {
    try {
      final bytes = await image.readAsBytes();
      final tags = await readExifFromBytes(bytes);

      // Date
      if (_dateCtrl.text.isEmpty && tags.containsKey('Image DateTime')) {
        final formatted = _formatExifDate(tags['Image DateTime'].toString());
        if (formatted != null) _dateCtrl.text = formatted;
      }

      // GPS
      double? convertToDecimal(IfdTag? tag, IfdTag? ref) {
        if (tag == null || ref == null) return null;
        try {
          final values = tag.values as IfdRatios;
          if (values.ratios.length < 3) return null;
          double d = values.ratios[0].toDouble();
          double m = values.ratios[1].toDouble();
          double s = values.ratios[2].toDouble();
          double res = d + (m / 60.0) + (s / 3600.0);
          final refStr = ref.printable.toUpperCase();
          return (refStr.contains('S') || refStr.contains('W')) ? -res : res;
        } catch (e) {
          return null;
        }
      }

      double? lat = convertToDecimal(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
      double? lon = convertToDecimal(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);

      if (_latCtrl.text.isEmpty && lat != null) _latCtrl.text = lat.toStringAsFixed(6);
      if (_lonCtrl.text.isEmpty && lon != null) _lonCtrl.text = lon.toStringAsFixed(6);

      setState(() {});
    } catch (e) {
      print('Error extracting metadata: $e');
    }
  }

  Future<void> _pickTitleImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      _titleImage = File(image.path);
      await _extractMetadata(_titleImage!);
      setState(() {});
    }
  }

  Future<void> _pickOtherImages() async {
    final List<XFile> picked = await _picker.pickMultiImage() ?? [];
    if (picked.isNotEmpty) {
      List<File> newFiles = [];
      for (var xf in picked) {
        File f = File(xf.path);
        if (!_otherImages.any((img) => img.path == f.path)) {
          newFiles.add(f);
          if (newFiles.length == 1) await _extractMetadata(f);
        }
      }
      setState(() => _otherImages.addAll(newFiles));
    }
  }

  Future<void> _pickCoordinatesOnMap() async {
    LatLng? initialLocation;
    final lat = double.tryParse(_latCtrl.text);
    final lon = double.tryParse(_lonCtrl.text);
    if (lat != null && lon != null) initialLocation = LatLng(lat, lon);

    final LatLng? result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => CoordinatePickerPage()), // Pass initialLocation if supported
    );

    if (result != null) {
      setState(() {
        _latCtrl.text = result.latitude.toStringAsFixed(6);
        _lonCtrl.text = result.longitude.toStringAsFixed(6);
      });
    }
  }

  Future<void> _saveData() async {
    if (_titleImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Title image required")),
      );
      return;
    }

    final appDir = await getApplicationDocumentsDirectory();
    final file = File('${appDir.path}/points.json');
    List<dynamic> currentList = [];
    if (await file.exists()) currentList = jsonDecode(await file.readAsString());

    int pointId;
    if (_isEditMode && widget.existingPoint != null) {
      pointId = widget.existingPoint!.id;
      currentList.removeWhere((item) => item['id'] == pointId);
    } else {
      pointId = currentList.isEmpty ? 1 : (currentList.map((e) => e['id'] as int).reduce((a, b) => a > b ? a : b)) + 1;
    }

    // Save Title Image
    String newTitlePath;
    if (_titleImage!.path.startsWith(appDir.path)) {
      newTitlePath = _titleImage!.path;
    } else {
      newTitlePath = '${appDir.path}/img_${pointId}_title${path.extension(_titleImage!.path)}';
      await _titleImage!.copy(newTitlePath);
    }

    // Save Other Images
    List<String> newOtherPaths = [];
    for (int i = 0; i < _otherImages.length; i++) {
      String imagePath;
      if (_otherImages[i].path.startsWith(appDir.path)) {
        imagePath = _otherImages[i].path;
      } else {
        imagePath = '${appDir.path}/img_${pointId}_other_$i${path.extension(_otherImages[i].path)}';
        await _otherImages[i].copy(imagePath);
      }
      newOtherPaths.add(imagePath);
    }

    InterestPoint point = InterestPoint(
      id: pointId,
      name: _nameCtrl.text,
      shortDescription: _shortDescCtrl.text,
      titleImagePath: newTitlePath,
      otherImagePaths: newOtherPaths,
      lat: double.tryParse(_latCtrl.text),
      lon: double.tryParse(_lonCtrl.text),
      date: _dateCtrl.text,
      description: _descCtrl.text,
      // preserve order if editing, else add to end
      tripOrder: _isEditMode && widget.existingPoint != null ? widget.existingPoint!.tripOrder : pointId,
    );

    currentList.add(point.toJson());
    await file.writeAsString(jsonEncode(currentList));

    // --- Save Connection if Linked ---
    if (!_isEditMode && _linkToPrevious && _lastPoint != null) {
      final connFile = File('${appDir.path}/connections.json');
      List<dynamic> connList = [];
      if (await connFile.exists()) {
        connList = jsonDecode(await connFile.readAsString());
      }

      connList.add({
        'fromId': _lastPoint!.id,
        'toId': pointId,
        'method': _selectedMethod.toString().split('.').last,
      });

      await connFile.writeAsString(jsonEncode(connList));
    }

    if (mounted) {
      Navigator.pop(context, true);
    }
  }

  Future<bool> _onWillPop() async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [dark, primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: primary.withOpacity(0.4),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: Colors.white,
                  size: 48,
                ),
              ),
              const SizedBox(height: 20),

              // Title
              const Text(
                'Discard Changes?',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),

              // Content
              Text(
                'Are you sure you want to discard your changes?\n\nThis action cannot be undone.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.95),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),

              // Actions
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        backgroundColor: Colors.white.withOpacity(0.2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context, true),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        backgroundColor: Colors.white,
                        foregroundColor: dark,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Discard',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ) ?? false;
  }


  Widget _buildField(TextEditingController ctrl, String label, {String? hint, int maxLines = 1, IconData? icon}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: ctrl,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: icon != null ? Icon(icon, color: accent_color) : null,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
          filled: true,
          fillColor: Colors.grey[50],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: Colors.grey[50],
        appBar: AppBar(
          title: Text(_isEditMode ? "Edit Point" : "New Point"),
          centerTitle: true,
          backgroundColor: accent_color,
          foregroundColor: Colors.white,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
          actions: [
            InfoIcon(
              infoText: 'Date and Location will be automaticly filled from the images added (if they contain a location), you can still change them after.',
            ),
          ],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              // Title Image
              GestureDetector(
                onTap: _pickTitleImage,
                child: Container(
                  height: 200,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: accent_color.withOpacity(0.3), width: 2),
                  ),
                  child: _titleImage != null
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Image.file(_titleImage!, fit: BoxFit.cover, width: double.infinity),
                  )
                      : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_photo_alternate_outlined, size: 64, color: accent_color),
                      Text("Add Title Image", style: TextStyle(color: accent_color, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              _buildField(_nameCtrl, "Name", icon: Icons.label_outline),
              _buildField(_shortDescCtrl, "Short Description", icon: Icons.description_outlined),

              Row(
                children: [
                  Expanded(
                    child: _buildField(_latCtrl, "Latitude", hint: "0.0000", icon: Icons.place_outlined),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildField(_lonCtrl, "Longitude", hint: "0.0000", icon: Icons.place_outlined),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    height: 56,
                    width: 56,
                    margin: const EdgeInsets.only(bottom: 16),
                    child: IconButton(
                      onPressed: _pickCoordinatesOnMap,
                      icon: Icon(Icons.map_outlined, color: accent_color, size: 28),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: accent_color.withOpacity(0.3)),
                        ),
                      ),
                      tooltip: 'Pick on Map',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              _buildField(_dateCtrl, "Date", hint: "DD/MM/YYYY", icon: Icons.calendar_today_outlined),
              _buildField(_descCtrl, "Full Description", maxLines: 4, icon: Icons.notes_outlined),

              // Gallery Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Gallery Images", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.grey[800])),
                  IconButton(onPressed: _pickOtherImages, icon: Icon(Icons.add_circle, color: accent_color, size: 32)),
                ],
              ),
              if (_otherImages.isNotEmpty)
                SizedBox(
                  height: 100,
                  child: ReorderableListView(
                    scrollDirection: Axis.horizontal,
                    onReorder: (oldIdx, newIdx) {
                      setState(() {
                        if (newIdx > oldIdx) newIdx -= 1;
                        final item = _otherImages.removeAt(oldIdx);
                        _otherImages.insert(newIdx, item);
                      });
                    },
                    children: _otherImages.asMap().entries.map((entry) {
                      return Container(
                        key: ValueKey(entry.value.path),
                        margin: const EdgeInsets.only(right: 8),
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.file(entry.value, width: 100, height: 100, fit: BoxFit.cover),
                            ),
                            Positioned(
                              right: 0,
                              top: 0,
                              child: GestureDetector(
                                onTap: () => setState(() => _otherImages.removeAt(entry.key)),
                                child: Container(
                                  color: Colors.black54,
                                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                                ),
                              ),
                            )
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),

              const SizedBox(height: 24),

              // --- Link to Previous (New UI) ---
              if (!_isEditMode && _lastPoint != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: accent_color.withOpacity(0.2)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(Icons.link, color: accent_color),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text("Link to Previous Point", style: TextStyle(fontWeight: FontWeight.bold)),
                                Text("Connect to: ${_lastPoint!.name}", style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              ],
                            ),
                          ),
                          Switch(
                            value: _linkToPrevious,
                            activeColor: accent_color,
                            onChanged: (val) => setState(() => _linkToPrevious = val),
                          ),
                        ],
                      ),
                      if (_linkToPrevious)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: InkWell(
                            onTap: () async {
                              final result = await TravelMethodDialog.show(
                                context,
                                currentMethod: _selectedMethod,
                              );
                              if (result != null) {
                                setState(() => _selectedMethod = result);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: accent_color.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: accent_color.withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  Icon(_selectedMethod.icon, color: accent_color),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          "Travel Method",
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _selectedMethod.label,
                                          style: TextStyle(
                                            fontSize: 16,
                                            color: accent_color,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Icon(Icons.arrow_forward_ios, size: 16, color: accent_color),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),

              // Save Button
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _saveData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent_color,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(_isEditMode ? "Update Point" : "Save Point", style: const TextStyle(fontSize: 16, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}