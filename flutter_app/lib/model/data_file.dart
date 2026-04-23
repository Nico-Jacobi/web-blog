import 'dart:io';
import 'package:path/path.dart' as path;
import '../services/blog_paths.dart';

/// Represents a data file (like points.json or trips.json) stored under the
/// per-blog local directory.
class DataFile {
  final String filename;

  DataFile(this.filename);

  /// Just the filename (e.g., "points.json")
  String get name => filename;

  /// Server-relative path (e.g., "data/points.json"). The same value is used
  /// against the multi-tenant backend; the user/blog scope comes from auth.
  String get serverPath => 'data/$filename';

  /// Absolute on-disk path under the per-blog local directory.
  Future<String> get applicationPath async {
    final dir = await BlogPaths.dir();
    return path.join(dir.path, filename);
  }

  /// Absolute on-disk path inside an explicit blog directory.
  String getApplicationPath(String blogDirPath) {
    return path.join(blogDirPath, filename);
  }

  Future<File> get file async {
    return File(await applicationPath);
  }

  File getFile(String blogDirPath) {
    return File(getApplicationPath(blogDirPath));
  }

  Future<bool> exists() async {
    return (await file).exists();
  }

  Future<int> size() async {
    final f = await file;
    if (await f.exists()) return f.length();
    return 0;
  }

  static final points = DataFile('points.json');
  static final trips = DataFile('trips.json');
  static final gpsTrack = DataFile('gps_track.json');

  @override
  String toString() => 'DataFile(filename: $filename, serverPath: $serverPath)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || (other is DataFile && other.filename == filename);

  @override
  int get hashCode => filename.hashCode;
}
