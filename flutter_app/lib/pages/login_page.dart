import 'package:flutter/material.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart';
import '../services/auth_service.dart';
import '../services/sync_service.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final u = _userCtrl.text.trim();
    final p = _passCtrl.text;
    if (u.isEmpty || p.isEmpty) return;
    setState(() { _busy = true; _error = null; });
    try {
      await AuthService().login(u, p);
      if (!mounted) return;
      // Pull blog data after login (best-effort, non-blocking).
      SyncService().initializeFromServer()
          .catchError((e) { debugPrint('[init] $e'); return false; });
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
      appBar: AppBar(title: Text(l10n.loginTitle)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _userCtrl,
                    autofillHints: const [AutofillHints.username],
                    decoration: InputDecoration(
                      labelText: l10n.loginUsernameLabel,
                      prefixIcon: const Icon(Icons.person, color: primary),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passCtrl,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(
                      labelText: l10n.loginPasswordLabel,
                      prefixIcon: const Icon(Icons.lock, color: primary),
                    ),
                    onSubmitted: (_) => _submit(),
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
                        : Text(l10n.loginButton),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const RegisterPage()),
                            ),
                    child: Text(l10n.loginNoAccountLink),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
