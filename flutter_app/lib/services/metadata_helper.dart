import 'dart:io';

import 'package:exif/exif.dart';
import 'package:flutter/foundation.dart';

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

    // Debug: dump all GPS-related tags
    final gpsTags = tags.entries.where((e) => e.key.contains('GPS')).toList();
    debugPrint('[MetadataHelper] GPS EXIF tags for ${image.path}:');
    for (final entry in gpsTags) {
      final tag = entry.value;
      debugPrint('  ${entry.key}: printable="${tag.printable}" '
          'type=${tag.values.runtimeType} values=${tag.values.toList()}');
    }
    if (gpsTags.isEmpty) {
      debugPrint('  (no GPS tags found)');
    }

    double? convert(IfdTag? tag, IfdTag? ref) {
      if (tag == null || ref == null) return null;
      try {
        List<dynamic> values;
        if (tag.values is IfdRatios) {
          values = (tag.values as IfdRatios).ratios;
        } else {
          values = tag.values.toList();
        }
        if (values.length < 3) return null;
        double d = _toDouble(values[0]);
        double m = _toDouble(values[1]);
        double s = _toDouble(values[2]);
        debugPrint('  -> d=$d m=$m s=$s (raw: ${values[0]} ${values[1]} ${values[2]})');
        double res = d + (m / 60.0) + (s / 3600.0);
        if (res.isNaN || res.isInfinite) return null;
        if (res == 0.0) return null;
        return ref.printable.contains(RegExp(r'[SW]')) ? -res : res;
      } catch (e) {
        return null;
      }
    }

    data['lat'] = convert(tags['GPS GPSLatitude'], tags['GPS GPSLatitudeRef']);
    data['lon'] = convert(tags['GPS GPSLongitude'], tags['GPS GPSLongitudeRef']);
    debugPrint('  => lat=${data['lat']}, lon=${data['lon']}');

    return data;
  }

  static double _toDouble(dynamic value) {
    if (value is Ratio) {
      if (value.denominator == 0) return 0.0;
      return value.toDouble();
    }
    final parsed = double.tryParse(value.toString()) ?? 0.0;
    return parsed.isNaN ? 0.0 : parsed;
  }
}