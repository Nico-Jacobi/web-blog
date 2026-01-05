// main.dart
import 'pages/view_interest_points.dart';
import 'package:flutter/material.dart';
import 'pages/start_page.dart';
import 'pages/browse_files_page.dart';
import 'pages/settings_page.dart';
import 'pages/interest_point_page.dart';

final accent_color = Colors.blue[500]!;

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
        '/start': (context) => const StartPage(),
        '/upload_point': (context) => const AddInterestPointPage(),
        '/manage_points': (context) => const ManagePointsPage(),
        '/browse_files': (context) => const BrowseFilesPage(),
        '/settings': (context) => const SettingsPage(),
      },
    );
  }
}
