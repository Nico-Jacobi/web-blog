import 'dart:io';
import 'package:path/path.dart' as path;
import '../services/blog_paths.dart';

/// Media (image/video) file stored under the per-blog local directory.
class MediaFile {
  final File file;
  final bool isVideo;

  MediaFile(this.file, this.isVideo);

  String get filename => path.basename(file.path);

  /// Server-relative path (e.g., "images/media_123.jpg").
  String get serverPath => 'images/$filename';

  Future<String> get applicationPath async {
    final dir = await BlogPaths.dir();
    return path.join(dir.path, filename);
  }

  String getApplicationPath(String blogDirPath) {
    return path.join(blogDirPath, filename);
  }

  /// Normalised file extension. Compression pipelines emit JPEG/MP4.
  String get extension => isVideo ? '.mp4' : '.jpg';

  bool get isImage => !isVideo;

  static Future<MediaFile> fromFilename(String filename, {bool? isVideo}) async {
    final dir = await BlogPaths.dir();
    final file = File(path.join(dir.path, filename));
    return MediaFile(file, isVideo ?? _isVideoFile(filename));
  }

  /// Sync constructor — caller already has the per-blog directory path.
  static MediaFile fromFilenameSync(String filename, String blogDirPath, {bool? isVideo}) {
    final file = File(path.join(blogDirPath, filename));
    return MediaFile(file, isVideo ?? _isVideoFile(filename));
  }

  static bool _isVideoFile(String filename) {
    final ext = filename.toLowerCase();
    return ext.endsWith('.mp4') ||
        ext.endsWith('.mov') ||
        ext.endsWith('.avi') ||
        ext.endsWith('.mkv') ||
        ext.endsWith('.webm');
  }

  Future<bool> exists() async => file.exists();

  Future<int> size() async {
    if (await file.exists()) return file.length();
    return 0;
  }

  @override
  String toString() =>
      'MediaFile(filename: $filename, isVideo: $isVideo, serverPath: $serverPath)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MediaFile &&
          other.filename == filename &&
          other.isVideo == isVideo);

  @override
  int get hashCode => filename.hashCode ^ isVideo.hashCode;
}
