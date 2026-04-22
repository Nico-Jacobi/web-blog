import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'auth_service.dart';

/// Per-blog local file system layout.
///
/// All app-local data (points.json, trips.json, sync state, media) lives under
/// `<appDocs>/blog_<blogId>/` so logging out of one account and into another
/// doesn't mix data. Modules ask [dir] / [path] instead of touching
/// `getApplicationDocumentsDirectory()` directly.
class BlogPaths {
  /// Returns the per-blog local directory for the currently-logged-in account.
  /// Creates it on first access. Throws if no user is logged in.
  static Future<Directory> dir() async {
    final blog = AuthService().currentBlog;
    if (blog == null) {
      throw StateError('No active blog — user must be logged in');
    }
    final root = await getApplicationDocumentsDirectory();
    final scoped = Directory(p.join(root.path, 'blog_${blog.id}'));
    if (!await scoped.exists()) {
      await scoped.create(recursive: true);
    }
    return scoped;
  }

  /// Convenience: absolute path to a file under the per-blog directory.
  static Future<String> path(String relative) async {
    final d = await dir();
    return p.join(d.path, relative);
  }

  /// Wipes all locally cached data for the given blog (used at logout / account switch).
  static Future<void> wipe(String blogId) async {
    final root = await getApplicationDocumentsDirectory();
    final scoped = Directory(p.join(root.path, 'blog_$blogId'));
    if (await scoped.exists()) {
      await scoped.delete(recursive: true);
    }
  }
}
