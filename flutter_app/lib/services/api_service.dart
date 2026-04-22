import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api_keys.dart';
import 'auth_service.dart';

/// Multi-tenant editor API client.
///
/// All endpoints sit under `/me/blog/*` on the backend. The user's blog is
/// resolved server-side from the JWT, so client paths stay tenant-agnostic.
class ApiService {
  static AuthService get _auth => AuthService();

  static Map<String, String> _authHeaders(String token, {bool json = false}) {
    final h = <String, String>{'Authorization': 'Bearer $token'};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  static Future<Map<String, dynamic>> listFiles(String path) async {
    final safePath = path == '/' ? '' : path;
    final res = await _auth.authedRequest((token) {
      final uri = Uri.parse('$baseUrl/me/blog/list')
          .replace(queryParameters: {'path': safePath});
      debugPrint('➡️ GET $uri');
      return http.get(uri, headers: _authHeaders(token));
    });
    debugPrint('⬅️ STATUS ${res.statusCode}');
    if (res.statusCode != 200) {
      throw Exception('failed to list files ${res.statusCode}');
    }
    return jsonDecode(res.body);
  }

  static Future<void> deleteFile(String path) async {
    final res = await _auth.authedRequest((token) => http.delete(
          Uri.parse('$baseUrl/me/blog/delete'),
          headers: _authHeaders(token, json: true),
          body: jsonEncode({'path': path}),
        ));
    if (res.statusCode != 200) {
      throw Exception('Failed to delete: ${res.statusCode}');
    }
  }

  static Future<void> uploadFile(String path, List<int> bytes) async {
    final token = await _auth.currentAccessTokenOrRefresh();
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/me/blog/upload'));
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: path));
    request.fields['path'] = path;
    final response = await request.send();
    if (response.statusCode != 200) {
      throw Exception('Upload failed: ${response.statusCode}');
    }
  }

  /// Downloads a previously-listed file. Accepts either an absolute URL or a
  /// relative server path (e.g. `data/points.json` or `images/foo.jpg`).
  static Future<List<int>> downloadFileFromUrl(String url) async {
    String fullUrl;
    if (url.startsWith('http')) {
      fullUrl = url;
    } else {
      final clean = url.startsWith('/') ? url.substring(1) : url;
      final blog = _auth.currentBlog;
      if (blog == null) throw Exception('Not logged in');
      fullUrl = '$baseUrl/blogs/${blog.slug}/files/$clean';
    }
    debugPrint('⬇️ Downloading: $fullUrl');
    final res = await _auth.authedRequest((token) => http.get(
          Uri.parse(fullUrl),
          headers: _authHeaders(token),
        ));
    if (res.statusCode != 200) {
      throw Exception('Failed to download: ${res.statusCode}');
    }
    debugPrint('✅ Downloaded: ${res.bodyBytes.length} bytes');
    return res.bodyBytes;
  }

  static Future<void> writeFile(String path, String content) async {
    final res = await _auth.authedRequest((token) => http.post(
          Uri.parse('$baseUrl/me/blog/write'),
          headers: _authHeaders(token, json: true),
          body: jsonEncode({'path': path, 'content': content}),
        ));
    if (res.statusCode != 200) {
      throw Exception('Failed to write file: ${res.statusCode}');
    }
  }
}
