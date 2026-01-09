import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../api_keys.dart';
import '../model/interest_point.dart';

class SyncService {

  // STATE TRACKING
  File? _syncStateFile;
  Set<String> _syncedFiles = {};

  Future<void> _init() async {
    if (_syncStateFile != null) return;
    final appDir = await getApplicationDocumentsDirectory();
    _syncStateFile = File('${appDir.path}/sync_state.json');

    if (await _syncStateFile!.exists()) {
      final data = jsonDecode(await _syncStateFile!.readAsString());
      _syncedFiles = Set<String>.from(data['syncedFiles'] ?? []);
    }
  }

  Future<void> _markAsSynced(String filePath) async {
    _syncedFiles.add(filePath);
    await _syncStateFile!.writeAsString(jsonEncode({
      'syncedFiles': _syncedFiles.toList(),
      'lastSync': DateTime.now().toIso8601String(),
    }));
  }

  // Expose synced files for UI
  Future<Set<String>> getSyncedFiles() async {
    await _init();
    return Set.from(_syncedFiles);
  }

  // --- MAIN SYNC FUNCTION ---
  Future<SyncResult> sync(List<InterestPoint> points, List<TripElement> trips) async {
    await _init();
    int successCount = 0;
    int failCount = 0;

    // 1. Sync Images (Granular & Resumable)
    // We collect all current image paths to ensure we don't miss any
    final allImages = <String>{};
    for (var point in points) {
      if (point.titleImagePath.isNotEmpty) allImages.add(point.titleImagePath);
      allImages.addAll(point.otherImagePaths);
    }

    for (final imagePath in allImages) {
      // Skip if already marked as synced
      if (_syncedFiles.contains(imagePath)) continue;

      final success = await _uploadFile(imagePath);
      if (success) {
        await _markAsSynced(imagePath); // Save progress immediately
        successCount++;
      } else {
        failCount++;
        // If connection is totally dead, we might want to abort early
        // return SyncResult(success: false, message: "Connection lost");
      }
    }

    // 2. Sync Data JSONs
    // Track content hash to detect changes
    final pointsJson = points.map((e) => e.toJson()).toList();
    final tripsJson = trips.map((e) => e.toJson()).toList();

    final pointsContent = jsonEncode(pointsJson);
    final tripsContent = jsonEncode(tripsJson);

    // Check if content has changed since last sync
    final pointsNeedSync = !_syncedFiles.contains('data/points.json') ||
        await _hasContentChanged('data/points.json', pointsContent);
    final tripsNeedSync = !_syncedFiles.contains('data/trips.json') ||
        await _hasContentChanged('data/trips.json', tripsContent);

    if (pointsNeedSync) {
      final success = await _writeJson('data/points.json', pointsJson);
      if (success) {
        await _markAsSynced('data/points.json');
        await _saveContentHash('data/points.json', pointsContent);
        successCount++;
      } else {
        failCount++;
      }
    }

    if (tripsNeedSync) {
      final success = await _writeJson('data/trips.json', tripsJson);
      if (success) {
        await _markAsSynced('data/trips.json');
        await _saveContentHash('data/trips.json', tripsContent);
        successCount++;
      } else {
        failCount++;
      }
    }

    return SyncResult(
      success: failCount == 0,
      message: 'Synced $successCount items. Errors: $failCount',
    );
  }

  // Helper to detect content changes
  Future<bool> _hasContentChanged(String key, String newContent) async {
    await _init();
    final appDir = await getApplicationDocumentsDirectory();
    final hashFile = File('${appDir.path}/sync_hashes.json');

    if (!await hashFile.exists()) return true;

    try {
      final data = jsonDecode(await hashFile.readAsString());
      final savedHash = data[key];
      final newHash = newContent.hashCode.toString();
      return savedHash != newHash;
    } catch (e) {
      return true; // If error, assume changed
    }
  }

  Future<void> _saveContentHash(String key, String content) async {
    final appDir = await getApplicationDocumentsDirectory();
    final hashFile = File('${appDir.path}/sync_hashes.json');

    Map<String, dynamic> hashes = {};
    if (await hashFile.exists()) {
      try {
        hashes = jsonDecode(await hashFile.readAsString());
      } catch (e) {
        // Ignore, start fresh
      }
    }

    hashes[key] = content.hashCode.toString();
    await hashFile.writeAsString(jsonEncode(hashes));
  }

  // --- API CALLS ---

  Future<bool> _uploadFile(String localPath) async {
    final file = File(localPath);
    if (!await file.exists()) return true; // File missing locally, skip safely

    try {
      final filename = p.basename(localPath);
      final serverPath = 'images/$filename'; // Stored in /images folder on server

      var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
      request.headers['x-auth-token'] = authToken;

      // Server expects 'path' in body for destination
      request.fields['path'] = serverPath;
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final response = await request.send();
      return response.statusCode == 200;
    } catch (e) {
      print('Upload error: $e');
      return false;
    }
  }

  Future<bool> _writeJson(String serverPath, dynamic content) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/write'),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: jsonEncode({
          'path': serverPath,
          'content': content,
        }),
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Write error: $e');
      return false;
    }
  }

  /// Downloads everything from server to initialize a fresh local app state.
  Future<bool> initializeFromServer() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();

      // 1. Download Metadata (Points & Trips)
      final pointsJson = await _downloadJson('data/points.json');
      final tripsJson = await _downloadJson('data/trips.json');

      if (pointsJson == null || tripsJson == null) return false;

      // Save metadata locally using your StorageService logic
      final pointsFile = File('${appDir.path}/points.json');
      await pointsFile.writeAsString(jsonEncode(pointsJson));

      final tripsFile = File('${appDir.path}/trips.json');
      await tripsFile.writeAsString(jsonEncode(tripsJson));

      // Mark metadata as synced and save content hashes
      await _markAsSynced('data/points.json');
      await _markAsSynced('data/trips.json');
      await _saveContentHash('data/points.json', jsonEncode(pointsJson));
      await _saveContentHash('data/trips.json', jsonEncode(tripsJson));

      // 2. Parse points to find required images
      final List<dynamic> jsonList = pointsJson;
      final imagesToDownload = <String>{};
      for (var json in jsonList) {
        if (json['titleImagePath']?.isNotEmpty == true) imagesToDownload.add(json['titleImagePath']);
        if (json['otherImagePaths'] != null) {
          imagesToDownload.addAll(List<String>.from(json['otherImagePaths']));
        }
      }

      // 3. Download each image
      for (String serverRelativePath in imagesToDownload) {
        // serverRelativePath is likely "images/filename.jpg"
        final fileName = p.basename(serverRelativePath);
        final localFile = File('${appDir.path}/$fileName');

        if (await localFile.exists()) continue; // Skip if already have it

        final success = await _downloadFile(serverRelativePath, localFile.path);
        if (success) {
          await _markAsSynced(localFile.path); // Mark as synced so we don't upload it back
        }
      }

      return true;
    } catch (e) {
      print('Initialization failed: $e');
      return false;
    }
  }

  // --- HELPER DOWNLOADERS ---

  Future<dynamic> _downloadJson(String serverPath) async {
    final response = await http.get(
      Uri.parse('$baseUrl/files/$serverPath'),
      headers: {'x-auth-token': authToken}, // Server uses checkAuth on /files
    );
    if (response.statusCode == 200) return jsonDecode(response.body);
    return null;
  }

  Future<bool> _downloadFile(String serverPath, String localSavePath) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/files/$serverPath'),
        headers: {'x-auth-token': authToken},
      );

      if (response.statusCode == 200) {
        final file = File(localSavePath);
        await file.create(recursive: true);
        await file.writeAsBytes(response.bodyBytes);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}

class SyncResult {
  final bool success;
  final String message;
  SyncResult({required this.success, required this.message});
}