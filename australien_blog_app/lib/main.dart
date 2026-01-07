// main.dart
import 'package:australien_blog_app/pages/create_point_page.dart';
import 'package:australien_blog_app/pages/manage_points_page.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'pages/start_page.dart';
import 'pages/browse_files_page.dart';
import 'pages/settings_page.dart';

final accent_color = Colors.blue[500]!;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  // This enables edge-to-edge mode for Android
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

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


