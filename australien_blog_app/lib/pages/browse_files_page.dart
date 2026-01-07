// pages/browse_files_page.dart
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../strings.dart';

class BrowseFilesPage extends StatefulWidget {
  const BrowseFilesPage({super.key});

  @override
  State<BrowseFilesPage> createState() => _BrowseFilesPageState();
}

class _BrowseFilesPageState extends State<BrowseFilesPage> {
  String currentPath = '/';
  Map<String, dynamic>? fileData;
  bool isLoading = false;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppStrings.coordinate_picker_appBar_title),
        backgroundColor: Colors.blue[700],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.blue[100],
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
                ? const Center(child: CircularProgressIndicator())
                : error != null
                ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${AppStrings.snackBar_error}$error'),
                  ElevatedButton(
                    onPressed: _loadFiles,
                    child: const Text(AppStrings.button_retry),
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
            leading: const Icon(Icons.arrow_upward),
            title: Text(AppStrings.parent_folder),
            onTap: () {
              setState(() {
                currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                if (currentPath.isEmpty) currentPath = '/';
              });
              _loadFiles();
            },
          ),
        ...folders.map((folder) => ListTile(
          leading: const Icon(Icons.folder, color: Colors.amber),
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
          leading: const Icon(Icons.insert_drive_file, color: Colors.blue),
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
