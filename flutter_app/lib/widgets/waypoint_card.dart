// widgets/waypoint_card.dart
import 'package:flutter/material.dart';
import 'package:australien_blog_app/l10n/app_localizations.dart';
import '../colors.dart';
import '../model/interest_point.dart';
import '../model/trip.dart';
import 'dashed_line_painter.dart';

/// Compact card variant for Waypoint InterestPoints (isWaypoint == true).
///
/// Renders only the order badge, a "Wegpunkt" label, the coordinates, and
/// a small action row (Position ändern, Delete). The optional [tripBefore]
/// is rendered as a tap-to-change travel-method badge above the card,
/// mirroring the layout of [PointWithRouteCard] so that reorder + method
/// switches feel consistent.
class WaypointCard extends StatelessWidget {
  final InterestPoint point;
  final int orderNumber;
  final TripElement? tripBefore;
  final VoidCallback onDelete;
  final VoidCallback onChangePosition;
  final VoidCallback? onChangeTripMethod;

  const WaypointCard({
    required Key key,
    required this.point,
    required this.orderNumber,
    this.tripBefore,
    required this.onDelete,
    required this.onChangePosition,
    this.onChangeTripMethod,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      key: key,
      children: [
        if (tripBefore != null) _buildRouteElement(),
        _buildWaypointCard(context, l10n),
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

  Widget _buildWaypointCard(BuildContext context, AppLocalizations l10n) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey[300]!, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.15),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            _buildOrderBadge(),
            const SizedBox(width: 12),
            _buildWaypointIcon(),
            const SizedBox(width: 14),
            Expanded(child: _buildWaypointInfo(l10n)),
            _buildActionButtons(l10n),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderBadge() {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.grey[400]!, Colors.grey[300]!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.3),
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

  Widget _buildWaypointIcon() {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: Colors.grey[100],
        shape: BoxShape.circle,
        border: Border.all(color: Colors.grey[300]!, width: 1),
      ),
      child: Icon(Icons.flag_outlined, color: Colors.grey[600], size: 24),
    );
  }

  Widget _buildWaypointInfo(AppLocalizations l10n) {
    final lat = point.lat?.toStringAsFixed(5) ?? '-';
    final lon = point.lon?.toStringAsFixed(5) ?? '-';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.waypointLabel,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Colors.grey[800],
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(Icons.place_outlined, size: 12, color: Colors.grey[600]),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                '$lat, $lon',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildActionButtons(AppLocalizations l10n) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          decoration: BoxDecoration(
            color: primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: IconButton(
            icon: const Icon(
              Icons.edit_location_alt_outlined,
              size: 20,
              color: primary,
            ),
            onPressed: onChangePosition,
            tooltip: l10n.buttonChangePosition,
            padding: const EdgeInsets.all(8),
            constraints: const BoxConstraints(),
          ),
        ),
        const SizedBox(width: 6),
        Container(
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: IconButton(
            icon: Icon(Icons.delete_outline, size: 20, color: Colors.red[500]),
            onPressed: onDelete,
            tooltip: l10n.buttonDelete,
            padding: const EdgeInsets.all(8),
            constraints: const BoxConstraints(),
          ),
        ),
      ],
    );
  }
}
