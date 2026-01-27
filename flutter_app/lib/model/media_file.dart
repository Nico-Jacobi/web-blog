import 'dart:io';
import 'package:path/path.dart' as path;

class MediaFile {
  final File file;
  final bool isVideo;

  MediaFile(this.file, this.isVideo);

  String get extension {
    final ext = path.extension(file.path).toLowerCase();

    // Normalize video extensions to .mp4
    if (isVideo) {
      return '.mp4';
    }

    // Normalize image extensions to .jpg
    if (ext == '.jpeg' || ext == '.jpg') {
      return '.jpg';
    }

    return ext;
  }

  bool get isImage => !isVideo;

  String get filename => path.basename(file.path);

  @override
  String toString() {
    return 'MediaFile(file: ${file.path}, isVideo: $isVideo)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is MediaFile &&
        other.file.path == file.path &&
        other.isVideo == isVideo;
  }

  @override
  int get hashCode => file.path.hashCode ^ isVideo.hashCode;
}