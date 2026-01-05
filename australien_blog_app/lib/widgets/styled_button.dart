// widgets/styled_button.dart
import 'package:flutter/material.dart';

class StyledButton extends StatelessWidget {
  final double topPercentage;
  final Color color;
  final String text;
  final IconData icon;
  final VoidCallback onPressed;
  final double screenHeight;
  final double screenWidth;

  const StyledButton({
    super.key,
    required this.topPercentage,
    required this.color,
    required this.text,
    required this.icon,
    required this.onPressed,
    required this.screenHeight,
    required this.screenWidth,
  });

  @override
  Widget build(BuildContext context) {
    double top = screenHeight * topPercentage;
    double height = screenHeight * 0.3;
    double width = screenWidth * 1;

    return Positioned(
      top: top,
      left: (screenWidth - width) / 2,
      width: width,
      height: height,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          child: ElevatedButton(
            onPressed: onPressed,
            style: ElevatedButton.styleFrom(
              backgroundColor: color,
              textStyle: const TextStyle(fontSize: 24),
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(30),
                  bottomRight: Radius.circular(30),
                ),
              ),
              elevation: 5,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 20),
                Icon(icon, color: Colors.white, size: 50),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    text,
                    style: const TextStyle(
                      fontSize: 22,
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class NonInteractiveButton extends StatelessWidget {
  final double topPercentage;
  final Color color;
  final String text;
  final double screenHeight;
  final double screenWidth;

  const NonInteractiveButton({
    super.key,
    required this.topPercentage,
    required this.color,
    required this.text,
    required this.screenHeight,
    required this.screenWidth,
  });

  @override
  Widget build(BuildContext context) {
    double top = screenHeight * topPercentage;
    double height = screenHeight * 0.25;
    double width = screenWidth * 1;

    return Positioned(
      top: top,
      left: (screenWidth - width) / 2,
      width: width,
      height: height,
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: color,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(30),
              bottomRight: Radius.circular(30),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                spreadRadius: 1,
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.only(top: 70.0),
            child: Center(
              child: Text(
                text,
                style: const TextStyle(
                  fontSize: 32,
                  color: Colors.black87,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                  fontFamily: 'Roboto',
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
