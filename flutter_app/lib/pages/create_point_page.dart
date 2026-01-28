import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:exif/exif.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:latlong2/latlong.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:video_compress/video_compress.dart';
import 'package:video_player/video_player.dart';

import '../colors.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import '../services/storage_service.dart';
import '../strings.dart';
import '../widgets/confirm_dialog.dart';
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
  List<MediaFile> _otherMedia = [];
  bool _isEditMode = false;

  InterestPoint? _lastPoint;
  TripMethod _selectedMethod = TripMethod.car;

  // Track if user has made any changes
  bool _hasUnsavedChanges = false;

  // Store original values for edit mode
  String _originalName = '';
  String _originalShortDesc = '';
  String _originalDesc = '';
  String _originalLat = '';
  String _originalLon = '';
  String _originalDate = '';
  String? _originalTitleImagePath;
  List<String> _originalOtherMediaPaths = [];
  TripMethod _originalTravelMethod = TripMethod.car;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
    );

    // Add listeners to text controllers
    _nameCtrl.addListener(_markAsChanged);
    _shortDescCtrl.addListener(_markAsChanged);
    _descCtrl.addListener(_markAsChanged);
    _latCtrl.addListener(_markAsChanged);
    _lonCtrl.addListener(_markAsChanged);
    _dateCtrl.addListener(_markAsChanged);

    if (widget.existingPoint != null) {
      _isEditMode = true;
      _loadExistingPoint(widget.existingPoint!);
    } else {
      _loadLastPoint();
    }
  }

  void _markAsChanged() {
    if (!_hasUnsavedChanges) {
      setState(() => _hasUnsavedChanges = true);
    }
  }

  bool _hasActualChanges() {
    if (!_isEditMode) {
      // For new points, check if any field has content
      return _nameCtrl.text.isNotEmpty ||
          _shortDescCtrl.text.isNotEmpty ||
          _descCtrl.text.isNotEmpty ||
          _latCtrl.text.isNotEmpty ||
          _lonCtrl.text.isNotEmpty ||
          _dateCtrl.text.isNotEmpty ||
          _titleImage != null ||
          _otherMedia.isNotEmpty;
    } else {
      // For edit mode, check if anything changed from original
      return _nameCtrl.text != _originalName ||
          _shortDescCtrl.text != _originalShortDesc ||
          _descCtrl.text != _originalDesc ||
          _latCtrl.text != _originalLat ||
          _lonCtrl.text != _originalLon ||
          _dateCtrl.text != _originalDate ||
          _titleImage?.path != _originalTitleImagePath ||
          _otherMedia.length != _originalOtherMediaPaths.length ||
          _selectedMethod != _originalTravelMethod ||
          !_otherMedia.every((media) => _originalOtherMediaPaths.contains(media.file.path));
    }
  }

  Future<void> _loadLastPoint() async {
    try {
      final data = await _storage.loadPointsAndTrips();
      final points = data['points'] as List<InterestPoint>;

      if (points.isNotEmpty) {
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

  Future<void> _loadExistingPoint(InterestPoint point) async {
    final appDir = await getApplicationDocumentsDirectory();

    _nameCtrl.text = point.name;
    _shortDescCtrl.text = point.shortDescription;
    _descCtrl.text = point.description ?? '';
    _latCtrl.text = point.lat?.toStringAsFixed(6) ?? '';
    _lonCtrl.text = point.lon?.toStringAsFixed(6) ?? '';
    _dateCtrl.text = point.date ?? '';

    // Store original values
    _originalName = point.name;
    _originalShortDesc = point.shortDescription;
    _originalDesc = point.description ?? '';
    _originalLat = point.lat?.toStringAsFixed(6) ?? '';
    _originalLon = point.lon?.toStringAsFixed(6) ?? '';
    _originalDate = point.date ?? '';

    if (point.titleImagePath.isNotEmpty) {
      final titleMedia = MediaFile.fromFilenameSync(point.titleImagePath, appDir.path);
      _titleImage = titleMedia.file;
      _originalTitleImagePath = titleMedia.file.path;
    }

    // Load media files
    _otherMedia = point.otherMediaPaths.map((filename) {
      return MediaFile.fromFilenameSync(filename, appDir.path);
    }).toList();

    _originalOtherMediaPaths = _otherMedia.map((media) => media.file.path).toList();

    setState(() {});
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
      _markAsChanged();
      setState(() {});
    }
  }

  Future<void> _pickOtherMedia() async {
    try {
      // pickMultipleMedia is the standard for mixed types
      final List<XFile> picked = await _picker.pickMultipleMedia();

      if (picked.isNotEmpty) {
        final List<MediaFile> newFiles = [];
        for (var xf in picked) {
          final f = File(xf.path);
          if (!_otherMedia.any((m) => m.file.path == f.path)) {
            final isVideo = _isVideoExtension(xf.path);
            newFiles.add(MediaFile(f, isVideo));
          }
        }

        if (newFiles.isNotEmpty) {
          _markAsChanged();
          setState(() => _otherMedia.addAll(newFiles));
        }
      }
    } on PlatformException catch (e) {
      debugPrint("Picker error: $e");
    }
  }

  bool _isVideoExtension(String path) {
    final ext = path.toLowerCase();
    return ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.avi');
  }

  Future<void> _pickImages() async {
    final List<XFile> picked = await _picker.pickMultiImage();
    if (picked.isNotEmpty) {
      List<MediaFile> newFiles = [];
      for (var xf in picked) {
        File f = File(xf.path);
        if (!_otherMedia.any((media) => media.file.path == f.path)) {
          newFiles.add(MediaFile(f, false));
          if (newFiles.length == 1) await _extractMetadata(f);
        }
      }
      if (newFiles.isNotEmpty) {
        _markAsChanged();
        setState(() => _otherMedia.addAll(newFiles));
      }
    }
  }

  Future<void> _pickVideo() async {
    final XFile? video = await _picker.pickVideo(
      source: ImageSource.gallery,
    );

    if (video != null) {
      File f = File(video.path);
      if (!_otherMedia.any((media) => media.file.path == f.path)) {
        _markAsChanged();
        setState(() => _otherMedia.add(MediaFile(f, true)));
      }
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
      _markAsChanged();
    }
  }

  String _generateMediaFilename(String extension) {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final random = (DateTime.now().microsecondsSinceEpoch % 10000);
    return 'media_${timestamp}_${random}$extension';
  }

  Future<void> _saveData() async {
    if (_titleImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(AppStrings.error_title_image_required)),
      );
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(child: CircularProgressIndicator(color: primary)),
    );

    try {
      final appDir = await getApplicationDocumentsDirectory();
      final data = await _storage.loadPointsAndTrips();
      List<InterestPoint> points = data['points'];
      List<TripElement> trips = data['trips'];

      int pointId = _isEditMode && widget.existingPoint != null
          ? widget.existingPoint!.id
          : (points.isEmpty ? 1 : points.map((e) => e.id).reduce((a, b) => a > b ? a : b) + 1);

      // Handle title image
      String titleFilename;
      if (_titleImage!.path.startsWith(appDir.path)) {
        // Already in app directory
        titleFilename = path.basename(_titleImage!.path);
      } else {
        // New image - compress and save
        final newFilename = _generateMediaFilename(path.extension(_titleImage!.path));
        final targetPath = path.join(appDir.path, newFilename);
        await _compressImage(_titleImage!, targetPath);
        titleFilename = newFilename;
      }

      // Handle other media
      List<String> mediaFilenames = [];
      for (var media in _otherMedia) {
        if (media.file.path.startsWith(appDir.path)) {
          // Already in app directory
          mediaFilenames.add(media.filename);
        } else {
          // New media - compress and save
          final newFilename = _generateMediaFilename(media.extension);
          final targetPath = path.join(appDir.path, newFilename);
          await _compressMedia(media, targetPath);
          mediaFilenames.add(newFilename);
        }
      }

      InterestPoint point = InterestPoint(
        id: pointId,
        name: _nameCtrl.text,
        shortDescription: _shortDescCtrl.text,
        titleImagePath: titleFilename,  // Just filename
        otherMediaPaths: mediaFilenames,  // Just filenames
        lat: double.tryParse(_latCtrl.text),
        lon: double.tryParse(_lonCtrl.text),
        date: _dateCtrl.text,
        description: _descCtrl.text,
        tripOrder: _isEditMode && widget.existingPoint != null ? widget.existingPoint!.tripOrder : pointId,
      );

      if (_isEditMode) {
        final index = points.indexWhere((p) => p.id == pointId);
        if (index != -1) points[index] = point;
      } else {
        points.add(point);
        if (_lastPoint != null) {
          trips.add(TripElement(
            pointId1: _lastPoint!.id,
            pointId2: pointId,
            method: _selectedMethod,
          ));
        }
      }

      await _storage.savePointsAndTrips(points, trips);

      if (mounted) Navigator.pop(context);
      if (mounted) Navigator.pop(context, true);

    } catch (e) {
      if (mounted) Navigator.pop(context);
      debugPrint("Error saving data: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Error saving data")),
      );
    }
  }


  Future<String> _compressImage(File file, String targetPath) async {
    final compressed = await FlutterImageCompress.compressAndGetFile(
      file.path,
      targetPath,
      quality: 80,
      format: CompressFormat.jpeg,
    );

    if (compressed == null) {
      debugPrint("Image compression failed, copying original");
      await file.copy(targetPath);
      return targetPath;
    }

    return compressed.path;
  }

  Future<String> _compressMedia(MediaFile media, String targetPath) async {
    if (!media.isVideo) {
      // Image compression
      return await _compressImage(media.file, targetPath);
    } else {
      // Video compression
      debugPrint("🎥 Compressing video: ${media.file.path}");

      try {
        final info = await VideoCompress.compressVideo(
          media.file.path,
          quality: VideoQuality.MediumQuality,
          deleteOrigin: false, // Keep original until we're done
          includeAudio: true,
        );

        if (info != null && info.file != null) {
          final originalSize = await media.file.length();
          final compressedSize = await info.file!.length();
          debugPrint("✅ Video compressed: ${originalSize} bytes -> ${compressedSize} bytes");
          await info.file!.copy(targetPath);
          return targetPath;
        } else {
          debugPrint("⚠️ Video compression returned null, copying original");
          await media.file.copy(targetPath);
          return targetPath;
        }
      } catch (e) {
        debugPrint("❌ Video compression error: $e");
        // Fallback: copy original
        await media.file.copy(targetPath);
        return targetPath;
      }
    }
  }

  Future<bool> _onWillPop() async {
    // Only show dialog if there are actual changes
    if (!_hasActualChanges()) {
      return true;
    }

    final shouldDiscard = await GradientConfirmDialog.show(
      context,
      title: AppStrings.discard_changes_title,
      content: AppStrings.discard_changes_message,
      confirmText: AppStrings.button_discard,
      cancelText: AppStrings.button_cancel,
    );

    return shouldDiscard ?? false;
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

  Widget _buildMediaThumbnail(MediaFile media) {
    if (!media.isVideo) {
      return Image.file(
        media.file,
        width: 100,
        height: 100,
        fit: BoxFit.cover,
      );
    } else {
      // For videos, show first frame as thumbnail (non-interactive)
      return FutureBuilder<VideoPlayerController>(
        future: _getVideoController(media.file),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.done && snapshot.hasData) {
            return SizedBox(
              width: 100,
              height: 100,
              child: IgnorePointer(  // ← ADD THIS: Disables all interaction
                child: VideoPlayer(snapshot.data!),
              ),
            );
          }
          return Container(
            width: 100,
            height: 100,
            color: Colors.black87,
            child: const Center(
              child: Icon(Icons.videocam, color: Colors.white, size: 40),
            ),
          );
        },
      );
    }
  }

  Future<VideoPlayerController> _getVideoController(File videoFile) async {
    final controller = VideoPlayerController.file(videoFile);
    await controller.initialize();
    await controller.setVolume(0);
    await controller.seekTo(const Duration(seconds: 1)); // Get frame from 1s
    return controller;
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
                  Text(AppStrings.label_media_gallery, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.grey[800])),
                  IconButton(onPressed: _pickOtherMedia, icon: const Icon(Icons.add_circle, color: primary, size: 32)),
                ],
              ),
              if (_otherMedia.isNotEmpty)
                SizedBox(
                  height: 100,
                  child: ReorderableListView(
                    scrollDirection: Axis.horizontal,
                    onReorder: (oldIdx, newIdx) {
                      setState(() {
                        if (newIdx > oldIdx) newIdx -= 1;
                        final item = _otherMedia.removeAt(oldIdx);
                        _otherMedia.insert(newIdx, item);
                      });
                      _markAsChanged();
                    },
                    children: _otherMedia.asMap().entries.map((entry) {
                      return Container(
                        key: ValueKey(entry.value.file.path),
                        margin: const EdgeInsets.only(right: 8),
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: _buildMediaThumbnail(entry.value),
                            ),
                            // Video indicator
                            if (entry.value.isVideo)
                              Positioned(
                                bottom: 4,
                                right: 4,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: Colors.black54,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Icon(
                                    Icons.play_circle_outline,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                              ),
                            // Delete button
                            Positioned(
                              right: 0,
                              top: 0,
                              child: GestureDetector(
                                onTap: () {
                                  setState(() => _otherMedia.removeAt(entry.key));
                                  _markAsChanged();
                                },
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
                          FocusScope.of(context).unfocus();
                          final result = await TravelMethodDialog.show(context, currentMethod: _selectedMethod);
                          if (result != null) {
                            setState(() => _selectedMethod = result);
                            _markAsChanged();
                          }
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