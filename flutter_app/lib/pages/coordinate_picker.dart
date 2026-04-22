import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart'; // Added colors import

LatLng initialLocation = const LatLng(-25.2744, 133.7751);  //center of australia

class CoordinatePickerPage extends StatefulWidget {
  const CoordinatePickerPage({super.key});

  @override
  State<CoordinatePickerPage> createState() => _CoordinatePickerPageState();
}

class _CoordinatePickerPageState extends State<CoordinatePickerPage> {
  LatLng? pickedLocation;
  final TextEditingController _searchController = TextEditingController();
  final MapController _mapController = MapController();
  List<dynamic> _searchResults = [];
  bool _isSearching = false;

  Future<void> _searchLocation(String query) async {
    if (query.isEmpty) {
      setState(() => _searchResults = []);
      return;
    }

    setState(() => _isSearching = true);

    try {
      final response = await http.get(
        Uri.parse('https://nominatim.openstreetmap.org/search?q=$query&format=json&limit=5'),
        headers: {'User-Agent': 'de.retriever_web.interestpoints'},
      );

      if (response.statusCode == 200) {
        setState(() {
          _searchResults = json.decode(response.body);
          _isSearching = false;
        });
      }
    } catch (e) {
      setState(() => _isSearching = false);
    }
  }

  void _selectSearchResult(dynamic result) {
    final lat = double.parse(result['lat']);
    final lon = double.parse(result['lon']);
    final location = LatLng(lat, lon);

    setState(() {
      pickedLocation = location;
      _searchResults = [];
      _searchController.clear();
    });

    _mapController.move(location, 15);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.coordinatePickerTitle),
        backgroundColor: accent, // Refactored
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: initialLocation,
              initialZoom: 2,
              onTap: (tapPosition, point) => setState(() => pickedLocation = point),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'de.retriever_web.interestpoints',
              ),
              if (pickedLocation != null)
                MarkerLayer(
                  markers: [
                    Marker(
                      point: pickedLocation!,
                      width: 40,
                      height: 40,
                      child: const Icon(Icons.location_on, color: Colors.red, size: 40),
                    ),
                  ],
                ),
            ],
          ),
          Positioned(
            top: 10,
            left: 10,
            right: 10,
            child: Column(
              children: [
                Material(
                  elevation: 4,
                  borderRadius: BorderRadius.circular(8),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: l10n.searchHint,
                      prefixIcon: const Icon(Icons.search, color: primary), // Refactored
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchResults = []);
                        },
                      )
                          : null,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    onChanged: _searchLocation,
                  ),
                ),
                if (_searchResults.isNotEmpty)
                  Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 200),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _searchResults.length,
                        itemBuilder: (context, index) {
                          final result = _searchResults[index];
                          return ListTile(
                            title: Text(result['display_name']),
                            onTap: () => _selectSearchResult(result),
                          );
                        },
                      ),
                    ),
                  ),
                if (_isSearching)
                  const Material(
                    elevation: 4,
                    child: LinearProgressIndicator(backgroundColor: pale, color: primary), // Refactored
                  ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        color: Colors.white,
        padding: const EdgeInsets.all(12.0),
        child: Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[300],
                  foregroundColor: dark, // Refactored
                ),
                child: Text(l10n.buttonCancel),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: pickedLocation == null ? null : () => Navigator.of(context).pop(pickedLocation),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary, // Refactored
                  foregroundColor: Colors.white,
                ),
                child: Text(l10n.buttonConfirm),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
