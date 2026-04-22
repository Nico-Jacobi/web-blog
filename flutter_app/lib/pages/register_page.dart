import 'package:flutter/material.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart';
import '../services/auth_service.dart';
import '../services/sync_service.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _blogTitleCtrl = TextEditingController();
  final _blogSlugCtrl = TextEditingController();
  final _readPwCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    _blogTitleCtrl.dispose();
    _blogSlugCtrl.dispose();
    _readPwCtrl.dispose();
    super.dispose();
  }

  String _slugify(String s) {
    final lowered = s.toLowerCase().trim();
    final replaced = lowered.replaceAll(RegExp(r'[^a-z0-9_-]+'), '-');
    return replaced.replaceAll(RegExp(r'^-+|-+$'), '').replaceAll(RegExp(r'-{2,}'), '-');
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      await AuthService().register(
        username: _userCtrl.text.trim(),
        password: _passCtrl.text,
        blogSlug: _blogSlugCtrl.text.trim(),
        blogTitle: _blogTitleCtrl.text.trim(),
        readPassword: _readPwCtrl.text.isEmpty ? null : _readPwCtrl.text,
      );
      if (!mounted) return;
      SyncService().initializeFromServer();
      Navigator.of(context).pushNamedAndRemoveUntil('/start', (_) => false);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: _userCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.registerUsernameLabel,
                        prefixIcon: const Icon(Icons.person, color: primary),
                      ),
                      validator: (v) =>
                          v == null || v.trim().length < 3 ? l10n.registerUsernameError : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passCtrl,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: l10n.registerPasswordLabel,
                        prefixIcon: const Icon(Icons.lock, color: primary),
                      ),
                      validator: (v) =>
                          v == null || v.length < 8 ? l10n.registerPasswordError : null,
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _blogTitleCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.registerBlogTitleLabel,
                        prefixIcon: const Icon(Icons.title, color: primary),
                      ),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? l10n.registerBlogTitleError : null,
                      onChanged: (v) {
                        if (_blogSlugCtrl.text.isEmpty) {
                          _blogSlugCtrl.text = _slugify(v);
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _blogSlugCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.registerBlogSlugLabel,
                        helperText: l10n.registerBlogSlugHelper,
                        prefixIcon: const Icon(Icons.link, color: primary),
                      ),
                      validator: (v) {
                        if (v == null || v.length < 3) return l10n.registerBlogSlugError;
                        if (!RegExp(r'^[a-z0-9][a-z0-9_-]{2,31}$').hasMatch(v)) {
                          return l10n.registerBlogSlugError;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _readPwCtrl,
                      decoration: InputDecoration(
                        labelText: l10n.registerReadPasswordLabel,
                        helperText: l10n.registerReadPasswordHelper,
                        prefixIcon: const Icon(Icons.visibility_outlined, color: primary),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                    ],
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(l10n.registerSubmitButton),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _busy ? null : () => Navigator.of(context).pop(),
                      child: Text(l10n.registerBackToLogin),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
