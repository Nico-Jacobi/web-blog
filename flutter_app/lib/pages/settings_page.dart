import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';
import '../main.dart';
import '../strings.dart';
import '../colors.dart';
import '../services/sync_service.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _urlController = TextEditingController();
  final _tokenController = TextEditingController();
  bool _noSync = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      // Load saved values or fallback to global defaults
      _urlController.text = prefs.getString('base_url') ?? baseUrl;
      _tokenController.text = prefs.getString('auth_token') ?? authToken;
      _noSync = prefs.getBool('sync_data') ?? SyncService().syncData;
    });
  }

  Future<void> _saveSettings() async {
    final prefs = await SharedPreferences.getInstance();

    // Update global variables
    baseUrl = _urlController.text;
    authToken = _tokenController.text;
    SyncService().syncData = _noSync;

    // Persist to local storage
    await prefs.setString('base_url', baseUrl);
    await prefs.setString('auth_token', authToken);
    await prefs.setBool('sync_data', _noSync);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(AppStrings.snack_settings_saved),
          backgroundColor: accent,
        ),
      );
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text(AppStrings.settings_title),
        systemOverlayStyle: const SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        backgroundColor: accent,
        foregroundColor: Colors.white,
        elevation: 4,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Card(
              color: Colors.grey[50],
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 6,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    TextField(
                      controller: _urlController,
                      decoration: InputDecoration(
                        labelText: AppStrings.field_server_url,
                        labelStyle: const TextStyle(color: dark),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: primary, width: 2),
                        ),
                        hintText: AppStrings.hint_server_url,
                        prefixIcon: const Icon(Icons.link, color: primary),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _tokenController,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: AppStrings.field_auth_token,
                        labelStyle: const TextStyle(color: dark),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: primary, width: 2),
                        ),
                        prefixIcon: const Icon(Icons.lock, color: primary),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      title: const Text("Synchronisierung"),
                      value: _noSync,
                      activeColor: primary,
                      onChanged: (bool value) {
                        setState(() {
                          _noSync = value;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _saveSettings,
                        icon: const Icon(Icons.save),
                        label: const Text(AppStrings.button_save_settings),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            _buildNavButton(
                context,
                '/browse_files',
                Icons.folder_open,
                AppStrings.browse_files_appBar_title
            ),
            const SizedBox(height: 16),
            _buildNavButton(
                context,
                '/sync_files',
                Icons.sync,
                AppStrings.sync_files_appBar_title
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavButton(BuildContext context, String route, IconData icon, String label) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: () => Navigator.pushNamed(context, route),
        icon: Icon(icon),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: primary),
          foregroundColor: primary,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}