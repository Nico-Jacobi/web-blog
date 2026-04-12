import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

class MediaFile {
  final File file;
  final bool isVideo;

  MediaFile(this.file, this.isVideo);

  /// Returns the filename with extension (e.g., "media_123.jpg")
  String get filename => path.basename(file.path);

  /// Returns the server/relative path (e.g., "images/media_123.jpg")
  String get serverPath => 'images/$filename';

  /// Returns the full application directory path asynchronously
  Future<String> get applicationPath async {
    final appDir = await getApplicationDocumentsDirectory();
    return path.join(appDir.path, filename);
  }

  /// Returns the full application directory path synchronously
  /// WARNING: Only use this if you already have the app directory
  String getApplicationPath(String appDirPath) {
    return path.join(appDirPath, filename);
  }

  /// Returns the normalized file extension.
  /// Images always get .jpg because _compressImage() outputs JPEG format.
  /// Videos always get .mp4 because VideoCompress outputs MP4.
  String get extension {
    if (isVideo) return '.mp4';
    return '.jpg';
  }

  /// Returns true if this is an image file
  bool get isImage => !isVideo;

  /// Creates a MediaFile from just a filename
  /// Useful when loading from JSON where you only have the filename
  static Future<MediaFile> fromFilename(String filename, {bool? isVideo}) async {
    final appDir = await getApplicationDocumentsDirectory();
    final filePath = path.join(appDir.path, filename);
    final file = File(filePath);

    // Auto-detect if video if not specified
    final isVid = isVideo ?? _isVideoFile(filename);

    return MediaFile(file, isVid);
  }

  /// Creates a MediaFile from just a filename (synchronous version)
  /// Requires the app directory path to be provided
  static MediaFile fromFilenameSync(String filename, String appDirPath, {bool? isVideo}) {
    final filePath = path.join(appDirPath, filename);
    final file = File(filePath);

    // Auto-detect if video if not specified
    final isVid = isVideo ?? _isVideoFile(filename);

    return MediaFile(file, isVid);
  }

  /// Helper method to detect if a filename is a video
  static bool _isVideoFile(String filename) {
    final ext = filename.toLowerCase();
    return ext.endsWith('.mp4') ||
        ext.endsWith('.mov') ||
        ext.endsWith('.avi') ||
        ext.endsWith('.mkv');
  }

  /// Check if the file exists on disk
  Future<bool> exists() async {
    return await file.exists();
  }

  /// Get file size in bytes
  Future<int> size() async {
    if (await file.exists()) {
      return await file.length();
    }
    return 0;
  }

  @override
  String toString() {
    return 'MediaFile(filename: $filename, isVideo: $isVideo, serverPath: $serverPath)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MediaFile &&
        other.filename == filename &&
        other.isVideo == isVideo;
  }

  @override
  int get hashCode => filename.hashCode ^ isVideo.hashCode;
}