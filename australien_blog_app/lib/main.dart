// main.dart
import 'package:australien_blog_app/pages/create_point_page.dart';
import 'package:australien_blog_app/pages/manage_points_page.dart';
import 'package:australien_blog_app/pages/sync_status_page.dart';
import 'package:australien_blog_app/services/storage_service.dart';
import 'package:australien_blog_app/services/sync_service.dart';
import 'package:australien_blog_app/strings.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'colors.dart';
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



  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,   // portrait only
    // DeviceOrientation.portraitDown, // optional: allow upside-down
  ]).then((_) {
    runApp(MyApp());
  });

}


class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // main.dart
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        // Basis-Farben
        primaryColor: primary,
        scaffoldBackgroundColor: Colors.grey[50],

        // AppBar Styling (passend zur StartPage)
        appBarTheme: const AppBarTheme(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          elevation: 0,
          centerTitle: true,
        ),

        // Textfelder zentral stylen (Umrandung & Fokus)
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          labelStyle: const TextStyle(color: Colors.grey),
          floatingLabelStyle: const TextStyle(color: primary, fontWeight: FontWeight.bold),

          // Rand wenn nicht ausgewählt
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: pale, width: 1.5),
          ),

          // Rand wenn reingeklickt wird (Lila wird durch Primary ersetzt)
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: primary, width: 2),
          ),

          // Rand bei Fehlern
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Colors.red, width: 1.5),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        ),

        // Cursor Farbe
        textSelectionTheme: const TextSelectionThemeData(
          cursorColor: primary,
          selectionColor: pale,
          selectionHandleColor: primary,
        ),

        // Standard-Buttons (ElevatedButton)
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 2,
          ),
        ),
      ),
      builder: _buildGlobalSyncOverlay,
      home: const StartPage(),
      routes: {
        '/start': (context) => const StartPage(),
        '/upload_point': (context) => const AddInterestPointPage(),
        '/manage_points': (context) => const ManagePointsPage(),
        '/browse_files': (context) => const BrowseFilesPage(),
        '/settings': (context) => const SettingsPage(),
        '/sync_files': (context) => const SyncStatusPage(),
      },
    );
  }

  // Extracted Global Overlay Method
  Widget _buildGlobalSyncOverlay(BuildContext context, Widget? child) {
    return Stack(
      children: [
        if (child != null) child,
        ValueListenableBuilder<bool>(
          valueListenable: SyncService().syncProgress,
          builder: (context, isSyncing, _) {
            if (!isSyncing) return const SizedBox.shrink();
            return Positioned(
              bottom: 20,
              right: 20,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black87, // Slightly darker for text legibility
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        AppStrings.sync_spinner_text,
                        style: const TextStyle(color: Colors.white, fontSize: 12),
                      ),
                      const SizedBox(width: 8),
                      const SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}


//todo when drag and dropping points the the list view, the adjacent travel methods reset
// treat as if each route is attached to the next point, when dragin and dropping reattach to how it was aranged (only p1 for a rount can change)