import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

class MediaFile {
  final File file;
  final bool isVideo;

  // Relative path under the media/ directory, e.g. 'sydney/media_123.jpg'.
  // Empty for temporary UI files that haven't been assigned a stop yet.
  final String serverRelPath;

  MediaFile(this.file, this.isVideo, [this.serverRelPath = '']);

  /// Returns the local filename (e.g. "media_123.jpg")
  String get filename => path.basename(file.path);

  /// Returns the full server path (e.g. "media/sydney/media_123.jpg")
  String get serverPath => 'media/$serverRelPath';

  /// Returns the full application directory path asynchronously
  Future<String> get applicationPath async {
    final appDir = await getApplicationDocumentsDirectory();
    return path.join(appDir.path, filename);
  }

  /// Returns the full application directory path synchronously
  String getApplicationPath(String appDirPath) {
    return path.join(appDirPath, filename);
  }

  /// Returns the normalized file extension.
  String get extension {
    if (isVideo) return '.mp4';
    return '.jpg';
  }

  bool get isImage => !isVideo;

  /// Creates a MediaFile from a server-relative path (e.g. 'sydney/media_123.jpg').
  /// The local file is looked up by basename only, since local storage is flat.
  static Future<MediaFile> fromFilename(String serverRelPath, {bool? isVideo}) async {
    final appDir = await getApplicationDocumentsDirectory();
    final localFilename = path.basename(serverRelPath);
    final filePath = path.join(appDir.path, localFilename);
    final file = File(filePath);
    final isVid = isVideo ?? _isVideoFile(localFilename);
    return MediaFile(file, isVid, serverRelPath);
  }

  /// Synchronous version — requires the app directory path to be provided.
  static MediaFile fromFilenameSync(String serverRelPath, String appDirPath, {bool? isVideo}) {
    final localFilename = path.basename(serverRelPath);
    final filePath = path.join(appDirPath, localFilename);
    final file = File(filePath);
    final isVid = isVideo ?? _isVideoFile(localFilename);
    return MediaFile(file, isVid, serverRelPath);
  }

  static bool _isVideoFile(String filename) {
    final ext = filename.toLowerCase();
    return ext.endsWith('.mp4') ||
        ext.endsWith('.mov') ||
        ext.endsWith('.avi') ||
        ext.endsWith('.mkv');
  }

  Future<bool> exists() async {
    return await file.exists();
  }

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
