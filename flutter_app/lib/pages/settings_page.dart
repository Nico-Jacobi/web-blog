import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_keys.dart';
import '../main.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart';
import '../providers/language_provider.dart';
import '../services/sync_service.dart';
import '../services/storage_service.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _urlController = TextEditingController();
  final _tokenController = TextEditingController();
  bool _syncData = false;
  bool _useModernPicker = true;

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
      _syncData = prefs.getBool('sync_data') ?? SyncService().syncData;
      _useModernPicker = prefs.getBool('use_modern_picker') ?? true;
    });
  }

  Future<void> _saveSettings() async {
    final l10n = AppLocalizations.of(context)!;
    final prefs = await SharedPreferences.getInstance();

    // Update global variables
    baseUrl = _urlController.text;
    authToken = _tokenController.text;
    SyncService().syncData = _syncData;

    // Persist to local storage
    await prefs.setString('base_url', baseUrl);
    await prefs.setString('auth_token', authToken);
    await prefs.setBool('sync_data', _syncData);

    await prefs.setBool('use_modern_picker', _useModernPicker);
    useModernPicker = _useModernPicker; // Update global variable

    StorageService.updatePickerImplementation();

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.snackSettingsSaved),
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
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.settingsTitle),
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
                        labelText: l10n.fieldServerUrl,
                        labelStyle: const TextStyle(color: dark),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: primary, width: 2),
                        ),
                        hintText: l10n.hintServerUrl,
                        prefixIcon: const Icon(Icons.link, color: primary),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _tokenController,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: l10n.fieldAuthToken,
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
                      title: Text(l10n.deactivateSyncSetting),
                      value: _syncData,
                      activeThumbColor: primary,
                      onChanged: (bool value) {
                        setState(() {
                          _syncData = value;
                        });
                      },
                    ),
                    SwitchListTile(
                      title: Text(l10n.googlePhotoPickerSetting),
                      value: _useModernPicker,
                      activeThumbColor: primary,
                      onChanged: (bool value) {
                        setState(() {
                          _useModernPicker = value;
                        });
                      },
                    ),
                    Consumer<LanguageProvider>(
                      builder: (context, langProvider, _) {
                        return ListTile(
                          title: Text(l10n.settingsLanguage),
                          trailing: DropdownButton<String>(
                            value: langProvider.locale.languageCode,
                            items: const [
                              DropdownMenuItem(value: 'de', child: Text('Deutsch')),
                              DropdownMenuItem(value: 'en', child: Text('English')),
                            ],
                            onChanged: (code) {
                              if (code != null) langProvider.setLanguage(code);
                            },
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _saveSettings,
                        icon: const Icon(Icons.save),
                        label: Text(l10n.buttonSaveSettings),
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
                l10n.browseFilesTitle
            ),
            const SizedBox(height: 16),
            _buildNavButton(
                context,
                '/sync_files',
                Icons.sync,
                l10n.syncFilesTitle
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
