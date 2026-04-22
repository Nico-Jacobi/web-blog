import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../colors.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../services/auth_service.dart';
import '../widgets/styled_button.dart';

class StartPage extends StatefulWidget {
  const StartPage({super.key});

  @override
  State<StartPage> createState() => _StartPageState();
}

class _StartPageState extends State<StartPage> {
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
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    final blogTitle = AuthService().currentBlog?.title ?? l10n.appHeroTitle;

    return Scaffold(
      appBar: AppBar(
        systemOverlayStyle: SystemUiOverlayStyle(
          systemNavigationBarColor: dark,
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        centerTitle: true,
        backgroundColor: pale,
        toolbarHeight: 30,
        elevation: 0,
      ),
      body: Container(
        color: pale,
        child: Stack(
          children: [
            NonInteractiveButton(
              topPercentage: 0.8,
              color: dark,
              text: '',
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.55,
              color: accent,
              text: l10n.settingsTitle,
              icon: Icons.settings,
              onPressed: () {
                Navigator.pushNamed(context, '/settings');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.3,
              color: primary,
              text: l10n.managePointsTitle,
              icon: Icons.list_alt,
              onPressed: () {
                Navigator.pushNamed(context, '/manage_points');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.05,
              color: light,
              text: l10n.addPointButton,
              icon: Icons.add_location,
              onPressed: () {
                Navigator.pushNamed(context, '/upload_point');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            NonInteractiveButton(
              topPercentage: -0.15,
              color: pale,
              text: blogTitle,
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
          ],
        ),
      ),
    );
  }
}
