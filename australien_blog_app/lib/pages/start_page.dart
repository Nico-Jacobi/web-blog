// pages/start_page.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../widgets/styled_button.dart';

class StartPage extends StatelessWidget {
  const StartPage({super.key});

  @override
  Widget build(BuildContext context) {
    double screenHeight = MediaQuery.of(context).size.height;
    double screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      appBar: AppBar(
        systemOverlayStyle: SystemUiOverlayStyle(
          systemNavigationBarColor: Colors.blue[900],
          statusBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: Brightness.light,
          statusBarIconBrightness: Brightness.dark,
        ),
        centerTitle: true,
        backgroundColor: Colors.blue[100],
        toolbarHeight: 30,
      ),
      body: Container(
        color: Colors.green,
        child: Stack(
          children: [
            NonInteractiveButton(
              topPercentage: 0.8,
              color: Colors.blue[900]!,
              text: '',
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.55,
              color: Colors.blue[700]!,
              text: 'Einstellungen',
              icon: Icons.settings,
              onPressed: () {
                Navigator.pushNamed(context, '/settings');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.3,
              color: Colors.blue[500]!,
              text: 'Datei hochladen',
              icon: Icons.upload_file,
              onPressed: () {
                Navigator.pushNamed(context, '/upload_file');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            StyledButton(
              topPercentage: 0.05,
              color: Colors.blue[300]!,
              text: 'Dateien durchsuchen',
              icon: Icons.folder_open,
              onPressed: () {
                Navigator.pushNamed(context, '/browse_files');
              },
              screenHeight: screenHeight,
              screenWidth: screenWidth,
            ),
            NonInteractiveButton(
              topPercentage: -0.15,
              color: Colors.blue[100]!,
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
