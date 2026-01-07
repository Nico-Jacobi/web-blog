import 'package:flutter/material.dart';
import '../colors.dart';
import '../strings.dart';

class InfoIcon extends StatelessWidget {
  final String infoText;

  const InfoIcon({super.key, required this.infoText});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.info_outline, size: 24, color: Colors.white),
      onPressed: () {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            backgroundColor: pale,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                Icon(Icons.info_outline, color: accent, size: 28),
                const SizedBox(width: 12),
                const Text(AppStrings.info_dialog_title),
              ],
            ),
            content: Text(
              infoText,
              style: TextStyle(color: dark, height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(AppStrings.button_close, style: TextStyle(color: accent)),
              ),
            ],
          ),
        );
      },
      tooltip: AppStrings.info_tooltip,
    );
  }
}