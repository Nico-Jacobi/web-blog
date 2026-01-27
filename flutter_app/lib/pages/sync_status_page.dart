import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../services/storage_service.dart';
import '../services/sync_service.dart';
import '../strings.dart';
import '../model/file_status.dart';
import '../colors.dart';

class SyncStatusPage extends StatefulWidget {
  const SyncStatusPage({Key? key}) : super(key: key);

  @override
  State<SyncStatusPage> createState() => _SyncStatusPageState();
}

class _SyncStatusPageState extends State<SyncStatusPage> {
  final SyncService _syncService = SyncService();
  final StorageService _storageService = StorageService();

  bool _isLoading = false;
  bool _isSyncing = false;
  String _statusMessage = '';

  List<FileStatus> _fileStatuses = [];
  Set<String> _syncedFiles = {};

  @override
  void initState() {
    super.initState();
    _loadSyncStatus();
  }

  Future<void> _loadSyncStatus() async {
    setState(() => _isLoading = true);

    try {
      // Load synced files state
      _syncedFiles = await _syncService.getSyncedFiles();

      // Load points and trips
      final points = await _storageService.loadPoints();
      final trips = await _storageService.loadTrips();

      // Collect all files
      final fileStatuses = <FileStatus>[];

      final appDir = await getApplicationDocumentsDirectory();

      final pointsFile = File('${appDir.path}/points.json');
      final pointsExists = await pointsFile.exists();
      final pointsSize = pointsExists ? await pointsFile.length() : 0;

      fileStatuses.add(FileStatus(
        path: 'data/points.json',
        type: FileType.metadata,
        isSynced: true,
        size: pointsSize,
        exists: pointsExists,
      ));

      final tripsFile = File('${appDir.path}/trips.json');
      final tripsExists = await tripsFile.exists();
      final tripsSize = tripsExists ? await tripsFile.length() : 0;

      fileStatuses.add(FileStatus(
        path: 'data/trips.json',
        type: FileType.metadata,
        isSynced: true,
        size: tripsSize,
        exists: tripsExists,
      ));

      // Add image files
      final allImages = <String>{};
      for (var point in points) {
        if (point.titleImagePath.isNotEmpty) {
          allImages.add(point.titleImagePath);
        }
        allImages.addAll(point.otherMediaPaths);
      }

      for (final imageName in allImages) {
        final fullPath = '${appDir.path}/$imageName';
        final file = File(fullPath);

        final exists = await file.exists();
        final size = exists ? await file.length() : 0;

        fileStatuses.add(FileStatus(
          path: fullPath,
          type: FileType.image,
          isSynced: _syncedFiles.contains(imageName),
          size: size,
          exists: exists,
        ));
      }

      setState(() {
        _fileStatuses = fileStatuses;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _statusMessage = '${AppStrings.sync_status_error_loading}$e';
        _isLoading = false;
      });
    }
  }

  Future<void> _performSync() async {
    setState(() {
      _isSyncing = true;
      _statusMessage = AppStrings.sync_spinner_text;
    });

    try {
      final result = await _syncService.syncFromStorage();

      if (result == null) {
        setState(() {
          _statusMessage = AppStrings.sync_status_in_progress;
          _isSyncing = false;
        });
        _showSuccessSnackBar(AppStrings.sync_status_in_progress);
        return;
      }

      setState(() {
        _statusMessage = result.message;
        _isSyncing = false;
      });

      await _loadSyncStatus();

      if (result.success) {
        _showSuccessSnackBar(AppStrings.sync_status_success);
      }
    } catch (e) {
      setState(() {
        _statusMessage = '${AppStrings.sync_status_failed}$e';
        _isSyncing = false;
      });
    }
  }

  Future<void> _performReverseSync() async {
    final confirmed = await _showReverseSyncDialog();
    if (!confirmed) return;

    _storageService.resetApp();

    setState(() {
      _isSyncing = true;
      _statusMessage = AppStrings.sync_downloading;
    });

    try {
      final success = await _syncService.initializeFromServer();

      setState(() {
        _statusMessage = success
            ? AppStrings.sync_download_success
            : AppStrings.sync_download_failed;
        _isSyncing = false;
      });

      if (success) {
        await _loadSyncStatus();
        _showSuccessSnackBar(AppStrings.sync_data_replaced);
      }
    } catch (e) {
      setState(() {
        _statusMessage = '${AppStrings.sync_reverse_failed}$e';
        _isSyncing = false;
      });
    }
  }

  Future<bool> _showReverseSyncDialog() async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [dark, primary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.cloud_download,
                  color: Colors.white,
                  size: 48,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                AppStrings.sync_dialog_title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                AppStrings.sync_dialog_content,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.95),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),
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
                        AppStrings.button_cancel,
                        style: TextStyle(color: Colors.white, fontSize: 16),
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
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        AppStrings.sync_dialog_confirm,
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

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final unsyncedCount = _fileStatuses.where((f) => !f.isSynced && f.type == FileType.image).length;
    final totalImages = _fileStatuses.where((f) => f.type == FileType.image).length;
    final syncedCount = totalImages - unsyncedCount;

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text(AppStrings.sync_status_title),
        systemOverlayStyle: const SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        centerTitle: true,
        backgroundColor: accent,
        foregroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
        ),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: primary))
          : Column(
        children: [
          // Status Header
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildStatCard(AppStrings.sync_stat_synced, '$syncedCount', Colors.green),
                    _buildStatCard(AppStrings.sync_stat_unsynced, '$unsyncedCount', Colors.orange),
                    _buildStatCard(AppStrings.sync_stat_total, '$totalImages', primary),
                  ],
                ),
                if (_statusMessage.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: pale.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _statusMessage,
                      style: TextStyle(
                        color: Colors.grey[800],
                        fontSize: 13,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Action Buttons
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isSyncing ? null : _performSync,
                    icon: _isSyncing
                        ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                        : const Icon(Icons.cloud_upload),
                    label: Text(_isSyncing ? AppStrings.sync_spinner_text : AppStrings.button_sync_upload),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isSyncing ? null : _performReverseSync,
                    icon: const Icon(Icons.cloud_download),
                    label: const Text(AppStrings.button_sync_download),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red, width: 2),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // File List
          Expanded(
            child: _fileStatuses.isEmpty
                ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.folder_open, size: 64, color: Colors.grey[400]),
                  const SizedBox(height: 16),
                  Text(
                    AppStrings.sync_no_files,
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ),
            )
                : Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: _fileStatuses.length,
                separatorBuilder: (context, index) => Divider(
                  height: 1,
                  indent: 72,
                  color: Colors.grey[200],
                ),
                itemBuilder: (context, index) {
                  final fileStatus = _fileStatuses[index];
                  return _buildFileListItem(fileStatus);
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.grey[700],
          ),
        ),
      ],
    );
  }

  Widget _buildFileListItem(FileStatus fileStatus) {
    final fileName = fileStatus.path.split('/').last;
    final isMetadata = fileStatus.type == FileType.metadata;

    IconData icon;
    Color iconColor;

    if (isMetadata) {
      icon = Icons.description;
      iconColor = primary;
    } else if (!fileStatus.exists) {
      icon = Icons.error_outline;
      iconColor = Colors.red;
    } else if (fileStatus.isSynced) {
      icon = Icons.check_circle;
      iconColor = Colors.green;
    } else {
      icon = Icons.cloud_upload;
      iconColor = Colors.orange;
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(
        fileName,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          !fileStatus.exists
              ? AppStrings.sync_file_not_found
              : isMetadata
              ? '${_formatFileSize(fileStatus.size)} • ${AppStrings.sync_file_metadata}'
              : '${_formatFileSize(fileStatus.size)} • ${fileStatus.isSynced ? AppStrings.sync_file_synced : AppStrings.sync_file_not_synced}',
          style: TextStyle(
            fontSize: 12,
            color: fileStatus.exists ? Colors.grey[600] : Colors.red,
          ),
        ),
      ),
      trailing: isMetadata
          ? Icon(Icons.sync, size: 18, color: primary)
          : fileStatus.isSynced
          ? null
          : Icon(Icons.upload_outlined, size: 18, color: Colors.grey[400]),
    );
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}