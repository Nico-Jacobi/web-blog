import 'package:flutter/material.dart';
import 'dart:io';
import '../model/interest_point.dart';
import '../services/storage_service.dart';
import '../services/sync_service.dart';

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

      // Add metadata files
      fileStatuses.add(FileStatus(
        path: 'data/points.json',
        type: FileType.metadata,
        isSynced: true, // Always consider metadata as needing sync
        size: 0,
      ));

      fileStatuses.add(FileStatus(
        path: 'data/trips.json',
        type: FileType.metadata,
        isSynced: true,
        size: 0,
      ));

      // Add image files
      final allImages = <String>{};
      for (var point in points) {
        if (point.titleImagePath.isNotEmpty) {
          allImages.add(point.titleImagePath);
        }
        allImages.addAll(point.otherImagePaths);
      }

      for (final imagePath in allImages) {
        final file = File(imagePath);
        final exists = await file.exists();
        final size = exists ? await file.length() : 0;

        fileStatuses.add(FileStatus(
          path: imagePath,
          type: FileType.image,
          isSynced: _syncedFiles.contains(imagePath),
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
        _statusMessage = 'Error loading sync status: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _performSync() async {
    setState(() {
      _isSyncing = true;
      _statusMessage = 'Syncing...';
    });

    try {
      // Use the new syncFromStorage method
      final result = await _syncService.syncFromStorage();

      if (result == null) {
        // Sync was already in progress
        setState(() {
          _statusMessage = 'Sync already in progress';
          _isSyncing = false;
        });
        _showSuccessSnackBar('Sync already in progress');
        return;
      }

      setState(() {
        _statusMessage = result.message;
        _isSyncing = false;
      });

      // Reload status to update UI
      await _loadSyncStatus();

      if (result.success) {
        _showSuccessSnackBar('Sync completed successfully!');
      }
    } catch (e) {
      setState(() {
        _statusMessage = 'Sync failed: $e';
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
      _statusMessage = 'Downloading from server...';
    });

    try {
      final success = await _syncService.initializeFromServer();

      setState(() {
        _statusMessage = success
            ? 'Successfully downloaded from server'
            : 'Failed to download from server';
        _isSyncing = false;
      });

      if (success) {
        await _loadSyncStatus();
        _showSuccessSnackBar('Local data replaced with server data');
      }
    } catch (e) {
      setState(() {
        _statusMessage = 'Reverse sync failed: $e';
        _isSyncing = false;
      });
    }
  }

  Future<bool> _showReverseSyncDialog() async {
    return await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Download from Server?'),
        content: const Text(
          'This will replace ALL local data with data from the server. '
              'Any unsynced local changes will be lost.\n\n'
              'Are you sure you want to continue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red,
            ),
            child: const Text('Replace Local Data'),
          ),
        ],
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
      appBar: AppBar(
        title: const Text('Sync Status'),
        elevation: 2,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
        children: [
          // Status Header
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.surfaceVariant,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildStatCard('Synced', '$syncedCount', Colors.green),
                    _buildStatCard('Unsynced', '$unsyncedCount', Colors.orange),
                    _buildStatCard('Total', '$totalImages', Colors.blue),
                  ],
                ),
                if (_statusMessage.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    _statusMessage,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 13,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),

          // Action Buttons
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
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
                    label: Text(_isSyncing ? 'Syncing...' : 'Sync to Server'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isSyncing ? null : _performReverseSync,
                    icon: const Icon(Icons.cloud_download),
                    label: const Text('Download from Server'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // File List
          Expanded(
            child: _fileStatuses.isEmpty
                ? const Center(child: Text('No files to sync'))
                : ListView.builder(
              itemCount: _fileStatuses.length,
              itemBuilder: (context, index) {
                final fileStatus = _fileStatuses[index];
                return _buildFileListItem(fileStatus);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
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
      iconColor = Colors.blue;
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
      leading: CircleAvatar(
        backgroundColor: iconColor.withOpacity(0.1),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(
        fileName,
        style: const TextStyle(fontSize: 14),
      ),
      subtitle: Text(
        isMetadata
            ? 'Metadata (always synced)'
            : fileStatus.exists
            ? '${_formatFileSize(fileStatus.size)} • ${fileStatus.isSynced ? "Synced" : "Not synced"}'
            : 'File not found locally',
        style: TextStyle(
          fontSize: 12,
          color: fileStatus.exists ? null : Colors.red,
        ),
      ),
      trailing: isMetadata
          ? const Icon(Icons.sync, size: 18)
          : fileStatus.isSynced
          ? null
          : Icon(Icons.upload_outlined, size: 18, color: Colors.grey[600]),
    );
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class FileStatus {
  final String path;
  final FileType type;
  final bool isSynced;
  final int size;
  final bool exists;

  FileStatus({
    required this.path,
    required this.type,
    required this.isSynced,
    required this.size,
    this.exists = true,
  });
}

enum FileType { image, metadata }