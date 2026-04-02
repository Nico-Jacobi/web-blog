import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';
import '../model/data_file.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import 'storage_service.dart';

class SyncService {
  // singleton
  SyncService._internal();
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;

  final ValueNotifier<bool> syncProgress = ValueNotifier<bool>(false);


  File? _syncStateFile;
  Map<String, int> _syncedFilesWithSize = {}; // path -> file size

  // SYNC LOCK - Prevents concurrent syncs
  bool _isSyncing = false;
  bool syncData = true;
  final StorageService _storageService = StorageService();

  Future<void> _init() async {

    final prefs = await SharedPreferences.getInstance();
    syncData = prefs.getBool('sync_data') ?? syncData;


    if (_syncStateFile != null) return;
    print('[SYNC] Initializing SyncService...');
    final appDir = await getApplicationDocumentsDirectory();
    _syncStateFile = File('${appDir.path}/sync_state.json');

    if (await _syncStateFile!.exists()) {
      final data = jsonDecode(await _syncStateFile!.readAsString());
      final files = data['syncedFiles'] ?? {};
      if (files is Map) {
        _syncedFilesWithSize = Map<String, int>.from(files);
      } else if (files is List) {
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
    final fileName = p.basename(filePath); // Store only 'img_123.jpg'
    _syncedFilesWithSize[fileName] = fileSize;
    await _saveSyncState();
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

  bool get isSyncing => _isSyncing;

  Future<bool> isSyncEnabled() async {
    await _init();
    return syncData;
  }

  Future<SyncResult?> syncFromStorage() async {
    await _init();

    if (!syncData) {
      print('[SYNC] ⚠️ Syncing disabled');
      return null;
    }

    if (_isSyncing) {
      print('[SYNC] ⚠️ Sync already in progress, ignoring request');
      return null;
    }

    if (!await _hasInternet()) {
      print('[SYNC] 📶 No internet connection, skipping sync');
      return SyncResult(success: false, message: 'No internet connection');
    }

    try {
      syncProgress.value = true; // Notifies listeners
      _isSyncing = true;
      print('[SYNC] 🔒 Sync lock acquired');

      final points = await _storageService.loadPoints();
      final trips = await _storageService.loadTrips();

      final result = await sync(points, trips);
      return result;
    } finally {
      _isSyncing = false;
      syncProgress.value = false; // Notifies listeners
      print('[SYNC] 🔓 Sync lock released');
    }
  }

  // --- SERVER VERIFICATION ---

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

  Future<Map<String, bool>> _batchVerifyOnServer(List<String> localPaths) async {
    const timeoutDuration = Duration(seconds: 30);

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
      ).timeout(timeoutDuration);

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
    } on TimeoutException {
      print('[SYNC] Batch verify timeout - falling back to individual checks');
    } catch (e) {
      print('[SYNC] Batch verify error: $e');
    }

    return await _fallbackIndividualVerify(localPaths);
  }

  Future<bool> hasUnsyncedChanges() async {
    await _init();

    if (!syncData) {
      print('[SYNC] ⚠️ Syncing disabled');
      return false;
    }

    if (isSyncing){
      return false;
    }

    final points = await _storageService.loadPoints();
    final trips = await _storageService.loadTrips();

    // 1. Check if JSON data has changed via hash
    final pointsJson = jsonEncode(points.map((e) => e.toJson()).toList());
    final tripsJson = jsonEncode(trips.map((e) => e.toJson()).toList());

    if (await _hasContentChanged('data/points.json', pointsJson)) return true;
    if (await _hasContentChanged('data/trips.json', tripsJson)) return true;

    // 2. Check if any image path is missing from the sync state
    //final appDir = await getApplicationDocumentsDirectory();

    for (var point in points) {
      // Construct the full path because that's what File() needs and
      // likely what _syncedFilesWithSize is currently using as a key.
      final fullTitlePath = p.join(point.titleImagePath);

      if (point.titleImagePath.isNotEmpty && !_syncedFilesWithSize.containsKey(fullTitlePath)) {
        return true;
      }

      for (var name in point.otherMediaPaths) {
        final fullOtherPath = p.join(name);
        if (!_syncedFilesWithSize.containsKey(fullOtherPath)) return true;
      }
    }

    return false;
  }

  Future<Map<String, bool>> _fallbackIndividualVerify(List<String> localPaths) async {
    print('[SYNC] Using individual verification for ${localPaths.length} files');
    final results = <String, bool>{};

    for (final localPath in localPaths) {
      try {
        final verified = await _verifyOnServer(localPath);
        results[localPath] = verified;
      } catch (e) {
        print('[SYNC] Individual verify failed for $localPath: $e');
        results[localPath] = false;
      }

      await Future.delayed(Duration(milliseconds: 100));
    }

    return results;
  }

  // --- MAIN SYNC FUNCTION ---
  Future<SyncResult> sync(List<InterestPoint> points, List<TripElement> trips) async {

    if (!syncData) {
      return SyncResult(
        success: false,
        message: '[SYNC] ⚠️ Syncing disabled',
      );
    }

    print('[SYNC] ========== Starting Sync ==========');
    print('[SYNC] Points: ${points.length}, Trips: ${trips.length}');

    await _init();
    int successCount = 0;
    int failCount = 0;
    int skippedCount = 0;

    // 1. Collect all images
    print('[SYNC] --- Phase 1: Image Sync ---');
    // Collect all images (these are names from JSON)
// 1. Collect all image NAMES from JSON (around line 150)
    final imageNames = <String>{};
    for (var point in points) {
      if (point.titleImagePath.isNotEmpty) imageNames.add(point.titleImagePath);
      imageNames.addAll(point.otherMediaPaths);
    }

// Create MediaFile objects to get server paths
    final appDir = await getApplicationDocumentsDirectory();
    final mediaFiles = imageNames.map((filename) =>
        MediaFile.fromFilenameSync(filename, appDir.path)
    ).toList();

// Get absolute paths for verification
    final absolutePaths = mediaFiles.map((m) => m.file.path).toList();

// 2. Batch verify
    final verificationResults = await _batchVerifyOnServer(absolutePaths);

// 3. Filter to get media that needs uploading
    final mediaToUpload = mediaFiles.where((media) {
      final verified = verificationResults[media.file.path] ?? false;
      if (verified) {
        print('[SYNC] Skipping ${media.filename} (verified on server)');
        return false;
      }
      return true;
    }).toList();

    print('[SYNC] Need to upload ${mediaToUpload.length} media files');
    skippedCount = mediaFiles.length - mediaToUpload.length;

// 4. Upload using MediaFile
    for (int i = 0; i < mediaToUpload.length; i++) {
      final media = mediaToUpload[i];
      print('[SYNC] Uploading ${i + 1}/${mediaToUpload.length}: ${media.filename}');

      final result = await _uploadFile(media.filename);
      if (result['success']) {
        print('[SYNC] ✓ Upload request completed');
      } else {
        print('[SYNC] ✗ Upload request failed');
      }
    }

// 5. Verify everything and count actual successes
    final uploadAttemptPaths = mediaToUpload.map((m) => m.file.path).toList();
    print('[SYNC] Verifying ${uploadAttemptPaths.length} uploads...');

    final verifyResults = await _batchVerifyOnServer(uploadAttemptPaths);

    int verifiedCount = 0;
    for (final entry in verifyResults.entries) {
      if (entry.value) { // entry.key is the absolute path, value is boolean
        verifiedCount++;
        final file = File(entry.key);
        if (await file.exists()) {
          final size = await file.length();
          await _markAsSynced(entry.key, size);
        }
      }
    }

    successCount += verifiedCount;
    int currentBatchFailures = mediaToUpload.length - verifiedCount;
    failCount += currentBatchFailures;

    print('[SYNC] Verification: $verifiedCount/${mediaToUpload.length} confirmed on server');
    if (currentBatchFailures > 0) {
      print('[SYNC] ⚠️ $currentBatchFailures images failed to upload or verify');
    }

    // 6. Sync Data JSONs
    print('[SYNC] --- Phase 2: Data Sync ---');
    final pointsJson = points.map((e) => e.toJson()).toList();
    final tripsJson = trips.map((e) => e.toJson()).toList();

    final pointsContent = jsonEncode(pointsJson);
    final tripsContent = jsonEncode(tripsJson);

    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    final pointsNeedSync = await _shouldSyncJson(pointsData.serverPath, pointsContent);
    final tripsNeedSync = await _shouldSyncJson(tripsData.serverPath, tripsContent);


    print('[SYNC] Points JSON needs sync: $pointsNeedSync');
    print('[SYNC] Trips JSON needs sync: $tripsNeedSync');

    if (pointsNeedSync) {
      print('[SYNC] Uploading points.json...');
      final result = await _writeJson(pointsData.serverPath, pointsJson);
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
      final result = await _writeJson(tripsData.serverPath, tripsJson);
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

  Future<bool> _shouldSyncJson(String key, String newContent) async {
    final contentChanged = await _hasContentChanged(key, newContent);
    if (!contentChanged) {
      print('[SYNC] Content unchanged for $key, verifying on server...');
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

  Future<Map<String, dynamic>> _uploadFile(String filename, {int retryCount = 0}) async {
    final appDir = await getApplicationDocumentsDirectory();
    final media = MediaFile.fromFilenameSync(filename, appDir.path);

    if (!await media.exists()) {
      print('[SYNC] File not found locally, skipping: ${media.filename}');
      return {'success': true, 'size': 0};
    }

    const maxRetries = 3;
    const timeoutDuration = Duration(minutes: 3);

    try {
      final fileSize = await media.size();
      final serverPath = media.serverPath;  // Uses "images/filename"

      print('[SYNC] Uploading to server path: $serverPath ($fileSize bytes)');

      var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
      request.headers.addAll({
        'x-auth-token': authToken,
        'Connection': 'close',
      });

      request.fields['path'] = serverPath;
      request.files.add(await http.MultipartFile.fromPath('file', media.file.path));

      final streamedResponse = await request.send().timeout(timeoutDuration);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        await Future.delayed(const Duration(milliseconds: 500));
        return {'success': true, 'size': fileSize};
      } else {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      print('[SYNC] Upload error (attempt ${retryCount + 1}/$maxRetries): $e');

      if (retryCount < maxRetries - 1) {
        await Future.delayed(Duration(seconds: (retryCount + 1) * 2));
        return _uploadFile(filename, retryCount: retryCount + 1);
      }
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

      // 1. Download Metadata using DataFile
      final pointsData = DataFile.points;
      final tripsData = DataFile.trips;

      print('[SYNC] Downloading points.json...');
      final pointsJson = await _downloadJson(pointsData.serverPath);
      print('[SYNC] Downloading trips.json...');
      final tripsJson = await _downloadJson(tripsData.serverPath);

      if (pointsJson == null || tripsJson == null) {
        print('[SYNC] ✗ Failed to download metadata');
        return false;
      }
      print('[SYNC] ✓ Metadata downloaded successfully');

      // Save metadata locally
      final pointsFile = await pointsData.file;
      final pointsContent = jsonEncode(pointsJson);
      await pointsFile.writeAsString(pointsContent);
      print('[SYNC] Saved points.json locally');

      final tripsFile = await tripsData.file;
      final tripsContent = jsonEncode(tripsJson);
      await tripsFile.writeAsString(tripsContent);
      print('[SYNC] Saved trips.json locally');

      await _markAsSynced(pointsData.serverPath, utf8.encode(pointsContent).length);
      await _markAsSynced(tripsData.serverPath, utf8.encode(tripsContent).length);
      await _saveContentHash(pointsData.serverPath, pointsContent);
      await _saveContentHash(tripsData.serverPath, tripsContent);

      // 2. Parse and download images using MediaFile
      print('[SYNC] --- Downloading Images ---');
      final List<dynamic> jsonList = pointsJson;
      final mediaFilenames = <String>{};

      for (var json in jsonList) {
        if (json['titleImagePath']?.isNotEmpty == true) {
          mediaFilenames.add(json['titleImagePath']);
        }
        if (json['otherImagePaths'] != null) {
          mediaFilenames.addAll(List<String>.from(json['otherImagePaths']));
        }
      }
      print('[SYNC] Found ${mediaFilenames.length} media files to download');

      int downloadCount = 0;
      for (String filename in mediaFilenames) {
        final media = MediaFile.fromFilenameSync(filename, appDir.path);

        if (await media.exists()) {
          print('[SYNC] Media already exists locally: $filename');
          await _markAsSynced(media.file.path, await media.size());
          continue;
        }

        print('[SYNC] Downloading ${++downloadCount}/${mediaFilenames.length}: $filename');
        final size = await _downloadFile(media.serverPath, media.file.path);
        if (size > 0) {
          await _markAsSynced(media.file.path, size);
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

  Future<bool> _hasInternet() async {
    try {
      final result = await InternetAddress.lookup('google.com'); // or your baseUrl
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } on SocketException catch (_) {
      return false;
    }
  }
}

class SyncResult {
  final bool success;
  final String message;
  SyncResult({required this.success, required this.message});
}