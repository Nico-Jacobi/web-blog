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