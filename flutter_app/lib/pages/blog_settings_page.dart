import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../api_keys.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart';
import '../model/blog.dart';
import '../services/auth_service.dart';

/// Editor for the per-blog `settings_json` document and the read password.
///
/// Uses PATCH /me/blog with a partial settings object. Server merges deeply
/// (theme/push are object-merged) so we only need to send changed fields.
class BlogSettingsPage extends StatefulWidget {
  const BlogSettingsPage({super.key});

  @override
  State<BlogSettingsPage> createState() => _BlogSettingsPageState();
}

class _BlogSettingsPageState extends State<BlogSettingsPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _subtitleCtrl = TextEditingController();
  final _dateRangeCtrl = TextEditingController();
  final _ownerCtrl = TextEditingController();
  final _pushTextCtrl = TextEditingController();
  final _themePrimaryCtrl = TextEditingController();
  final _themeAccentCtrl = TextEditingController();
  final _readPwCtrl = TextEditingController();

  String _language = 'de';
  bool _changeReadPassword = false;
  bool _clearReadPassword = false;
  bool _busy = false;
  String? _error;
  bool _hasReadPassword = false;

  @override
  void initState() {
    super.initState();
    final blog = AuthService().currentBlog;
    if (blog != null) _populate(blog);
  }

  void _populate(Blog blog) {
    _titleCtrl.text = blog.title;
    _subtitleCtrl.text = blog.subtitle ?? '';
    _dateRangeCtrl.text = blog.dateRange ?? '';
    _ownerCtrl.text = blog.ownerDisplayName ?? '';
    _pushTextCtrl.text = blog.getSetting<String>('push.notificationText', '') ?? '';
    _themePrimaryCtrl.text = blog.getSetting<String>('theme.primary', '') ?? '';
    _themeAccentCtrl.text = blog.getSetting<String>('theme.accent', '') ?? '';
    _language = blog.getSetting<String>('language', 'de') ?? 'de';
    _hasReadPassword = blog.hasReadPassword;
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _subtitleCtrl.dispose();
    _dateRangeCtrl.dispose();
    _ownerCtrl.dispose();
    _pushTextCtrl.dispose();
    _themePrimaryCtrl.dispose();
    _themeAccentCtrl.dispose();
    _readPwCtrl.dispose();
    super.dispose();
  }

  Map<String, dynamic> _buildSettingsPatch() {
    final patch = <String, dynamic>{
      'title': _titleCtrl.text.trim(),
      'subtitle': _subtitleCtrl.text.trim().isEmpty ? null : _subtitleCtrl.text.trim(),
      'dateRange': _dateRangeCtrl.text.trim().isEmpty ? null : _dateRangeCtrl.text.trim(),
      'ownerDisplayName':
          _ownerCtrl.text.trim().isEmpty ? null : _ownerCtrl.text.trim(),
      'language': _language,
    };
    final theme = <String, dynamic>{};
    if (_themePrimaryCtrl.text.trim().isNotEmpty) {
      theme['primary'] = _themePrimaryCtrl.text.trim();
    }
    if (_themeAccentCtrl.text.trim().isNotEmpty) {
      theme['accent'] = _themeAccentCtrl.text.trim();
    }
    if (theme.isNotEmpty) patch['theme'] = theme;

    final push = <String, dynamic>{};
    if (_pushTextCtrl.text.trim().isNotEmpty) {
      push['notificationText'] = _pushTextCtrl.text.trim();
    }
    if (push.isNotEmpty) patch['push'] = push;

    patch.removeWhere((_, v) => v == null);
    return patch;
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    if (!_formKey.currentState!.validate()) return;

    setState(() { _busy = true; _error = null; });
    try {
      final body = <String, dynamic>{ 'settings': _buildSettingsPatch() };
      if (_clearReadPassword) {
        body['readPassword'] = null;
      } else if (_changeReadPassword && _readPwCtrl.text.isNotEmpty) {
        body['readPassword'] = _readPwCtrl.text;
      }

      final res = await AuthService().authedRequest((token) => http.patch(
            Uri.parse('$baseUrl/me/blog'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: jsonEncode(body),
          ));

      if (res.statusCode != 200) {
        final msg = _extractError(res.body, 'Save failed (${res.statusCode})');
        setState(() => _error = msg);
        return;
      }

      final responseBody = jsonDecode(res.body);
      if (responseBody is Map && responseBody['blog'] is Map) {
        final blog = Blog.fromJson(Map<String, dynamic>.from(responseBody['blog']));
        await AuthService().updateBlog(blog);
        if (mounted) {
          setState(() {
            _hasReadPassword = blog.hasReadPassword;
            _changeReadPassword = false;
            _clearReadPassword = false;
            _readPwCtrl.clear();
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.snackSettingsSaved), backgroundColor: accent),
          );
        }
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _extractError(String body, String fallback) {
    try {
      final m = jsonDecode(body);
      if (m is Map && m['error'] is String) return m['error'] as String;
    } catch (_) {}
    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(l10n.blogSettingsTitle),
        systemOverlayStyle: const SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.transparent,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        backgroundColor: accent,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _section(l10n.blogSettingsAppearance),
              TextFormField(
                controller: _titleCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsTitleLabel,
                  prefixIcon: const Icon(Icons.title, color: primary),
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? l10n.blogSettingsTitleRequired : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _subtitleCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsSubtitleLabel,
                  prefixIcon: const Icon(Icons.short_text, color: primary),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dateRangeCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsDateRangeLabel,
                  helperText: l10n.blogSettingsDateRangeHelper,
                  prefixIcon: const Icon(Icons.calendar_month, color: primary),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _ownerCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsOwnerLabel,
                  prefixIcon: const Icon(Icons.person_outline, color: primary),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _language,
                items: const [
                  DropdownMenuItem(value: 'de', child: Text('Deutsch')),
                  DropdownMenuItem(value: 'en', child: Text('English')),
                ],
                onChanged: (v) {
                  if (v != null) setState(() => _language = v);
                },
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsLanguageLabel,
                  prefixIcon: const Icon(Icons.translate, color: primary),
                ),
              ),
              const SizedBox(height: 24),
              _section(l10n.blogSettingsThemeSection),
              TextFormField(
                controller: _themePrimaryCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsThemePrimaryLabel,
                  helperText: l10n.blogSettingsThemeHelper,
                  prefixIcon: const Icon(Icons.color_lens, color: primary),
                ),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _themeAccentCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsThemeAccentLabel,
                  prefixIcon: const Icon(Icons.color_lens_outlined, color: primary),
                ),
              ),
              const SizedBox(height: 24),
              _section(l10n.blogSettingsPushSection),
              TextFormField(
                controller: _pushTextCtrl,
                decoration: InputDecoration(
                  labelText: l10n.blogSettingsPushTextLabel,
                  helperText: l10n.blogSettingsPushTextHelper('{owner}'),
                  prefixIcon: const Icon(Icons.notifications, color: primary),
                ),
              ),
              const SizedBox(height: 24),
              _section(l10n.blogSettingsReadPwSection),
              Text(_hasReadPassword
                  ? l10n.blogSettingsReadPwHasOne
                  : l10n.blogSettingsReadPwNone),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _changeReadPassword,
                onChanged: (v) => setState(() {
                  _changeReadPassword = v;
                  if (v) _clearReadPassword = false;
                }),
                title: Text(l10n.blogSettingsChangeReadPw),
                activeThumbColor: primary,
              ),
              if (_changeReadPassword)
                TextFormField(
                  controller: _readPwCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: l10n.blogSettingsReadPwNewLabel,
                    prefixIcon: const Icon(Icons.key, color: primary),
                  ),
                ),
              if (_hasReadPassword)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _clearReadPassword,
                  onChanged: (v) => setState(() {
                    _clearReadPassword = v;
                    if (v) _changeReadPassword = false;
                  }),
                  title: Text(l10n.blogSettingsClearReadPw),
                  subtitle: Text(l10n.blogSettingsClearReadPwHelper),
                  activeThumbColor: Colors.red,
                ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: _busy ? null : _save,
                icon: _busy
                    ? const SizedBox(
                        width: 16, height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save),
                label: Text(l10n.buttonSaveSettings),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Text(label, style: Theme.of(context).textTheme.titleMedium),
    );
  }
}
