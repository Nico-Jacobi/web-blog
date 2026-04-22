import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../model/data_file.dart';
import '../model/media_file.dart';
import '../services/blog_paths.dart';
import '../services/storage_service.dart';
import '../services/sync_service.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../model/file_status.dart';
import '../colors.dart';
import '../widgets/confirm_dialog.dart';

class SyncStatusPage extends StatefulWidget {
  const SyncStatusPage({super.key});

  @override
  State<SyncStatusPage> createState() => _SyncStatusPageState();
}

class _SyncStatusPageState extends State<SyncStatusPage> {
  final SyncService _syncService = SyncService();
  final StorageService _storageService = StorageService();

  bool _isLoading = false;
  bool _isSyncing = false;
  bool _syncEnabled = true;
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
      _syncEnabled = await _syncService.isSyncEnabled();
      _syncedFiles = await _syncService.getSyncedFiles();
      final points = await _storageService.loadPoints();
      final trips = await _storageService.loadTrips();

      final appDir = await BlogPaths.dir();

      // Collect all media filenames
      final allMediaFilenames = <String>{};
      for (var point in points) {
        if (point.titleImagePath.isNotEmpty) {
          allMediaFilenames.add(point.titleImagePath);
        }
        allMediaFilenames.addAll(point.otherMediaPaths);
      }

      final pointsData = DataFile.points;
      final tripsData = DataFile.trips;
      final mediaList = allMediaFilenames
          .map((f) => MediaFile.fromFilenameSync(f, appDir.path))
          .toList();

      // Parallelize all size/exists I/O
      final sizes = await Future.wait([
        pointsData.size(),
        tripsData.size(),
        ...mediaList.map((m) => m.size()),
      ]);
      final exists = await Future.wait([
        pointsData.exists(),
        tripsData.exists(),
        ...mediaList.map((m) => m.exists()),
      ]);

      final fileStatuses = <FileStatus>[
        FileStatus(
          path: pointsData.name,
          type: FileType.metadata,
          isSynced: true,
          size: sizes[0],
          exists: exists[0],
        ),
        FileStatus(
          path: tripsData.name,
          type: FileType.metadata,
          isSynced: true,
          size: sizes[1],
          exists: exists[1],
        ),
      ];
      final filenamesList = allMediaFilenames.toList();
      for (var i = 0; i < mediaList.length; i++) {
        fileStatuses.add(FileStatus(
          path: mediaList[i].filename,
          type: FileType.image,
          isSynced: _syncedFiles.contains(filenamesList[i]),
          size: sizes[i + 2],
          exists: exists[i + 2],
        ));
      }

      setState(() {
        _fileStatuses = fileStatuses;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      setState(() {
        _statusMessage = '${l10n.syncStatusErrorLoading}$e';
        _isLoading = false;
      });
    }
  }

  Future<void> _performSync() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _isSyncing = true;
      _statusMessage = l10n.syncSpinnerText;
    });

    try {
      final result = await _syncService.syncFromStorage();

      if (!mounted) return;
      final l10nInner = AppLocalizations.of(context)!;

      if (result == null) {
        setState(() {
          _statusMessage = l10nInner.syncStatusInProgress;
          _isSyncing = false;
        });
        _showSuccessSnackBar(l10nInner.syncStatusInProgress);
        return;
      }

      setState(() {
        _statusMessage = result.message;
        _isSyncing = false;
      });

      await _loadSyncStatus();

      if (result.success && mounted) {
        _showSuccessSnackBar(AppLocalizations.of(context)!.syncStatusSuccess);
      }
    } catch (e) {
      if (!mounted) return;
      final l10nErr = AppLocalizations.of(context)!;
      setState(() {
        _statusMessage = '${l10nErr.syncStatusFailed}$e';
        _isSyncing = false;
      });
    }
  }

  Future<void> _performReverseSync() async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await GradientConfirmDialog.show(
      context,
      title: l10n.syncDialogTitle,
      content: l10n.syncDialogContent,
      confirmText: l10n.syncDialogConfirm,
      cancelText: l10n.buttonCancel,
      icon: Icons.cloud_download,
    );
    if (confirmed != true) return;

    _storageService.resetApp();

    if (!mounted) return;
    final l10nAfter = AppLocalizations.of(context)!;
    setState(() {
      _isSyncing = true;
      _statusMessage = l10nAfter.syncDownloading;
    });

    try {
      final success = await _syncService.initializeFromServer();

      if (!mounted) return;
      final l10nResult = AppLocalizations.of(context)!;
      setState(() {
        _statusMessage = success
            ? l10nResult.syncDownloadSuccess
            : l10nResult.syncDownloadFailed;
        _isSyncing = false;
      });

      if (success) {
        await _loadSyncStatus();
        if (mounted) {
          _showSuccessSnackBar(AppLocalizations.of(context)!.syncDataReplaced);
        }
      }
    } catch (e) {
      if (!mounted) return;
      final l10nErr = AppLocalizations.of(context)!;
      setState(() {
        _statusMessage = '${l10nErr.syncReverseFailed}$e';
        _isSyncing = false;
      });
    }
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
    final l10n = AppLocalizations.of(context)!;
    final unsyncedCount = _fileStatuses.where((f) => !f.isSynced && f.type == FileType.image).length;
    final totalImages = _fileStatuses.where((f) => f.type == FileType.image).length;
    final syncedCount = totalImages - unsyncedCount;

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.syncStatusTitle),
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
                    _buildStatCard(l10n.syncStatSynced, '$syncedCount', Colors.green),
                    _buildStatCard(l10n.syncStatUnsynced, '$unsyncedCount', Colors.orange),
                    _buildStatCard(l10n.syncStatTotal, '$totalImages', primary),
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
                    onPressed: (_isSyncing || !_syncEnabled) ? null : _performSync,
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
                    label: Text(_isSyncing ? l10n.syncSpinnerText : l10n.buttonSyncUpload),
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
                    label: Text(l10n.buttonSyncDownload),
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
                    l10n.syncNoFiles,
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
    final l10n = AppLocalizations.of(context)!;
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
              ? l10n.syncFileNotFound
              : isMetadata
              ? '${_formatFileSize(fileStatus.size)} • ${l10n.syncFileMetadata}'
              : '${_formatFileSize(fileStatus.size)} • ${fileStatus.isSynced ? l10n.syncFileSynced : l10n.syncFileNotSynced}',
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
