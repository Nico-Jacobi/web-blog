import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import '../services/api_service.dart';
import '../strings.dart';
import '../colors.dart';

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

  Future<void> _downloadAll() async {
    setState(() => isDownloading = true);

    try {
      String? downloadsPath;

      if (Platform.isAndroid) {
        // Gets /storage/emulated/0/Android/data/your.package/files
        final externalDirs = await getExternalStorageDirectories(type: StorageDirectory.downloads);
        if (externalDirs != null && externalDirs.isNotEmpty) {
          // Extract the root path to get to the public /Download folder
          String path = externalDirs.first.path;
          downloadsPath = path.split('/Android')[0] + '/Download';
        }
      } else {
        final dir = await getApplicationDocumentsDirectory();
        downloadsPath = dir.path;
      }

      if (downloadsPath == null) throw Exception("Could not find path");

      final backupDir = Directory('$downloadsPath/Backup_${DateTime.now().millisecondsSinceEpoch}');
      await backupDir.create(recursive: true);

      await _downloadDirectory('/', backupDir.path);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('✅ Saved to: $downloadsPath')),
        );
      }
    } catch (e) {
      debugPrint('Error: $e');
    } finally {
      setState(() => isDownloading = false);
    }
  }

  Future<void> _downloadDirectory(String remotePath, String localPath) async {
    final data = await ApiService.listFiles(remotePath);
    final folders = data['folders'] as List? ?? [];
    final files = data['files'] as List? ?? [];

    // Download all files in current directory
    for (final file in files) {
      try {
        final filePath = file['path'] as String;
        final fileName = file['name'] as String;
        final url = file['url'] as String;
        final bytes = await ApiService.downloadFileFromUrl(url);

        final localFile = File('$localPath/$fileName');
        await localFile.writeAsBytes(bytes);
        debugPrint('Downloaded: $fileName');
      } catch (e) {
        debugPrint('Failed to download file: $e');
      }
    }

    // Recursively download all subdirectories
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
        systemOverlayStyle: SystemUiOverlayStyle(
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
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
                : const Icon(Icons.download),
            onPressed: isDownloading ? null : _downloadAll,
            tooltip: 'Download All',
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
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: _loadFiles,
                ),
              ],
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

    final folders = fileData!['folders'] as List? ?? [];
    final files = fileData!['files'] as List? ?? [];

    return ListView(
      children: [
        if (currentPath != '/')
          ListTile(
            leading: const Icon(Icons.arrow_upward, color: dark),
            title: Text(AppStrings.parent_folder),
            onTap: () {
              setState(() {
                List<String> segments = currentPath.split('/');
                segments.removeWhere((s) => s.isEmpty);
                if (segments.isNotEmpty) segments.removeLast();

                currentPath = '/${segments.join('/')}';
              });
              _loadFiles();
            },
          ),
        ...folders.map((folder) => ListTile(
          leading: const Icon(Icons.folder, color: light),
          title: Text(folder['name']),
          subtitle: Text('${AppStrings.modified_prefix}${folder['modified']}'),
          trailing: IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: () => _deleteItem(folder['path']),
          ),
          onTap: () {
            setState(() {
              currentPath = folder['path'];
            });
            _loadFiles();
          },
        )),
        ...files.map((file) => ListTile(
          leading: const Icon(Icons.insert_drive_file, color: primary),
          title: Text(file['name']),
          subtitle: Text(
              '${AppStrings.size_prefix}${file['size']} bytes\n${AppStrings.modified_prefix}${file['modified']}'),
          trailing: IconButton(
            icon: const Icon(Icons.delete, color: Colors.red),
            onPressed: () => _deleteItem(file['path']),
          ),
        )),
      ],
    );
  }
}