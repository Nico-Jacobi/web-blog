// main.dart
import 'package:australien_blog_app/pages/interest_point_page.dart';
import 'package:flutter/material.dart';
import 'pages/start_page.dart';
import 'pages/browse_files_page.dart';
import 'pages/settings_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: const StartPage(),
      routes: {
        '/startpage': (context) => const StartPage(),
        '/browse_files': (context) => const BrowseFilesPage(),
        '/upload_file': (context) => AddInterestPointPage(),
        '/settings': (context) => const SettingsPage(),
      },
    );
  }
}
