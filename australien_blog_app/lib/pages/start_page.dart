// pages/start_page.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../colors.dart';
import '../main.dart';
import '../widgets/styled_button.dart';

class StartPage extends StatelessWidget {
  const StartPage({super.key});

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth  = MediaQuery.of(context).size.width;

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
              text: 'Settings',
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
              text: 'Manage Points',
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
              text: 'Add Point',
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
              text: 'File Storage API',
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
          ],
        ),
      ),
    );
  }
}
