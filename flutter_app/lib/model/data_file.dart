import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

/// Represents a data file (like points.json or trips.json)
class DataFile {
  final String filename;

  DataFile(this.filename);

  /// Returns the filename (e.g., "points.json")
  String get name => filename;

  /// Returns the server/relative path (e.g., "data/points.json")
  String get serverPath => 'data/$filename';

  /// Returns the full application directory path asynchronously
  Future<String> get applicationPath async {
    final appDir = await getApplicationDocumentsDirectory();
    return path.join(appDir.path, filename);
  }

  /// Returns the full application directory path synchronously
  /// Requires the app directory path to be provided
  String getApplicationPath(String appDirPath) {
    return path.join(appDirPath, filename);
  }

  /// Returns a File object for this data file
  Future<File> get file async {
    final filePath = await applicationPath;
    return File(filePath);
  }

  /// Returns a File object for this data file (synchronous)
  File getFile(String appDirPath) {
    final filePath = getApplicationPath(appDirPath);
    return File(filePath);
  }

  /// Check if the file exists on disk
  Future<bool> exists() async {
    final f = await file;
    return await f.exists();
  }

  /// Get file size in bytes
  Future<int> size() async {
    final f = await file;
    if (await f.exists()) {
      return await f.length();
    }
    return 0;
  }

  /// Common data files
  static final points = DataFile('points.json');
  static final trips = DataFile('trips.json');

  @override
  String toString() {
    return 'DataFile(filename: $filename, serverPath: $serverPath)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DataFile && other.filename == filename;
  }

  @override
  int get hashCode => filename.hashCode;
}