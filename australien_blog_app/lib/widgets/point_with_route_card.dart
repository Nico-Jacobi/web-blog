// widgets/point_with_route_card.dart
import 'dart:io';
import 'package:flutter/material.dart';
import '../colors.dart';
import '../model/interest_point.dart';
import '../widgets/dashed_line_painter.dart';

class PointWithRouteCard extends StatelessWidget {
  final InterestPoint point;
  final int orderNumber;
  final TripElement? tripBefore;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onChangeTripMethod;

  const PointWithRouteCard({
    required Key key,
    required this.point,
    required this.orderNumber,
    this.tripBefore,
    required this.onEdit,
    required this.onDelete,
    this.onChangeTripMethod,
  }) : super(key: key);

  String _formatDate(String? date) {
    if (date == null) return '';
    // Remove year if present (assumes format contains year at end)
    final parts = date.split(' ');
    if (parts.length > 2) {
      return '${parts[0]} ${parts[1]}'; // e.g., "Jan 15"
    }
    return date;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      children: [
        if (tripBefore != null) _buildRouteElement(),
        _buildPointCard(),
      ],
    );
  }

  Widget _buildRouteElement() {
    return Container(
      height: 70,
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const SizedBox(width: 54),
          Expanded(
            child: CustomPaint(
              painter: DashedLinePainter(color: light),
              child: Center(
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: onChangeTripMethod,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: light, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: primary.withOpacity(0.15),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Icon(
                        tripBefore!.method.icon,
                        color: primary,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 100),
        ],
      ),
    );
  }

  Widget _buildPointCard() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: primary.withOpacity(0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,

        child: InkWell(
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          onTap: onEdit, // CARD tap still goes to edit
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                _buildOrderBadge(),
                const SizedBox(width: 12),
                _buildThumbnail(),
                const SizedBox(width: 14),
                Expanded(child: _buildPointInfo()),
                _buildActionButtons(), // now only delete button
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: IconButton(
            icon: Icon(Icons.delete_outline, size: 20, color: Colors.red[500]),
            onPressed: onDelete,
            tooltip: 'Delete',
            padding: const EdgeInsets.all(8),
            constraints: const BoxConstraints(),
          ),
        ),
      ],
    );
  }


  Widget _buildOrderBadge() {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [primary, light],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: primary.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Center(
        child: Text(
          '$orderNumber',
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildThumbnail() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: light, width: 2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 70,
          height: 70,
          color: pale,
          child: point.titleImagePath.isNotEmpty
              ? Image.file(
            File(point.titleImagePath),
            fit: BoxFit.cover,
            cacheWidth: 140,
            cacheHeight: 140,
            errorBuilder: (_, __, ___) => Icon(
              Icons.broken_image_outlined,
              color: Colors.orange[300],
              size: 28,
            ),
          )
              : Icon(
            Icons.image_outlined,
            color: Colors.orange[300],
            size: 28,
          ),
        ),
      ),
    );
  }

  Widget _buildPointInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          point.name.isNotEmpty ? point.name : 'Unnamed',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        if (point.date != null) ...[
          Row(
            children: [
              Icon(Icons.calendar_today_outlined,
                  size: 12, color: Colors.grey[600]),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  _formatDate(point.date),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[600],
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

}
