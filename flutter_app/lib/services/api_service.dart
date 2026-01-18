// services/api_service.dart
import 'package:flutter/cupertino.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import '../api_keys.dart';

class ApiService {


  static Future<Map<String, dynamic>> listFiles(String path) async {
    final safePath = path == '/' ? '' : path;

    final uri = Uri.parse('$baseUrl/list')
        .replace(queryParameters: {'path': safePath});

    debugPrint('➡️ GET $uri');
    debugPrint('➡️ x-auth-token: ${authToken.length} chars');

    final res = await http.get(
      uri,
      headers: {
        'x-auth-token': authToken,
      },
    );

    debugPrint('⬅️ STATUS ${res.statusCode}');
    debugPrint('⬅️ BODY ${res.body}');

    if (res.statusCode != 200) {
      throw Exception('failed to list files ${res.statusCode}');
    }

    return jsonDecode(res.body);
  }


  static Future<void> deleteFile(String path) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/delete'),
      headers: {
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
      },
      body: json.encode({'path': path}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to delete');
    }
  }

  static Future<void> uploadFile(String path, List<int> bytes) async {
    var request = http.MultipartRequest('POST', Uri.parse('$baseUrl/upload'));
    request.headers['x-auth-token'] = authToken;
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: path));
    request.fields['path'] = path;

    var response = await request.send();
    if (response.statusCode != 200) {
      throw Exception('Upload failed');
    }
  }

  static Future<void> writeFile(String path, String content) async {
    final response = await http.post(
      Uri.parse('$baseUrl/write'),
      headers: {
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
      },
      body: json.encode({'path': path, 'content': content}),
    );
    if (response.statusCode != 200) {
      throw Exception('Failed to write file');
    }
  }
}