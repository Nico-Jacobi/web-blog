import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';
import '../model/data_file.dart';
import '../model/interest_point.dart';
import '../model/media_file.dart';
import '../model/trip.dart';
import 'auth_service.dart';
import 'blog_paths.dart';
import 'storage_service.dart';

class SyncService {
  SyncService._internal();
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;

  final ValueNotifier<bool> syncProgress = ValueNotifier<bool>(false);
  final ValueNotifier<int> remoteChangesNotifier = ValueNotifier<int>(0);

  File? _syncStateFile;
  Map<String, int> _syncedFilesWithSize = {};

  bool _isSyncing = false;
  bool syncData = true;
  String? _initializedForBlogId;
  final StorageService _storageService = StorageService();

  Future<bool> _ensureLoggedIn() async {
    if (!AuthService().isLoggedIn) {
      print('[SYNC] ⚠️ Not logged in — sync skipped');
      return false;
    }
    return true;
  }

  Future<void> _init() async {
    final prefs = await SharedPreferences.getInstance();
    syncData = prefs.getBool('sync_data') ?? syncData;

    final activeId = AuthService().currentBlog?.id;
    if (_syncStateFile != null && _initializedForBlogId == activeId) return;

    if (activeId == null) {
      _syncStateFile = null;
      _syncedFilesWithSize = {};
      _initializedForBlogId = null;
      return;
    }

    print('[SYNC] Initializing SyncService for blog $activeId...');
    final dir = await BlogPaths.dir();
    _syncStateFile = File(p.join(dir.path, 'sync_state.json'));
    _syncedFilesWithSize = {};

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
    _initializedForBlogId = activeId;
  }

  Future<void> _markAsSynced(String filePath, int fileSize) async {
    final fileName = p.basename(filePath);
    _syncedFilesWithSize[fileName] = fileSize;
    await _saveSyncState();
  }

  Future<void> _saveSyncState() async {
    if (_syncStateFile == null) return;
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
    if (!await _ensureLoggedIn()) return null;
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
      syncProgress.value = true;
      _isSyncing = true;
      print('[SYNC] 🔒 Sync lock acquired');

      final points = await _storageService.loadPoints();
      final trips = await _storageService.loadTrips();

      return await sync(points, trips);
    } finally {
      _isSyncing = false;
      syncProgress.value = false;
      print('[SYNC] 🔓 Sync lock released');
    }
  }

  Map<String, String> _authHeaders(String token, {bool json = false}) {
    final h = <String, String>{'Authorization': 'Bearer $token'};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  Future<bool> _verifyOnServer(String localPath) async {
    try {
      final file = File(localPath);
      if (!await file.exists()) return false;

      final localSize = await file.length();
      final filename = p.basename(localPath);
      final serverPath = 'images/$filename';

      final response = await AuthService().authedRequest((token) => http.post(
            Uri.parse('$baseUrl/me/blog/verify'),
            headers: _authHeaders(token, json: true),
            body: jsonEncode({'path': serverPath}),
          ));

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
      final pathMap = <String, String>{};
      final serverPaths = <String>[];

      for (final localPath in localPaths) {
        final filename = p.basename(localPath);
        final serverPath = 'images/$filename';
        pathMap[serverPath] = localPath;
        serverPaths.add(serverPath);
      }

      print('[SYNC] Batch verifying ${serverPaths.length} files...');
      final response = await AuthService().authedRequest((token) => http.post(
            Uri.parse('$baseUrl/me/blog/verify-batch'),
            headers: _authHeaders(token, json: true),
            body: jsonEncode({'paths': serverPaths}),
          )).timeout(timeoutDuration);

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
    if (!await _ensureLoggedIn()) return false;
    await _init();

    if (!syncData) {
      print('[SYNC] ⚠️ Syncing disabled');
      return false;
    }
    if (isSyncing) return false;

    final points = await _storageService.loadPoints();
    final trips = await _storageService.loadTrips();

    final pointsJson = jsonEncode(points.map((e) => e.toJson()).toList());
    final tripsJson = jsonEncode(trips.map((e) => e.toJson()).toList());

    if (await _hasContentChanged('data/points.json', pointsJson)) return true;
    if (await _hasContentChanged('data/trips.json', tripsJson)) return true;

    for (var point in points) {
      if (point.titleImagePath.isNotEmpty &&
          !_syncedFilesWithSize.containsKey(point.titleImagePath)) {
        return true;
      }
      for (var name in point.otherMediaPaths) {
        if (!_syncedFilesWithSize.containsKey(name)) return true;
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
      await Future.delayed(const Duration(milliseconds: 100));
    }
    return results;
  }

  Future<SyncResult> sync(List<InterestPoint> points, List<TripElement> trips) async {
    if (!syncData) {
      return SyncResult(success: false, message: '[SYNC] ⚠️ Syncing disabled');
    }

    print('[SYNC] ========== Starting Sync ==========');
    print('[SYNC] Points: ${points.length}, Trips: ${trips.length}');

    await _init();
    int successCount = 0;
    int failCount = 0;
    int skippedCount = 0;

    print('[SYNC] --- Phase 1: Image Sync ---');
    final imageNames = <String>{};
    for (var point in points) {
      if (point.titleImagePath.isNotEmpty) imageNames.add(point.titleImagePath);
      imageNames.addAll(point.otherMediaPaths);
    }

    final blogDir = await BlogPaths.dir();
    final mediaFiles = imageNames
        .map((filename) => MediaFile.fromFilenameSync(filename, blogDir.path))
        .toList();

    final absolutePaths = mediaFiles.map((m) => m.file.path).toList();
    final verificationResults = await _batchVerifyOnServer(absolutePaths);

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

    for (int i = 0; i < mediaToUpload.length; i++) {
      final media = mediaToUpload[i];
      print('[SYNC] Uploading ${i + 1}/${mediaToUpload.length}: ${media.filename}');
      final result = await _uploadFile(media.filename);
      print(result['success'] ? '[SYNC] ✓ Upload request completed' : '[SYNC] ✗ Upload request failed');
    }

    final uploadAttemptPaths = mediaToUpload.map((m) => m.file.path).toList();
    print('[SYNC] Verifying ${uploadAttemptPaths.length} uploads...');
    final verifyResults = await _batchVerifyOnServer(uploadAttemptPaths);

    int verifiedCount = 0;
    for (final entry in verifyResults.entries) {
      if (entry.value) {
        verifiedCount++;
        final file = File(entry.key);
        if (await file.exists()) {
          await _markAsSynced(entry.key, await file.length());
        }
      }
    }

    successCount += verifiedCount;
    final currentBatchFailures = mediaToUpload.length - verifiedCount;
    failCount += currentBatchFailures;

    print('[SYNC] Verification: $verifiedCount/${mediaToUpload.length} confirmed on server');
    if (currentBatchFailures > 0) {
      print('[SYNC] ⚠️ $currentBatchFailures images failed to upload or verify');
    }

    print('[SYNC] --- Phase 2: Data Sync (merge) ---');
    final pointsJson = points.map((e) => e.toJson()).toList();
    final tripsJson = trips.map((e) => e.toJson()).toList();
    final pointsContent = jsonEncode(pointsJson);
    final tripsContent = jsonEncode(tripsJson);

    final pointsData = DataFile.points;
    final tripsData = DataFile.trips;

    bool remoteChanged = false;
    List<dynamic>? mergedPointsJson;

    final pointsResult = await _writeJson(pointsData.serverPath, pointsJson);
    if (pointsResult['success']) {
      final merged = pointsResult['merged'];
      if (merged is List) {
        mergedPointsJson = merged;
        final mergedContent = jsonEncode(merged);
        if (mergedContent != pointsContent) {
          print('[SYNC] Server returned merged points differing from local, applying...');
          await (await pointsData.file).writeAsString(mergedContent);
          remoteChanged = true;
        }
        await _saveContentHash('data/points.json', mergedContent);
        await _markAsSynced('data/points.json', utf8.encode(mergedContent).length);
      } else {
        await _saveContentHash('data/points.json', pointsContent);
        await _markAsSynced('data/points.json', pointsResult['size']);
      }
      successCount++;
      print('[SYNC] ✓ Points JSON synced (merge)');
    } else {
      failCount++;
      print('[SYNC] ✗ Points JSON failed: ${pointsResult['error']}');
    }

    final tripsResult = await _writeJson(tripsData.serverPath, tripsJson);
    if (tripsResult['success']) {
      final merged = tripsResult['merged'];
      if (merged is List) {
        final mergedContent = jsonEncode(merged);
        if (mergedContent != tripsContent) {
          print('[SYNC] Server returned merged trips differing from local, applying...');
          await (await tripsData.file).writeAsString(mergedContent);
          remoteChanged = true;
        }
        await _saveContentHash('data/trips.json', mergedContent);
        await _markAsSynced('data/trips.json', utf8.encode(mergedContent).length);
      } else {
        await _saveContentHash('data/trips.json', tripsContent);
        await _markAsSynced('data/trips.json', tripsResult['size']);
      }
      successCount++;
      print('[SYNC] ✓ Trips JSON synced (merge)');
    } else {
      failCount++;
      print('[SYNC] ✗ Trips JSON failed: ${tripsResult['error']}');
    }

    if (mergedPointsJson != null) {
      final downloaded = await _downloadMissingMedia(mergedPointsJson, blogDir);
      if (downloaded > 0) {
        print('[SYNC] ✓ Downloaded $downloaded new media files from server');
        remoteChanged = true;
      }
    }

    if (remoteChanged) {
      remoteChangesNotifier.value = remoteChangesNotifier.value + 1;
      print('[SYNC] 📥 Remote changes applied locally, notified listeners');
    }

    print('[SYNC] ========== Sync Complete ==========');
    print('[SYNC] Success: $successCount, Failed: $failCount, Skipped: $skippedCount');
    return SyncResult(
      success: failCount == 0,
      message: 'Synced $successCount items. Errors: $failCount. Skipped: $skippedCount',
    );
  }

  Future<int> _downloadMissingMedia(List<dynamic> mergedPoints, Directory blogDir) async {
    final referencedNames = <String>{};
    for (final json in mergedPoints) {
      if (json is! Map) continue;
      if (json['deletedAt'] != null) continue;
      final title = json['titleImagePath'];
      if (title is String && title.isNotEmpty) referencedNames.add(title);
      final others = json['otherImagePaths'];
      if (others is List) {
        for (final name in others) {
          if (name is String && name.isNotEmpty) referencedNames.add(name);
        }
      }
    }

    int downloaded = 0;
    for (final filename in referencedNames) {
      final media = MediaFile.fromFilenameSync(filename, blogDir.path);
      if (await media.exists()) continue;
      print('[SYNC] Post-merge: downloading missing media $filename');
      final size = await _downloadFile(media.serverPath, media.file.path);
      if (size > 0) {
        await _markAsSynced(media.file.path, size);
        downloaded++;
      }
    }
    return downloaded;
  }

  Future<bool> _hasContentChanged(String key, String newContent) async {
    await _init();
    final dir = await BlogPaths.dir();
    final hashFile = File(p.join(dir.path, 'sync_hashes.json'));

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
    final dir = await BlogPaths.dir();
    final hashFile = File(p.join(dir.path, 'sync_hashes.json'));

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
  }

  Future<Map<String, dynamic>> _uploadFile(String filename, {int retryCount = 0}) async {
    final dir = await BlogPaths.dir();
    final media = MediaFile.fromFilenameSync(filename, dir.path);

    if (!await media.exists()) {
      print('[SYNC] File not found locally, skipping: ${media.filename}');
      return {'success': true, 'size': 0};
    }

    const maxRetries = 3;
    const timeoutDuration = Duration(minutes: 3);

    try {
      final fileSize = await media.size();
      final serverPath = media.serverPath;
      print('[SYNC] Uploading to server path: $serverPath ($fileSize bytes)');

      final token = await AuthService().currentAccessTokenOrRefresh();
      final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/me/blog/upload'));
      request.headers.addAll({
        'Authorization': 'Bearer $token',
        'Connection': 'close',
      });
      request.fields['path'] = serverPath;
      request.files.add(await http.MultipartFile.fromPath('file', media.file.path));

      final streamedResponse = await request.send().timeout(timeoutDuration);
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        await Future.delayed(const Duration(milliseconds: 500));
        return {'success': true, 'size': fileSize};
      }
      if (response.statusCode == 401 && retryCount == 0) {
        await AuthService().refreshAccessToken();
        return _uploadFile(filename, retryCount: retryCount + 1);
      }
      throw Exception('HTTP ${response.statusCode}: ${response.body}');
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
      final response = await AuthService().authedRequest((token) => http.post(
            Uri.parse('$baseUrl/me/blog/write'),
            headers: _authHeaders(token, json: true),
            body: jsonEncode({'path': serverPath, 'content': content}),
          ));
      print('[SYNC] Write response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final size = utf8.encode(jsonContent).length;
        dynamic merged;
        try {
          final body = jsonDecode(response.body);
          if (body is Map && body['content'] is List) merged = body['content'];
        } catch (_) {}
        return {'success': true, 'size': size, 'merged': merged};
      }
      return {'success': false, 'error': 'HTTP ${response.statusCode}'};
    } catch (e) {
      print('[SYNC] Write error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  /// Downloads everything from server to initialize a fresh local app state.
  /// Called after first login or after switching accounts.
  Future<bool> initializeFromServer() async {
    if (!await _ensureLoggedIn()) return false;
    await _init();

    print('[SYNC] ========== Initializing from Server ==========');
    try {
      final blogDir = await BlogPaths.dir();
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

      final pointsFile = await pointsData.file;
      final pointsContent = jsonEncode(pointsJson);
      await pointsFile.writeAsString(pointsContent);

      final tripsFile = await tripsData.file;
      final tripsContent = jsonEncode(tripsJson);
      await tripsFile.writeAsString(tripsContent);

      await _markAsSynced(pointsData.serverPath, utf8.encode(pointsContent).length);
      await _markAsSynced(tripsData.serverPath, utf8.encode(tripsContent).length);
      await _saveContentHash(pointsData.serverPath, pointsContent);
      await _saveContentHash(tripsData.serverPath, tripsContent);

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
        final media = MediaFile.fromFilenameSync(filename, blogDir.path);
        if (await media.exists()) {
          await _markAsSynced(media.file.path, await media.size());
          continue;
        }
        print('[SYNC] Downloading ${++downloadCount}/${mediaFilenames.length}: $filename');
        final size = await _downloadFile(media.serverPath, media.file.path);
        if (size > 0) {
          await _markAsSynced(media.file.path, size);
        }
      }

      print('[SYNC] ========== Initialization Complete ==========');
      return true;
    } catch (e) {
      print('[SYNC] ✗ Initialization failed: $e');
      return false;
    }
  }

  Future<dynamic> _downloadJson(String serverPath) async {
    try {
      final blog = AuthService().currentBlog;
      if (blog == null) return null;
      final url = '$baseUrl/blogs/${blog.slug}/files/$serverPath';
      print('[SYNC] Fetching JSON from: $url');
      final response = await AuthService().authedRequest((token) => http.get(
            Uri.parse(url),
            headers: _authHeaders(token),
          ));
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('[SYNC] Download JSON error: $e');
      return null;
    }
  }

  Future<int> _downloadFile(String serverPath, String localSavePath) async {
    try {
      final blog = AuthService().currentBlog;
      if (blog == null) return 0;
      final url = '$baseUrl/blogs/${blog.slug}/files/$serverPath';
      final response = await AuthService().authedRequest((token) => http.get(
            Uri.parse(url),
            headers: _authHeaders(token),
          ));
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
      final result = await InternetAddress.lookup('google.com');
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
