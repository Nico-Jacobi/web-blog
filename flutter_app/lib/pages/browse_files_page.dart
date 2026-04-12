import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';
import '../services/api_service.dart';
import '../strings.dart';
import '../colors.dart';
import '../widgets/confirm_dialog.dart';

class BrowseFilesPage extends StatefulWidget {
  const BrowseFilesPage({super.key});

  @override
  State<BrowseFilesPage> createState() => _BrowseFilesPageState();
}

class _BrowseFilesPageState extends State<BrowseFilesPage> {
  String currentPath = '/';
  Map<String, dynamic>? fileData;
  bool isLoading = false;
  bool isDownloading = false;
  String? error;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadFiles();
  }

  Future<void> _loadFiles() async {
    setState(() {
      isLoading = true;
      error = null;
    });

    try {
      final data = await ApiService.listFiles(currentPath);
      setState(() {
        fileData = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  Future<void> _confirmDelete(String path, String name) async {
    // Hier nutzen wir jetzt das neue Widget
    final confirmed = await GradientConfirmDialog.show(
      context,
      title: AppStrings.delete_item_title,
      content: '${AppStrings.delete_item_confirm_prefix}\n"$name"\n${AppStrings.delete_item_confirm_suffix}',
      confirmText: AppStrings.button_delete,
      cancelText: AppStrings.button_cancel,
      icon: Icons.delete_forever_rounded, // Optional anderes Icon
    );

    if (confirmed == true) {
      await _deleteItem(path);
    }
  }

  Future<void> _deleteItem(String path) async {
    try {
      await ApiService.deleteFile(path);
      _loadFiles();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppStrings.snackBar_deleted)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${AppStrings.snackBar_error}$e')),
        );
      }
    }
  }

  Future<bool> _requestStoragePermission() async {
    if (Platform.isAndroid) {
      final androidInfo = await DeviceInfoPlugin().androidInfo;

      if (androidInfo.version.sdkInt >= 30) {
        var status = await Permission.manageExternalStorage.status;
        if (!status.isGranted) {
          status = await Permission.manageExternalStorage.request();

          if (!status.isGranted) {
            if (mounted) {
              final openSettings = await GradientConfirmDialog.show(
                context,
                title: AppStrings.perm_required_title,
                content: AppStrings.perm_required_body,
                confirmText: AppStrings.button_retry, // Oder "Einstellungen öffnen"
                cancelText: AppStrings.button_cancel,
                icon: Icons.storage_rounded,
              );

              if (openSettings == true) {
                await openAppSettings();
              }
            }
            return false;
          }
        }
        return status.isGranted;
      } else {
        var status = await Permission.storage.status;
        if (!status.isGranted) {
          status = await Permission.storage.request();
        }
        return status.isGranted;
      }
    }
    return true;
  }

  Future<void> _downloadAll() async {
    final hasPermission = await _requestStoragePermission();
    if (!hasPermission) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(AppStrings.perm_denied_snackbar)),
        );
      }
      return;
    }

    setState(() => isDownloading = true);

    try {
      String downloadsPath;

      if (Platform.isAndroid) {
        downloadsPath = '/storage/emulated/0/Download';
        final downloadsDir = Directory(downloadsPath);
        if (!await downloadsDir.exists()) {
          throw Exception('Downloads folder not found');
        }
      } else {
        final dir = await getApplicationDocumentsDirectory();
        downloadsPath = dir.path;
      }

      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final backupDirName = 'Backup_$timestamp';
      final backupDir = Directory('$downloadsPath/$backupDirName');
      await backupDir.create(recursive: true);

      await _downloadDirectory('/', backupDir.path);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${AppStrings.download_success_prefix}$backupDirName'),
            duration: const Duration(seconds: 5),
            backgroundColor: accent,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('Download error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${AppStrings.snackBar_error}$e')),
        );
      }
    } finally {
      setState(() => isDownloading = false);
    }
  }

  Future<void> _downloadDirectory(String remotePath, String localPath) async {
    final data = await ApiService.listFiles(remotePath);
    final folders = data['folders'] as List? ?? [];
    final files = data['files'] as List? ?? [];

    for (final file in files) {
      try {
        final fileName = file['name'] as String;
        final url = file['url'] as String;
        final bytes = await ApiService.downloadFileFromUrl(url);

        final localFile = File('$localPath/$fileName');
        await localFile.writeAsBytes(bytes);
      } catch (e) {
        debugPrint('Failed: $e');
      }
    }

    for (final folder in folders) {
      final folderPath = folder['path'] as String;
      final folderName = folder['name'] as String;
      final subDir = Directory('$localPath/$folderName');
      await subDir.create(recursive: true);
      await _downloadDirectory(folderPath, subDir.path);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.browse_files_appBar_title),
        backgroundColor: accent,
        foregroundColor: Colors.white,
        systemOverlayStyle: const SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        actions: [
          IconButton(
            icon: isDownloading
                ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            )
                : const Icon(Icons.download),
            onPressed: isDownloading ? null : _downloadAll,
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: pale,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${AppStrings.path_prefix}$currentPath',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(icon: const Icon(Icons.refresh), onPressed: _loadFiles),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Dateiname suchen…',
                prefixIcon: const Icon(Icons.search, color: primary),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: primary, width: 2),
                ),
              ),
              onChanged: (value) => setState(() => _searchQuery = value),
            ),
          ),
          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator(color: primary))
                : error != null
                ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${AppStrings.snackBar_error}$error'),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: _loadFiles,
                    style: ElevatedButton.styleFrom(backgroundColor: primary),
                    child: const Text(AppStrings.button_retry, style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            )
                : _buildFileList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFileList() {
    if (fileData == null) return Center(child: Text(AppStrings.noData_text));
    final allFolders = fileData!['folders'] as List? ?? [];
    final allFiles = fileData!['files'] as List? ?? [];

    final bool filtering = _searchQuery.isNotEmpty;
    final folders = filtering
        ? allFolders.where((f) => (f['name'] as String).toLowerCase().contains(_searchQuery.toLowerCase())).toList()
        : allFolders;
    final files = filtering
        ? allFiles.where((f) => (f['name'] as String).toLowerCase().contains(_searchQuery.toLowerCase())).toList()
        : allFiles;

    return ListView(
      children: [
        if (!filtering && currentPath != '/')
          ListTile(
            leading: const Icon(Icons.arrow_upward, color: dark),
            title: Text(AppStrings.parent_folder),
            onTap: () {
              setState(() {
                List<String> segments = currentPath.split('/')..removeWhere((s) => s.isEmpty);
                if (segments.isNotEmpty) segments.removeLast();
                currentPath = '/${segments.join('/')}';
              });
              _loadFiles();
            },
          ),
        ...folders.map((folder) {
          return ListTile(
            leading: const Icon(Icons.folder, color: light),
            title: Text(folder['name']),
            subtitle: Text('${AppStrings.modified_prefix}${folder['modified']}'),
            trailing: IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: () => _confirmDelete(folder['path'], folder['name']),
            ),
            onTap: () {
              setState(() => currentPath = folder['path']);
              _loadFiles();
            },
          );
        }),
        ...files.map((file) {
          return ListTile(
            leading: const Icon(Icons.insert_drive_file, color: primary),
            title: Text(file['name']),
            subtitle: Text('${AppStrings.size_prefix}${file['size']} bytes\n${AppStrings.modified_prefix}${file['modified']}'),
            trailing: IconButton(
              icon: const Icon(Icons.delete, color: Colors.red),
              onPressed: () => _confirmDelete(file['path'], file['name']),
            ),
          );
        }),
      ],
    );
  }
}