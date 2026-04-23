import 'dart:math';

import 'package:australien_blog_app/pages/blog_settings_page.dart';
import 'package:australien_blog_app/pages/create_point_page.dart';
import 'package:australien_blog_app/pages/login_page.dart';
import 'package:australien_blog_app/pages/manage_points_page.dart';
import 'package:australien_blog_app/pages/sync_status_page.dart';
import 'package:australien_blog_app/services/auth_service.dart';
import 'package:australien_blog_app/services/gps_tracking_service.dart';
import 'package:australien_blog_app/services/storage_service.dart';
import 'package:australien_blog_app/services/sync_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:workmanager/workmanager.dart';
import 'app_config.dart';
import 'colors.dart';
import 'pages/start_page.dart';
import 'pages/browse_files_page.dart';
import 'pages/settings_page.dart';
import 'providers/language_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

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

  await Workmanager().initialize(callbackDispatcher, isInDebugMode: false);

  await Workmanager().registerPeriodicTask(
    "1",
    "syncTask",
    frequency: const Duration(minutes: 25),
    constraints: Constraints(
      networkType: NetworkType.connected,
      requiresBatteryNotLow: true,
    ),
  );

  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  final languageProvider = LanguageProvider();
  await languageProvider.load();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]).then((_) async {
    final prefs = await SharedPreferences.getInstance();
    useModernPicker = prefs.getBool('use_modern_picker') ?? false;

    await AuthService().bootstrap();

    StorageService.updatePickerImplementation();

    await Permission.location.request();
    await Permission.accessMediaLocation.request();

    final gpsEnabled = prefs.getBool('gps_path_tracking') ?? false;
    if (gpsEnabled && AuthService().isLoggedIn) {
      GpsTrackingService().startTracking();
    }

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
    return Consumer<LanguageProvider>(
      builder: (context, langProvider, child) => MaterialApp(
        locale: langProvider.locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          primaryColor: primary,
          scaffoldBackgroundColor: Colors.grey[50],
          appBarTheme: const AppBarTheme(
            backgroundColor: accent,
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: true,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            labelStyle: const TextStyle(color: Colors.grey),
            floatingLabelStyle: const TextStyle(color: primary, fontWeight: FontWeight.bold),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: pale, width: 1.5),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: primary, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Colors.red, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          ),
          textSelectionTheme: const TextSelectionThemeData(
            cursorColor: primary,
            selectionColor: pale,
            selectionHandleColor: primary,
          ),
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
        home: const _AuthGate(),
        routes: {
          '/start': (context) => const StartPage(),
          '/upload_point': (context) => const AddInterestPointPage(),
          '/manage_points': (context) => const ManagePointsPage(),
          '/browse_files': (context) => const BrowseFilesPage(),
          '/settings': (context) => const SettingsPage(),
          '/blog_settings': (context) => const BlogSettingsPage(),
          '/sync_files': (context) => const SyncStatusPage(),
        },
      ),
    );
  }

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
                    color: Colors.black87,
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

/// Routes the user to the correct first screen based on auth state. Listens
/// to [AuthService] so login/logout transitions take effect immediately.
class _AuthGate extends StatefulWidget {
  const _AuthGate();
  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  @override
  void initState() {
    super.initState();
    AuthService().addListener(_onAuthChanged);
  }

  @override
  void dispose() {
    AuthService().removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (mounted) setState(() {});
    _syncGpsTracking();
  }

  Future<void> _syncGpsTracking() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool('gps_path_tracking') ?? false;
    if (enabled && AuthService().isLoggedIn) {
      GpsTrackingService().startTracking();
    } else {
      GpsTrackingService().stopTracking();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthService().isLoggedIn ? const StartPage() : const LoginPage();
  }
}

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    // Background sync needs auth to be loaded in this isolate too.
    await AuthService().bootstrap();
    if (!AuthService().isLoggedIn) return Future.value(true);

    final prefs = await SharedPreferences.getInstance();
    final gpsEnabled = prefs.getBool('gps_path_tracking') ?? false;
    if (gpsEnabled) {
      await GpsTrackingService.recordBackgroundPosition();
    }

    if (await SyncService().hasUnsyncedChanges()) {
      bool success = await SyncService().syncFromStorage() != null;

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

      final messagesDE = [
        'Daten erfolgreich hochgeladen.',
        'Synchronisation abgeschlossen.',
        'Alle Änderungen sind sicher in der Cloud.',
        'Dein Blog ist auf dem neuesten Stand.',
      ];
      final messagesEN = [
        'Data uploaded successfully.',
        'Sync complete.',
        'All your changes are safely in the cloud.',
        'Your blog is up to date.',
      ];

      final messages = isEn ? messagesEN : messagesDE;
      final randomText = messages[Random().nextInt(messages.length)];

      await flutterLocalNotificationsPlugin.show(
        0,
        success
            ? (isEn ? 'Sync complete' : 'Sync abgeschlossen')
            : (isEn ? 'Sync failed' : 'Sync fehlgeschlagen'),
        success ? randomText : (isEn ? 'Sync did not complete.' : 'Sync wurde nicht abgeschlossen.'),
        platformChannelSpecifics,
      );
    }

    return Future.value(true);
  });
}
