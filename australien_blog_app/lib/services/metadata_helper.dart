import 'dart:io';

import 'package:exif/exif.dart';

class MetadataHelper {
  static Future<Map<String, dynamic>> getExifData(File image) async {
    final tags = await readExifFromBytes(await image.readAsBytes());
    Map<String, dynamic> data = {};

    // Date formatting: YYYY:MM:DD -> DD/MM/YYYY
    if (tags.containsKey('Image DateTime')) {
      String rawDate = tags['Image DateTime']!.toString();
      if (rawDate.length >= 10) {
        final parts = rawDate.split(' ')[0].split(':');
        data['date'] = "${parts[2]}/${parts[1]}/${parts[0]}";
      }
    }

    double? convert(IfdTag? tag, IfdTag? ref) {
      if (tag == null || ref == null || tag.values is! List) return null;
      final values = tag.values.toList();
      double d = _toDouble(values[0]);
      double m = _toDouble(values[1]);
      double s = _toDouble(values[2]);
      double res = d + (m / 60.0) + (s / 3600.0);
      return ref.printable.contains(RegExp(r'[SW]')) ? -res : res;
    }

    data['lat'] = convert(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
    data['lon'] = convert(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);

    return data;
  }

  static double _toDouble(dynamic value) {
    if (value is Ratio) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0.0;
  }
}