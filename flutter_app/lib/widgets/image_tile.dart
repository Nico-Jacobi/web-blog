import 'dart:io';

import 'package:flutter/material.dart';

class ImageTile extends StatelessWidget {
  final File file;
  final VoidCallback onRemove;

  const ImageTile({required this.file, required this.onRemove, super.key});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: Image.file(
            file,
            width: 100,
            height: 100,
            fit: BoxFit.cover,
            // Decodes the image to a smaller size in memory
            cacheWidth: 200,
            cacheHeight: 200,
            // Smooth transition while loading from disk
            errorBuilder: (ctx, _, __) => Icon(Icons.broken_image),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              padding: EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: Colors.white70,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.close, color: Colors.black, size: 18),
            ),
          ),
        ),
      ],
    );
  }
}
