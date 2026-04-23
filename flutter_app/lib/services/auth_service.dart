import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';
import '../model/blog.dart';
import 'blog_paths.dart';

class AuthException implements Exception {
  final String message;
  final int? statusCode;
  AuthException(this.message, {this.statusCode});
  @override
  String toString() => 'AuthException($statusCode): $message';
}

class AuthService extends ChangeNotifier {
  AuthService._internal();
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;

  static const _kAccess = 'auth.accessToken';
  static const _kRefresh = 'auth.refreshToken';
  static const _kUser = 'auth.user';
  static const _kBlog = 'auth.blog';
  static const _kBaseUrl = 'base_url';

  final _secure = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  String? _accessToken;
  String? _refreshToken;
  AuthUser? _user;
  Blog? _blog;
  Future<String?>? _refreshInFlight;

  AuthUser? get currentUser => _user;
  Blog? get currentBlog => _blog;
  bool get isLoggedIn => _accessToken != null && _user != null && _blog != null;

  /// Bootstraps the service from secure storage. Call once at app startup
  /// (before deciding LoginPage vs main UI).
  Future<void> bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final overridden = prefs.getString(_kBaseUrl);
    if (overridden != null && overridden.trim().isNotEmpty) {
      baseUrl = overridden;
    }

    _accessToken = await _secure.read(key: _kAccess);
    _refreshToken = await _secure.read(key: _kRefresh);
    final userRaw = await _secure.read(key: _kUser);
    final blogRaw = await _secure.read(key: _kBlog);
    if (userRaw != null) {
      try { _user = AuthUser.fromJson(jsonDecode(userRaw)); } catch (_) { _user = null; }
    }
    if (blogRaw != null) {
      try { _blog = Blog.fromJson(jsonDecode(blogRaw)); } catch (_) { _blog = null; }
    }
    notifyListeners();
  }

  Future<void> _persist() async {
    if (_accessToken == null) {
      await _secure.delete(key: _kAccess);
    } else {
      await _secure.write(key: _kAccess, value: _accessToken);
    }
    if (_refreshToken == null) {
      await _secure.delete(key: _kRefresh);
    } else {
      await _secure.write(key: _kRefresh, value: _refreshToken);
    }
    if (_user == null) {
      await _secure.delete(key: _kUser);
    } else {
      await _secure.write(key: _kUser, value: jsonEncode({
        'id': _user!.id, 'username': _user!.username, 'createdAt': _user!.createdAt,
      }));
    }
    if (_blog == null) {
      await _secure.delete(key: _kBlog);
    } else {
      await _secure.write(key: _kBlog, value: jsonEncode(_blog!.toJson()));
    }
  }

  /// Logs in with username/password. Throws [AuthException] on failure.
  Future<void> login(String username, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    if (res.statusCode != 200) {
      throw AuthException(_extractError(res.body, 'Login failed'),
          statusCode: res.statusCode);
    }
    _applyAuthResponse(jsonDecode(res.body));
    await _persist();
    notifyListeners();
  }

  Future<void> register({
    required String username,
    required String password,
    required String blogSlug,
    required String blogTitle,
    String? readPassword,
    bool gpsPathMode = false,
  }) async {
    final body = <String, dynamic>{
      'username': username,
      'password': password,
      'blogSlug': blogSlug,
      'blogTitle': blogTitle,
    };
    if (readPassword != null && readPassword.isNotEmpty) {
      body['readPassword'] = readPassword;
    }
    if (gpsPathMode) {
      body['settings'] = {'pathMode': 'gps'};
    }
    final res = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (res.statusCode != 201) {
      throw AuthException(_extractError(res.body, 'Registration failed'),
          statusCode: res.statusCode);
    }
    _applyAuthResponse(jsonDecode(res.body));
    await _persist();
    notifyListeners();
  }

  void _applyAuthResponse(Map<String, dynamic> body) {
    _accessToken = body['accessToken'] as String?;
    _refreshToken = body['refreshToken'] as String?;
    _user = body['user'] != null
        ? AuthUser.fromJson(Map<String, dynamic>.from(body['user']))
        : null;
    _blog = body['blog'] != null
        ? Blog.fromJson(Map<String, dynamic>.from(body['blog']))
        : null;
  }

  String _extractError(String body, String fallback) {
    try {
      final m = jsonDecode(body);
      if (m is Map && m['error'] is String) return m['error'] as String;
    } catch (_) {}
    return fallback;
  }

  /// Logs out: revokes refresh token server-side (best-effort), clears local
  /// secure storage and wipes the per-blog cached data folder.
  Future<void> logout() async {
    final blogId = _blog?.id;
    final refresh = _refreshToken;
    if (refresh != null) {
      try {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refresh}),
        ).timeout(const Duration(seconds: 5));
      } catch (_) { /* best effort */ }
    }
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    _blog = null;
    await _persist();
    if (blogId != null) {
      try { await BlogPaths.wipe(blogId); } catch (_) { /* ignore */ }
    }
    notifyListeners();
  }

  /// Replaces the in-memory blog (e.g. after PATCH /me/blog updated settings).
  Future<void> updateBlog(Blog blog) async {
    _blog = blog;
    await _persist();
    notifyListeners();
  }

  /// Returns a valid access token, refreshing if necessary.
  /// Throws [AuthException] if no refresh token or refresh fails.
  Future<String> getValidAccessToken() async {
    if (_accessToken == null) {
      throw AuthException('Not logged in', statusCode: 401);
    }
    try {
      final parts = _accessToken!.split('.');
      if (parts.length == 3) {
        final padded = base64Url.normalize(parts[1]);
        final payload = jsonDecode(utf8.decode(base64Url.decode(padded)));
        final exp = payload['exp'] as int?;
        if (exp != null) {
          final expiresAt = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
          if (DateTime.now().isAfter(expiresAt.subtract(const Duration(seconds: 30)))) {
            final fresh = await refreshAccessToken();
            if (fresh != null) return fresh;
          }
        }
      }
    } catch (e) {
      debugPrint('[auth] JWT expiration check failed: $e');
    }
    return _accessToken!;
  }

  /// Forces a refresh and returns the new access token (or null if logged out).
  Future<String?> refreshAccessToken() async {
    if (_refreshInFlight != null) return _refreshInFlight!;
    final fut = _doRefresh();
    _refreshInFlight = fut;
    try {
      return await fut;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<String?> _doRefresh() async {
    final refresh = _refreshToken;
    if (refresh == null) return null;
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refresh}),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        _accessToken = body['accessToken'] as String?;
        await _persist();
        return _accessToken;
      }
      if (res.statusCode == 401) {
        await logout();
        return null;
      }
      throw AuthException('Refresh failed', statusCode: res.statusCode);
    } on AuthException {
      rethrow;
    } catch (_) {
      return null;
    }
  }

  /// Performs an authenticated request, retrying once on 401 with a refresh.
  /// Callers pass a builder so the request can be re-issued with a fresh token.
  Future<http.Response> authedRequest(
      Future<http.Response> Function(String token) builder) async {
    var token = await getValidAccessToken();
    var res = await builder(token);
    if (res.statusCode != 401) return res;
    final fresh = await refreshAccessToken();
    if (fresh == null) {
      throw AuthException('Session expired', statusCode: 401);
    }
    return await builder(fresh);
  }

  /// For the multipart upload case where the request can't be replayed
  /// trivially. Caller refreshes manually if `mayRetry` is needed.
  Future<String> currentAccessTokenOrRefresh() async {
    final t = _accessToken;
    if (t != null) return t;
    final fresh = await refreshAccessToken();
    if (fresh == null) {
      throw AuthException('Session expired', statusCode: 401);
    }
    return fresh;
  }
}
