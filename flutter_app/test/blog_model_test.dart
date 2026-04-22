import 'package:flutter_test/flutter_test.dart';
import 'package:australien_blog_app/model/blog.dart';

void main() {
  group('Blog.fromJson', () {
    test('parses required fields', () {
      final blog = Blog.fromJson({
        'id': 'abc',
        'slug': 'anna-trip',
        'settings': {'title': 'Anna in Vietnam'},
        'hasReadPassword': true,
      });
      expect(blog.id, 'abc');
      expect(blog.slug, 'anna-trip');
      expect(blog.title, 'Anna in Vietnam');
      expect(blog.hasReadPassword, true);
    });

    test('handles missing settings as empty map', () {
      final blog = Blog.fromJson({
        'id': 'abc',
        'slug': 'x',
        'hasReadPassword': false,
      });
      expect(blog.settings, isEmpty);
      expect(blog.title, 'My Blog'); // fallback
    });

    test('hasReadPassword defaults to false when missing or non-boolean', () {
      final a = Blog.fromJson({'id': 'a', 'slug': 's', 'hasReadPassword': 'yes'});
      expect(a.hasReadPassword, false);
      final b = Blog.fromJson({'id': 'b', 'slug': 's2'});
      expect(b.hasReadPassword, false);
    });
  });

  group('Blog accessors', () {
    final blog = Blog.fromJson({
      'id': 'b1',
      'slug': 's1',
      'hasReadPassword': false,
      'settings': {
        'title': 'Trip',
        'subtitle': 'A journey',
        'dateRange': '2026',
        'ownerDisplayName': 'Anna',
        'theme': {'primary': 'purple', 'accent': 'rose'},
        'push': {'notificationText': '{owner} posted!'},
      },
    });

    test('exposes flat top-level fields', () {
      expect(blog.title, 'Trip');
      expect(blog.subtitle, 'A journey');
      expect(blog.dateRange, '2026');
      expect(blog.ownerDisplayName, 'Anna');
    });

    test('getSetting reads dotted nested paths', () {
      expect(blog.getSetting<String>('theme.primary'), 'purple');
      expect(blog.getSetting<String>('theme.accent'), 'rose');
      expect(blog.getSetting<String>('push.notificationText'), '{owner} posted!');
    });

    test('getSetting returns fallback for missing path', () {
      expect(blog.getSetting<String>('theme.missing', 'def'), 'def');
      expect(blog.getSetting<String>('does.not.exist'), isNull);
    });

    test('getSetting returns fallback when type mismatches', () {
      // theme.primary is String, asking for int should fall back
      expect(blog.getSetting<int>('theme.primary', 42), 42);
    });
  });

  group('Blog.toJson roundtrip', () {
    test('preserves all fields', () {
      final original = Blog.fromJson({
        'id': 'r1',
        'slug': 'round',
        'hasReadPassword': true,
        'settings': {'title': 'X', 'theme': {'primary': 'blue'}},
        'createdAt': '2026-01-01T00:00:00Z',
        'updatedAt': '2026-01-02T00:00:00Z',
      });
      final round = Blog.fromJson(Map<String, dynamic>.from(original.toJson()));
      expect(round.id, original.id);
      expect(round.slug, original.slug);
      expect(round.hasReadPassword, original.hasReadPassword);
      expect(round.settings['title'], 'X');
      expect(round.getSetting<String>('theme.primary'), 'blue');
      expect(round.createdAt, original.createdAt);
    });
  });

  group('Blog.copyWith', () {
    test('replaces only provided fields', () {
      final original = Blog.fromJson({
        'id': 'c1',
        'slug': 'old',
        'hasReadPassword': true,
        'settings': {'title': 'Old title'},
      });
      final updated = original.copyWith(
        slug: 'new',
        settings: {'title': 'New title'},
      );
      expect(updated.id, original.id);
      expect(updated.slug, 'new');
      expect(updated.title, 'New title');
      expect(updated.hasReadPassword, true);
    });
  });

  group('AuthUser.fromJson', () {
    test('parses required fields', () {
      final u = AuthUser.fromJson({
        'id': 'u1',
        'username': 'anna',
        'createdAt': '2026-01-01T00:00:00Z',
      });
      expect(u.id, 'u1');
      expect(u.username, 'anna');
      expect(u.createdAt, '2026-01-01T00:00:00Z');
    });

    test('createdAt is optional', () {
      final u = AuthUser.fromJson({'id': 'u2', 'username': 'bob'});
      expect(u.createdAt, isNull);
    });
  });
}
