/// Loaded blog metadata returned by the backend (`/auth/login`, `/me`, etc.).
///
/// Settings are kept as a free-form map so the client doesn't need to be
/// updated every time the server adds a new field. Use [getSetting] to read
/// nested values with defaults.
class Blog {
  final String id;
  final String slug;
  final Map<String, dynamic> settings;
  final bool hasReadPassword;
  final String? createdAt;
  final String? updatedAt;

  Blog({
    required this.id,
    required this.slug,
    required this.settings,
    required this.hasReadPassword,
    this.createdAt,
    this.updatedAt,
  });

  factory Blog.fromJson(Map<String, dynamic> json) {
    return Blog(
      id: json['id'] as String,
      slug: json['slug'] as String,
      settings: Map<String, dynamic>.from(json['settings'] ?? {}),
      hasReadPassword: json['hasReadPassword'] == true,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'slug': slug,
        'settings': settings,
        'hasReadPassword': hasReadPassword,
        if (createdAt != null) 'createdAt': createdAt,
        if (updatedAt != null) 'updatedAt': updatedAt,
      };

  String get title => (settings['title'] as String?) ?? 'My Blog';
  String? get subtitle => settings['subtitle'] as String?;
  String? get dateRange => settings['dateRange'] as String?;
  String? get ownerDisplayName => settings['ownerDisplayName'] as String?;
  bool get isGpsPathMode => (settings['pathMode'] as String?) == 'gps';

  /// Get a nested setting by dotted path with a default fallback.
  T? getSetting<T>(String path, [T? fallback]) {
    final parts = path.split('.');
    dynamic current = settings;
    for (final part in parts) {
      if (current is Map && current.containsKey(part)) {
        current = current[part];
      } else {
        return fallback;
      }
    }
    return current is T ? current : fallback;
  }

  Blog copyWith({
    String? id,
    String? slug,
    Map<String, dynamic>? settings,
    bool? hasReadPassword,
    String? createdAt,
    String? updatedAt,
  }) {
    return Blog(
      id: id ?? this.id,
      slug: slug ?? this.slug,
      settings: settings ?? this.settings,
      hasReadPassword: hasReadPassword ?? this.hasReadPassword,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class AuthUser {
  final String id;
  final String username;
  final String? createdAt;

  AuthUser({required this.id, required this.username, this.createdAt});

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        username: json['username'] as String,
        createdAt: json['createdAt'] as String?,
      );
}
