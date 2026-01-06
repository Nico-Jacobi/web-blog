// widgets/dashed_line_painter.dart
import 'package:flutter/material.dart';

class DashedLinePainter extends CustomPainter {
final Color color;

DashedLinePainter({required this.color});

@override
void paint(Canvas canvas, Size size) {
final paint = Paint()
..color = color
..strokeWidth = 3
..style = PaintingStyle.stroke;

const dashWidth = 8.0;
const dashSpace = 6.0;
double startY = 0;

while (startY < size.height) {
canvas.drawLine(
Offset(size.width / 2, startY),
Offset(size.width / 2, startY + dashWidth),
paint,
);
startY += dashWidth + dashSpace;
}
}

@override
bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}