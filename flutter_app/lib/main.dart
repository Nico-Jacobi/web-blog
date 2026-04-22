// main.dart
import 'dart:math';

import 'package:australien_blog_app/pages/create_point_page.dart';
import 'package:australien_blog_app/pages/manage_points_page.dart';
import 'package:australien_blog_app/pages/sync_status_page.dart';
import 'package:australien_blog_app/services/storage_service.dart';
import 'package:australien_blog_app/services/sync_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:workmanager/workmanager.dart';
import 'colors.dart';
import 'pages/start_page.dart';
import 'pages/browse_files_page.dart';
import 'pages/settings_page.dart';
import 'providers/language_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';


final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
FlutterLocalNotificationsPlugin();

bool useModernPicker = true;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const AndroidInitializationSettings initializationSettingsAndroid =
  AndroidInitializationSettings('@mipmap/ic_launcher');

  const InitializationSettings initializationSettings =
  InitializationSettings(android: initializationSettingsAndroid);

  await flutterLocalNotificationsPlugin.initialize(initializationSettings);


  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarDividerColor: Colors.transparent,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));


  await Workmanager().initialize(
      callbackDispatcher,
      isInDebugMode: false // Set to false for release
  );

  // Register a periodic task (runs roughly every 15-30 mins depending on OS)
  await Workmanager().registerPeriodicTask(
    "1",
    "syncTask",
    frequency: const Duration(minutes: 25), // once per
    constraints: Constraints(
      networkType: NetworkType.connected, // Only run if internet is on
      requiresBatteryNotLow: true,
    ),
  );

  // This enables edge-to-edge mode for Android
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);



  final languageProvider = LanguageProvider();
  await languageProvider.load();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,   // portrait only
    // DeviceOrientation.portraitDown, // optional: allow upside-down
  ]).then((_) async {

    final prefs = await SharedPreferences.getInstance();
    baseUrl = prefs.getString('base_url') ?? baseUrl;
    authToken = prefs.getString('auth_token') ?? authToken;
    useModernPicker = prefs.getBool('use_modern_picker') ?? false;

    StorageService.updatePickerImplementation();

    await Permission.location.request();
    await Permission.accessMediaLocation.request();

    runApp(
      ChangeNotifierProvider.value(
        value: languageProvider,
        child: const MyApp(),
      ),
    );
  });

}


class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // main.dart
    return Consumer<LanguageProvider>(
      builder: (context, langProvider, child) => MaterialApp(
      locale: langProvider.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
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
    ),
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
                        AppLocalizations.of(context)!.syncSpinnerText,
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


@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    // do your sync

    if (await SyncService().hasUnsyncedChanges()) {
      bool success = await SyncService().syncFromStorage() != null;


      // Send notification
      const AndroidNotificationDetails androidPlatformChannelSpecifics =
      AndroidNotificationDetails(
          'sync_channel', 'Sync Notifications',
          channelDescription: 'Notifies when sync completes',
          importance: Importance.max,
          priority: Priority.high,
          ticker: 'ticker');
      const NotificationDetails platformChannelSpecifics =
      NotificationDetails(android: androidPlatformChannelSpecifics);

      final prefs = await SharedPreferences.getInstance();
      final lang = prefs.getString('app_language') ?? 'de';
      final isEn = lang == 'en';

      final funMessagesDE = [
        'Alle Kängurus wurden erfolgreich durchs Kabel geschubst.',
        'Deine Koalas sind sicher im Cloud-Eukalyptus gelandet.',
        'Krokodile abgewehrt, Daten erfolgreich hochgeladen.',
        'Daten-Roadtrip beendet. Alles sicher verstaut!',
        'Wombats haben deine Dateien artgerecht vergraben.',
        'Die Emus haben die Daten nach Hause gebracht.',
      ];
      final funMessagesEN = [
        'All kangaroos successfully pushed through the cable.',
        'Your koalas have safely landed in the cloud eucalyptus.',
        'Crocodiles repelled, data successfully uploaded.',
        'Data road trip complete. Everything stored safely!',
        'Wombats have buried your files in their natural habitat.',
        'The emus have brought the data home.',
      ];

      final funMessages = isEn ? funMessagesEN : funMessagesDE;
      final randomText = funMessages[Random().nextInt(funMessages.length)];

      await flutterLocalNotificationsPlugin.show(
        0,
        success
            ? (isEn ? 'Sync complete' : 'Sync abgeschlossen')
            : (isEn ? 'Sync failed' : 'Sync fehlgeschlagen'),
        success ? randomText : (isEn ? 'The kangaroos escaped.' : 'Die Kängurus sind entwischt.'),
        platformChannelSpecifics,
      );
    }

    return Future.value(true);
  });
}
