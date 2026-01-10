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
import '../services/storage_service.dart'; // Import the service
import '../strings.dart';
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
  // Use the Singleton instance directly
  final StorageService _storage = StorageService();

  final _formKey = GlobalKey<FormState>();
  final ImagePicker _picker = ImagePicker();

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _shortDescCtrl = TextEditingController();
  final TextEditingController _descCtrl = TextEditingController();
  final TextEditingController _latCtrl = TextEditingController();
  final TextEditingController _lonCtrl = TextEditingController();
  final TextEditingController _dateCtrl = TextEditingController();

  File? _titleImage;
  List<File> _otherImages = [];
  bool _isEditMode = false;

  InterestPoint? _lastPoint;
  TripMethod _selectedMethod = TripMethod.car;

  get FlutterImageCompress => null;

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
      _loadLastPoint();
    }
  }

  Future<void> _loadLastPoint() async {
    try {
      // Use StorageService to load data
      final data = await _storage.loadPointsAndTrips();
      final points = data['points'] as List<InterestPoint>;

      if (points.isNotEmpty) {
        // Sort by tripOrder to ensure we get the actual last point
        points.sort((a, b) => a.tripOrder.compareTo(b.tripOrder));
        setState(() => _lastPoint = points.last);
      }
    } catch (e) {
      debugPrint("Error loading last point: $e");
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

    if (point.titleImagePath.isNotEmpty) _titleImage = File(point.titleImagePath);
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

      if (_dateCtrl.text.isEmpty && tags.containsKey('Image DateTime')) {
        final formatted = _formatExifDate(tags['Image DateTime'].toString());
        if (formatted != null) _dateCtrl.text = formatted;
      }

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
        } catch (e) { return null; }
      }

      double? lat = convertToDecimal(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
      double? lon = convertToDecimal(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);

      if (_latCtrl.text.isEmpty && lat != null) _latCtrl.text = lat.toStringAsFixed(6);
      if (_lonCtrl.text.isEmpty && lon != null) _lonCtrl.text = lon.toStringAsFixed(6);

      setState(() {});
    } catch (e) {
      debugPrint('Error extracting metadata: $e');
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
    final LatLng? result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const CoordinatePickerPage()),
    );
    if (result != null) {
      setState(() {
        _latCtrl.text = result.latitude.toStringAsFixed(6);
        _lonCtrl.text = result.longitude.toStringAsFixed(6);
      });
    }
  }

  String _generateImageFilename(String extension) {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (DateTime.now().microsecondsSinceEpoch % 10000);
    return 'img_${timestamp}_${random}$extension';
  }

  Future<void> _saveData() async {
    if (_titleImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.error_title_image_required)),
      );
      return;
    }

    // 1. Get Directory (Still needed for image copying)
    final appDir = await getApplicationDocumentsDirectory();

    // 2. Load existing data via Service
    final data = await _storage.loadPointsAndTrips();
    List<InterestPoint> points = data['points'];
    List<TripElement> trips = data['trips'];

    // 3. Logic for ID generation (unchanged)
    int pointId;
    if (_isEditMode && widget.existingPoint != null) {
      pointId = widget.existingPoint!.id;
      // We will replace the object in the list later
    } else {
      pointId = points.isEmpty
          ? 1
          : (points.map((e) => e.id).reduce((a, b) => a > b ? a : b)) + 1;
    }

// 4. Image Copying Logic - using unique filenames
    String newTitlePath = _titleImage!.path.startsWith(appDir.path)
        ? _titleImage!.path
        : '${appDir.path}/${_generateImageFilename(path.extension(_titleImage!.path))}';
    if (!_titleImage!.path.startsWith(appDir.path)) {
      newTitlePath = await _compressOnly(_titleImage!, newTitlePath);
    }

    List<String> newOtherPaths = [];
    for (int i = 0; i < _otherImages.length; i++) {
      String imagePath = _otherImages[i].path.startsWith(appDir.path)
          ? _otherImages[i].path
          : '${appDir.path}/${_generateImageFilename(path.extension(_otherImages[i].path))}';
      if (!_otherImages[i].path.startsWith(appDir.path)) {
        imagePath = await _compressOnly(_otherImages[i], imagePath);
      }
      newOtherPaths.add(imagePath);
    }


    // 5. Create Object
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
      tripOrder: _isEditMode && widget.existingPoint != null ? widget.existingPoint!.tripOrder : pointId,
    );

    // 6. Update Lists
    if (_isEditMode) {
      final index = points.indexWhere((p) => p.id == pointId);
      if (index != -1) {
        points[index] = point;
      }
    } else {
      points.add(point);

      // Add Trip connection if applicable
      if (_lastPoint != null) {
        trips.add(TripElement(
            pointId1: _lastPoint!.id,
            pointId2: pointId,
            method: _selectedMethod
        ));
      }
    }

    // 7. Save via Service
    await _storage.savePointsAndTrips(points, trips);

    if (mounted) Navigator.pop(context, true);
  }

  Future<String> _compressOnly(File file, String targetDir) async {
    final newFileName = '${targetDir}/${_generateImageFilename(path.extension(file.path))}';

    final compressed = await FlutterImageCompress.compressAndGetFile(
      file.path,
      newFileName,
      quality: 80, // keeps detail but reduces file size
    );

    return compressed!.path;
  }


  Future<bool> _onWillPop() async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [dark, primary], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(28),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle),
                child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 48),
              ),
              const SizedBox(height: 20),
              const Text(AppStrings.discard_changes_title, textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold, )),
              const SizedBox(height: 12),
              Text(AppStrings.discard_changes_message, textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(0.95), fontSize: 15, height: 1.5)),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        backgroundColor: Colors.white.withOpacity(0.2),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text(AppStrings.button_cancel, style: TextStyle(color: Colors.white, fontSize: 16)),
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
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text(AppStrings.button_discard, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
          prefixIcon: icon != null ? Icon(icon, color: primary) : null,
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
          title: Text(_isEditMode ? AppStrings.add_point_title_edit : AppStrings.add_point_title_new),
          systemOverlayStyle: const SystemUiOverlayStyle(
            systemNavigationBarColor: Colors.transparent,
            statusBarColor: Colors.transparent,
            systemNavigationBarIconBrightness: Brightness.light,
            statusBarIconBrightness: Brightness.dark,
          ),
          centerTitle: true,
          backgroundColor: accent,
          foregroundColor: Colors.white,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
          actions: [InfoIcon(infoText: AppStrings.info_date_location)],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              GestureDetector(
                onTap: _pickTitleImage,
                child: Container(
                  height: 200,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: pale, width: 2),
                  ),
                  child: _titleImage != null
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Image.file(_titleImage!, fit: BoxFit.cover, width: double.infinity),
                  )
                      : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add_photo_alternate_outlined, size: 64, color: primary),
                      Text(AppStrings.add_point_title_image, style: const TextStyle(color: primary, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              _buildField(_nameCtrl, AppStrings.field_name, icon: Icons.label_outline),
              _buildField(_shortDescCtrl, AppStrings.field_short_description, icon: Icons.description_outlined),
              Row(
                children: [
                  Expanded(child: _buildField(_latCtrl, AppStrings.field_latitude, hint: "0.0000", icon: Icons.place_outlined)),
                  const SizedBox(width: 12),
                  Expanded(child: _buildField(_lonCtrl, AppStrings.field_longitude, hint: "0.0000", icon: Icons.place_outlined)),
                  const SizedBox(width: 8),
                  Container(
                    height: 56, width: 56,
                    margin: const EdgeInsets.only(bottom: 16),
                    child: IconButton(
                      onPressed: _pickCoordinatesOnMap,
                      icon: const Icon(Icons.map_outlined, color: primary, size: 28),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: const BorderSide(color: pale),
                        ),
                      ),
                      tooltip: AppStrings.tooltip_pick_on_map,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildField(_dateCtrl, AppStrings.field_date, hint: "DD/MM/YYYY", icon: Icons.calendar_today_outlined),
              _buildField(_descCtrl, AppStrings.field_full_description, maxLines: 4, icon: Icons.notes_outlined),
              Row(
                children: [
                  Text(AppStrings.gallery_title, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.grey[800])),
                  IconButton(onPressed: _pickOtherImages, icon: const Icon(Icons.add_circle, color: primary, size: 32)),
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
                              right: 0, top: 0,
                              child: GestureDetector(
                                onTap: () => setState(() => _otherImages.removeAt(entry.key)),
                                child: Container(color: Colors.black54, child: const Icon(Icons.close, color: Colors.white, size: 16)),
                              ),
                            )
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              const SizedBox(height: 24),
              if (!_isEditMode && _lastPoint != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 24),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: pale),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.link, color: primary),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(AppStrings.link_previous_title, style: TextStyle(fontWeight: FontWeight.bold)),
                                Text("${AppStrings.link_previous_connect_to}${_lastPoint!.name}", style: const TextStyle(fontSize: 12, color: Colors.grey)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: () async {
                          FocusScope.of(context).unfocus(); // unfocus before dialog
                          final result = await TravelMethodDialog.show(context, currentMethod: _selectedMethod);
                          if (result != null) setState(() => _selectedMethod = result);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: pale.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: pale),
                          ),
                          child: Row(
                            children: [
                              Icon(_selectedMethod.icon, color: primary),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(AppStrings.travel_method_title, style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w500)),
                                    const SizedBox(height: 4),
                                    Text(_selectedMethod.label, style: const TextStyle(fontSize: 16, color: primary, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ),
                              const Icon(Icons.arrow_forward_ios, size: 16, color: primary),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _saveData,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(_isEditMode ? AppStrings.button_update_point : AppStrings.button_save_point, style: const TextStyle(fontSize: 16, color: Colors.white)),
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