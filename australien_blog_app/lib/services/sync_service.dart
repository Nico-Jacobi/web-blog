import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../api_keys.dart';
import '../model/interest_point.dart';

class SyncService {

  // STATE TRACKING - Now stores server-verified info
  File? _syncStateFile;
  Map<String, int> _syncedFilesWithSize = {}; // path -> file size

  Future<void> _init() async {
    if (_syncStateFile != null) return;
    print('[SYNC] Initializing SyncService...');
    final appDir = await getApplicationDocumentsDirectory();
    _syncStateFile = File('${appDir.path}/sync_state.json');

    if (await _syncStateFile!.exists()) {
      final data = jsonDecode(await _syncStateFile!.readAsString());
      // Load size info if available
      final files = data['syncedFiles'] ?? {};
      if (files is Map) {
        _syncedFilesWithSize = Map<String, int>.from(files);
      } else if (files is List) {
        // Legacy format - just mark as synced with unknown size
        for (var file in files) {
          _syncedFilesWithSize[file.toString()] = -1;
        }
      }
      print('[SYNC] Loaded ${_syncedFilesWithSize.length} previously synced files');
    } else {
      print('[SYNC] No previous sync state found');
    }
  }

  Future<void> _markAsSynced(String filePath, int fileSize) async {
    _syncedFilesWithSize[filePath] = fileSize;
    await _saveSyncState();
    print('[SYNC] Marked as synced: $filePath ($fileSize bytes)');
  }

  Future<void> _saveSyncState() async {
    await _syncStateFile!.writeAsString(jsonEncode({
      'syncedFiles': _syncedFilesWithSize,
      'lastSync': DateTime.now().toIso8601String(),
    }));
  }

  Future<Set<String>> getSyncedFiles() async {
    await _init();
    return _syncedFilesWithSize.keys.toSet();
  }

  // --- SERVER VERIFICATION ---

  /// Verify a single file exists on server with correct size
  Future<bool> _verifyOnServer(String localPath) async {
    try {
      final file = File(localPath);
      if (!await file.exists()) return false;

      final localSize = await file.length();
      final filename = p.basename(localPath);
      final serverPath = 'images/$filename';

      final response = await http.post(
        Uri.parse('$baseUrl/verify'),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: jsonEncode({'path': serverPath}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['exists'] == true) {
          final serverSize = data['size'];
          final match = serverSize == localSize;
          print('[SYNC] Verify $filename: ${match ? "✓ MATCH" : "✗ SIZE MISMATCH"} (local: $localSize, server: $serverSize)');
          return match;
        }
      }
      print('[SYNC] Verify $filename: NOT ON SERVER');
      return false;
    } catch (e) {
      print('[SYNC] Verify error: $e');
      return false;
    }
  }

  /// Batch verify multiple files on server
  Future<Map<String, bool>> _batchVerifyOnServer(List<String> localPaths) async {
    try {
      final pathMap = <String, String>{}; // server path -> local path
      final serverPaths = <String>[];

      for (final localPath in localPaths) {
        final filename = p.basename(localPath);
        final serverPath = 'images/$filename';
        pathMap[serverPath] = localPath;
        serverPaths.add(serverPath);
      }

      print('[SYNC] Batch verifying ${serverPaths.length} files...');
      final response = await http.post(
        Uri.parse('$baseUrl/verify-batch'),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: jsonEncode({'paths': serverPaths}),
      );

      if (response.statusCode == 200) {
        final results = jsonDecode(response.body) as Map<String, dynamic>;
        final verifiedMap = <String, bool>{};

        for (final entry in results.entries) {
          final serverPath = entry.key;
          final localPath = pathMap[serverPath]!;
          final data = entry.value;

          if (data['exists'] == true) {
            final file = File(localPath);
            if (await file.exists()) {
              final localSize = await file.length();
              final serverSize = data['size'];
              verifiedMap[localPath] = (localSize == serverSize);
            } else {
              verifiedMap[localPath] = false;
            }
          } else {
            verifiedMap[localPath] = false;
          }
        }

        final verified = verifiedMap.values.where((v) => v).length;
        print('[SYNC] Batch verify complete: $verified/${verifiedMap.length} verified');
        return verifiedMap;
      }
    } catch (e) {
      print('[SYNC] Batch verify error: $e');
    }

    // Fallback: mark all as unverified
    return {for (var path in localPaths) path: false};
  }

  // --- MAIN SYNC FUNCTION ---
  Future<SyncResult> sync(List<InterestPoint> points, List<TripElement> trips) async {
    print('[SYNC] ========== Starting Sync ==========');
    print('[SYNC] Points: ${points.length}, Trips: ${trips.length}');

    await _init();
    int successCount = 0;
    int failCount = 0;
    int skippedCount = 0;

    // 1. Collect all images
    print('[SYNC] --- Phase 1: Image Sync ---');
    final allImages = <String>{};
    for (var point in points) {
      if (point.titleImagePath.isNotEmpty) allImages.add(point.titleImagePath);
      allImages.addAll(point.otherImagePaths);
    }
    print('[SYNC] Found ${allImages.length} total images in points');

    // 2. Batch verify what's actually on the server
    final verificationResults = await _batchVerifyOnServer(allImages.toList());

    // 3. Upload only what's needed
    final imagesToUpload = allImages.where((img) {
      final verified = verificationResults[img] ?? false;
      if (verified) {
        print('[SYNC] Skipping $img (verified on server)');
        return false;
      }
      return true;
    }).toList();

    print('[SYNC] Need to upload ${imagesToUpload.length} images');

    for (int i = 0; i < imagesToUpload.length; i++) {
      final imagePath = imagesToUpload[i];
      print('[SYNC] Uploading image ${i + 1}/${imagesToUpload.length}: ${p.basename(imagePath)}');

      final result = await _uploadFile(imagePath);
      if (result['success']) {
        await _markAsSynced(imagePath, result['size']);
        successCount++;
        print('[SYNC] ✓ Upload successful');
      } else {
        failCount++;
        print('[SYNC] ✗ Upload failed: ${result['error']}');
      }
    }

    skippedCount = allImages.length - imagesToUpload.length;

    // 4. Sync Data JSONs
    print('[SYNC] --- Phase 2: Data Sync ---');
    final pointsJson = points.map((e) => e.toJson()).toList();
    final tripsJson = trips.map((e) => e.toJson()).toList();

    final pointsContent = jsonEncode(pointsJson);
    final tripsContent = jsonEncode(tripsJson);

    final pointsNeedSync = await _shouldSyncJson('data/points.json', pointsContent);
    final tripsNeedSync = await _shouldSyncJson('data/trips.json', tripsContent);

    print('[SYNC] Points JSON needs sync: $pointsNeedSync');
    print('[SYNC] Trips JSON needs sync: $tripsNeedSync');

    if (pointsNeedSync) {
      print('[SYNC] Uploading points.json...');
      final result = await _writeJson('data/points.json', pointsJson);
      if (result['success']) {
        await _markAsSynced('data/points.json', result['size']);
        await _saveContentHash('data/points.json', pointsContent);
        successCount++;
        print('[SYNC] ✓ Points JSON synced');
      } else {
        failCount++;
        print('[SYNC] ✗ Points JSON failed: ${result['error']}');
      }
    } else {
      skippedCount++;
    }

    if (tripsNeedSync) {
      print('[SYNC] Uploading trips.json...');
      final result = await _writeJson('data/trips.json', tripsJson);
      if (result['success']) {
        await _markAsSynced('data/trips.json', result['size']);
        await _saveContentHash('data/trips.json', tripsContent);
        successCount++;
        print('[SYNC] ✓ Trips JSON synced');
      } else {
        failCount++;
        print('[SYNC] ✗ Trips JSON failed: ${result['error']}');
      }
    } else {
      skippedCount++;
    }

    print('[SYNC] ========== Sync Complete ==========');
    print('[SYNC] Success: $successCount, Failed: $failCount, Skipped: $skippedCount');

    return SyncResult(
      success: failCount == 0,
      message: 'Synced $successCount items. Errors: $failCount. Skipped: $skippedCount',
    );
  }

  // Helper to check if JSON needs syncing (content hash + server verification)
  Future<bool> _shouldSyncJson(String key, String newContent) async {
    // First check content hash
    final contentChanged = await _hasContentChanged(key, newContent);
    if (!contentChanged) {
      print('[SYNC] Content unchanged for $key, verifying on server...');
      // Even if content unchanged, verify it's actually on server
      final verified = await _verifyJsonOnServer(key, newContent);
      return !verified;
    }
    return true;
  }

  Future<bool> _verifyJsonOnServer(String serverPath, String expectedContent) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/verify'),
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: jsonEncode({'path': serverPath}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['exists'] == true) {
          final expectedSize = utf8.encode(expectedContent).length;
          final serverSize = data['size'];
          print('[SYNC] JSON verify $serverPath: server=$serverSize, expected=$expectedSize');
          return serverSize == expectedSize;
        }
      }
      return false;
    } catch (e) {
      print('[SYNC] JSON verify error: $e');
      return false;
    }
  }

  Future<bool> _hasContentChanged(String key, String newContent) async {
    await _init();
    final appDir = await getApplicationDocumentsDirectory();
    final hashFile = File('${appDir.path}/sync_hashes.json');

    if (!await hashFile.exists()) {
      print('[SYNC] No hash file exists, assuming content changed');
      return true;
    }

    try {
      final data = jsonDecode(await hashFile.readAsString());
      final savedHash = data[key];
      final newHash = newContent.hashCode.toString();
      final changed = savedHash != newHash;
      print('[SYNC] Content hash check for $key: ${changed ? "CHANGED" : "UNCHANGED"}');
      return changed;
    } catch (e) {
      print('[SYNC] Error reading hash file: $e');
      return true;
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
        print('[SYNC] Could not read existing hashes: $e');
      }
    }

    hashes[key] = content.hashCode.toString();
    await hashFile.writeAsString(jsonEncode(hashes));
    print('[SYNC] Saved content hash for $key');
  }

  // --- API CALLS ---

  Future<Map<String, dynamic>> _uploadFile(String localPath) async {
    final file = File(localPath);
    if (!await file.exists()) {
      print('[SYNC] File not found locally, skipping: $localPath');
      return {'success': true, 'size': 0}; // Missing file is not a failure
    }

    try {
      final filename = p.basename(localPath);
      final serverPath = 'images/$filename';
      final fileSize = await file.length();

      print('[SYNC] Uploading to server path: $serverPath (${fileSize} bytes)');
      var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
      request.headers['x-auth-token'] = authToken;
      request.fields['path'] = serverPath;
      request.files.add(await http.MultipartFile.fromPath('file', file.path));

      final response = await request.send();
      print('[SYNC] Upload response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        return {'success': true, 'size': fileSize};
      } else {
        final body = await response.stream.bytesToString();
        return {'success': false, 'error': 'HTTP ${response.statusCode}: $body'};
      }
    } catch (e) {
      print('[SYNC] Upload error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> _writeJson(String serverPath, dynamic content) async {
    try {
      print('[SYNC] Writing JSON to server: $serverPath');
      final jsonContent = jsonEncode(content);
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
      print('[SYNC] Write response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final size = utf8.encode(jsonContent).length;
        return {'success': true, 'size': size};
      } else {
        return {'success': false, 'error': 'HTTP ${response.statusCode}'};
      }
    } catch (e) {
      print('[SYNC] Write error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Downloads everything from server to initialize a fresh local app state.
  Future<bool> initializeFromServer() async {
    print('[SYNC] ========== Initializing from Server ==========');
    try {
      final appDir = await getApplicationDocumentsDirectory();

      // 1. Download Metadata
      print('[SYNC] Downloading points.json...');
      final pointsJson = await _downloadJson('data/points.json');
      print('[SYNC] Downloading trips.json...');
      final tripsJson = await _downloadJson('data/trips.json');

      if (pointsJson == null || tripsJson == null) {
        print('[SYNC] ✗ Failed to download metadata');
        return false;
      }
      print('[SYNC] ✓ Metadata downloaded successfully');

      // Save metadata locally
      final pointsFile = File('${appDir.path}/points.json');
      final pointsContent = jsonEncode(pointsJson);
      await pointsFile.writeAsString(pointsContent);
      print('[SYNC] Saved points.json locally');

      final tripsFile = File('${appDir.path}/trips.json');
      final tripsContent = jsonEncode(tripsJson);
      await tripsFile.writeAsString(tripsContent);
      print('[SYNC] Saved trips.json locally');

      await _markAsSynced('data/points.json', utf8.encode(pointsContent).length);
      await _markAsSynced('data/trips.json', utf8.encode(tripsContent).length);
      await _saveContentHash('data/points.json', pointsContent);
      await _saveContentHash('data/trips.json', tripsContent);

      // 2. Parse and download images
      print('[SYNC] --- Downloading Images ---');
      final List<dynamic> jsonList = pointsJson;
      final imagesToDownload = <String>{};
      for (var json in jsonList) {
        if (json['titleImagePath']?.isNotEmpty == true) imagesToDownload.add(json['titleImagePath']);
        if (json['otherImagePaths'] != null) {
          imagesToDownload.addAll(List<String>.from(json['otherImagePaths']));
        }
      }
      print('[SYNC] Found ${imagesToDownload.length} images to download');

      int downloadCount = 0;
      for (String serverRelativePath in imagesToDownload) {
        final fileName = p.basename(serverRelativePath);
        final localFile = File('${appDir.path}/$fileName');

        if (await localFile.exists()) {
          print('[SYNC] Image already exists locally: $fileName');
          continue;
        }

        print('[SYNC] Downloading ${++downloadCount}/${imagesToDownload.length}: $fileName');
        final size = await _downloadFile(serverRelativePath, localFile.path);
        if (size > 0) {
          await _markAsSynced(localFile.path, size);
          print('[SYNC] ✓ Downloaded successfully ($size bytes)');
        } else {
          print('[SYNC] ✗ Download failed');
        }
      }

      print('[SYNC] ========== Initialization Complete ==========');
      return true;
    } catch (e) {
      print('[SYNC] ✗ Initialization failed: $e');
      return false;
    }
  }

  // --- HELPER DOWNLOADERS ---

  Future<dynamic> _downloadJson(String serverPath) async {
    try {
      print('[SYNC] Fetching JSON from: $baseUrl/files/$serverPath');
      final response = await http.get(
        Uri.parse('$baseUrl/files/$serverPath'),
        headers: {'x-auth-token': authToken},
      );
      print('[SYNC] Response status: ${response.statusCode}');
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('[SYNC] Download JSON error: $e');
      return null;
    }
  }

  Future<int> _downloadFile(String serverPath, String localSavePath) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/files/$serverPath'),
        headers: {'x-auth-token': authToken},
      );

      if (response.statusCode == 200) {
        final file = File(localSavePath);
        await file.create(recursive: true);
        await file.writeAsBytes(response.bodyBytes);
        return response.bodyBytes.length;
      }
      print('[SYNC] Download failed with status: ${response.statusCode}');
      return 0;
    } catch (e) {
      print('[SYNC] Download file error: $e');
      return 0;
    }
  }
}

class SyncResult {
  final bool success;
  final String message;
  SyncResult({required this.success, required this.message});
}