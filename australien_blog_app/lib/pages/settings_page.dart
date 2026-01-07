import 'package:flutter/material.dart';
import '../api_keys.dart';
import '../main.dart';
import '../strings.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _urlController = TextEditingController(text: baseUrl);
  final _tokenController = TextEditingController(text: authToken);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.settings_title),
        backgroundColor: accent_color,
        elevation: 4,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Card(
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
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        hintText: AppStrings.hint_server_url,
                        prefixIcon: const Icon(Icons.link),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _tokenController,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: AppStrings.field_auth_token,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        prefixIcon: const Icon(Icons.lock),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  baseUrl = _urlController.text;
                  authToken = _tokenController.text;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text(AppStrings.snack_settings_saved)),
                  );
                },
                icon: const Icon(Icons.save),
                label: const Text(AppStrings.button_save_settings),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accent_color,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pushNamed(context, '/browse_files');
                },
                icon: const Icon(Icons.folder_open),
                label: const Text(AppStrings.browse_files_appBar_title),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: accent_color),
                  foregroundColor: accent_color,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}