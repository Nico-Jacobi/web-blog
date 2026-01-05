import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:exif/exif.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:latlong2/latlong.dart';

import '../model/interest_point.dart';
import 'coordinate_picker.dart';



// --- Page ---
class AddInterestPointPage extends StatefulWidget {
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

  // --- Format EXIF Date ---
  String? _formatExifDate(String? exifDate) {
    if (exifDate == null || exifDate.isEmpty) return null;

    // EXIF format: "2026:01:05 18:40:36"
    try {
      final parts = exifDate.split(' ');
      if (parts.isEmpty) return null;

      final dateParts = parts[0].split(':');
      if (dateParts.length != 3) return null;

      // Convert to DD/MM/YYYY
      return '${dateParts[2]}/${dateParts[1]}/${dateParts[0]}';
    } catch (e) {
      print('Error formatting date: $e');
      return null;
    }
  }

  // --- Metadata Extraction ---
  Future<void> _extractMetadata(File image) async {
    try {
      final bytes = await image.readAsBytes();
      final tags = await readExifFromBytes(bytes);

      // Date - only set if field is still empty
      if (_dateCtrl.text.isEmpty && tags.containsKey('Image DateTime')) {
        final formatted = _formatExifDate(tags['Image DateTime'].toString());
        if (formatted != null) {
          _dateCtrl.text = formatted;
        }
      }

      // GPS Helper (DMS -> Decimal)
      double? convertToDecimal(IfdTag? tag, IfdTag? ref) {
        if (tag == null || ref == null) return null;
        try {
          final values = tag.values as List<Ratio>;
          if (values.length < 3) return null;

          double d = values[0].toDouble();
          double m = values[1].toDouble();
          double s = values[2].toDouble();
          double res = d + (m / 60.0) + (s / 3600.0);

          final refStr = ref.printable.toUpperCase();
          return refStr.contains('S') || refStr.contains('W') ? -res : res;
        } catch (e) {
          print('Error converting GPS: $e');
          return null;
        }
      }

      double? lat = convertToDecimal(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
      double? lon = convertToDecimal(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);

      // Only set if fields are empty
      if (_latCtrl.text.isEmpty && lat != null) {
        _latCtrl.text = lat.toStringAsFixed(6);
      }
      if (_lonCtrl.text.isEmpty && lon != null) {
        _lonCtrl.text = lon.toStringAsFixed(6);
      }

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
    try {
      final List<XFile> picked = await _picker.pickMultiImage() ?? [];

      if (picked.isNotEmpty) {
        // Create a new list to ensure proper state update
        List<File> newFiles = [];

        for (var xf in picked) {
          File f = File(xf.path);
          // Avoid duplicates
          if (!_otherImages.any((img) => img.path == f.path)) {
            newFiles.add(f);
            // Extract metadata from first image if coords/date still empty
            if (newFiles.length == 1) {
              await _extractMetadata(f);
            }
          }
        }

        setState(() {
          _otherImages.addAll(newFiles);
        });
      }
    } catch (e) {
      print('Error picking images: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error picking images: $e')),
      );
    }
  }

  Future<void> _pickCoordinatesOnMap() async {
    // Get current coordinates if available
    LatLng? initialLocation;
    final lat = double.tryParse(_latCtrl.text);
    final lon = double.tryParse(_lonCtrl.text);
    if (lat != null && lon != null) {
      initialLocation = LatLng(lat, lon);
    }

    // Navigate to coordinate picker
    final LatLng? result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CoordinatePickerPage(),
      ),
    );

    // Update fields if coordinates were picked
    if (result != null) {
      setState(() {
        _latCtrl.text = result.latitude.toStringAsFixed(6);
        _lonCtrl.text = result.longitude.toStringAsFixed(6);
      });
    }
  }

  Future<bool> _onWillPop() async {
    return await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text("Discard changes?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text("No")),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text("Yes")),
        ],
      ),
    ) ??
        false;
  }

  Future<void> _saveData() async {
    if (_titleImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Title image required")));
      return;
    }

    final appDir = await getApplicationDocumentsDirectory();
    final fileName = 'points.json';
    final file = File('${appDir.path}/$fileName');

    List<dynamic> currentList = [];
    if (await file.exists()) currentList = jsonDecode(await file.readAsString());
    int newId = currentList.isEmpty ? 1 : (currentList.last['id'] as int) + 1;

    // Copy title
    String newTitlePath = '${appDir.path}/img_${newId}_title${path.extension(_titleImage!.path)}';
    await _titleImage!.copy(newTitlePath);

    // Copy others
    List<String> newOtherPaths = [];
    for (int i = 0; i < _otherImages.length; i++) {
      String p = '${appDir.path}/img_${newId}_other_$i${path.extension(_otherImages[i].path)}';
      await _otherImages[i].copy(p);
      newOtherPaths.add(p);
    }

    // Create object
    InterestPoint point = InterestPoint(
      id: newId,
      name: _nameCtrl.text,
      shortDescription: _shortDescCtrl.text,
      titleImagePath: newTitlePath,
      otherImagePaths: newOtherPaths,
      lat: double.tryParse(_latCtrl.text),
      lon: double.tryParse(_lonCtrl.text),
      date: _dateCtrl.text,
      description: _descCtrl.text,
    );

    currentList.add(point.toJson());
    await file.writeAsString(jsonEncode(currentList));
    if (mounted) Navigator.pop(context);
  }

  Widget _buildField(TextEditingController ctrl, String label, {String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: TextFormField(
        controller: ctrl,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(15)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        appBar: AppBar(
          title: Text("New Point"),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(bottom: Radius.circular(20))),
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.all(20),
            children: [
              // Title image
              GestureDetector(
                onTap: _pickTitleImage,
                child: Container(
                  height: 180,
                  decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(20)),
                  child: _titleImage != null
                      ? ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.file(
                      _titleImage!,
                      fit: BoxFit.cover,
                      cacheWidth: 800,
                    ),
                  )
                      : Icon(Icons.add_a_photo, size: 50),
                ),
              ),
              const SizedBox(height: 20),

              // Fields
              _buildField(_nameCtrl, "Name"),
              _buildField(_shortDescCtrl, "Short Description"),
              Row(
                children: [
                  Expanded(child: _buildField(_latCtrl, "Lat", hint: "0.0000")),
                  const SizedBox(width: 10),
                  Expanded(child: _buildField(_lonCtrl, "Lon", hint: "0.0000")),
                  const SizedBox(width: 10),
                  // Pick on Map Button
                  Padding(
                    padding: const EdgeInsets.only(bottom: 15),
                    child: OutlinedButton.icon(
                      onPressed: _pickCoordinatesOnMap,
                      icon: Icon(Icons.map),
                      label: Text("Pick on Map"),
                      style: OutlinedButton.styleFrom(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                      ),
                    ),
                  ),
                ],
              ),


              _buildField(_dateCtrl, "Date", hint: "DD/MM/YYYY"),
              _buildField(_descCtrl, "Full Description"),

              const SizedBox(height: 20),
              Text("Other Images (Drag to reorder)", style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),

              SizedBox(
                height: 120,
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
                    return Padding(
                      key: ValueKey(entry.value.path),
                      padding: const EdgeInsets.only(right: 8.0),
                      child: ImageTile(
                        file: entry.value,
                        onRemove: () => setState(() => _otherImages.removeAt(entry.key)),
                      ),
                    );
                  }).toList(),
                ),
              ),

              TextButton.icon(onPressed: _pickOtherImages, icon: Icon(Icons.add_photo_alternate), label: Text("Add Images")),
              const SizedBox(height: 40),
              ElevatedButton(
                onPressed: _saveData,
                style: ElevatedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
                child: Text("Save Point"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// --- Image Tile with lazy loading ---
class ImageTile extends StatefulWidget {
  final File file;
  final VoidCallback onRemove;

  const ImageTile({required this.file, required this.onRemove, Key? key}) : super(key: key);

  @override
  State<ImageTile> createState() => _ImageTileState();
}

class _ImageTileState extends State<ImageTile> {
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    // Simulate loading delay - the Image.file widget will handle actual loading
    Future.delayed(Duration.zero, () {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Container(
            width: 100,
            height: 100,
            color: Colors.grey[300],
            child: _isLoading
                ? Center(child: Icon(Icons.image, color: Colors.grey[400], size: 40))
                : Image.file(
              widget.file,
              width: 100,
              height: 100,
              fit: BoxFit.cover,
              cacheWidth: 200,
              cacheHeight: 200,
              frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
                if (wasSynchronouslyLoaded) return child;
                return AnimatedOpacity(
                  opacity: frame == null ? 0 : 1,
                  duration: const Duration(milliseconds: 200),
                  child: frame == null
                      ? Center(child: Icon(Icons.image, color: Colors.grey[400], size: 40))
                      : child,
                );
              },
              errorBuilder: (ctx, _, __) => Icon(Icons.broken_image, color: Colors.red),
            ),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: widget.onRemove,
            child: Container(
              padding: EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.9),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Icon(Icons.close, color: Colors.black87, size: 18),
            ),
          ),
        ),
      ],
    );
  }
}