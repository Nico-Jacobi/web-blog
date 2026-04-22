import 'package:australien_blog_app/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import '../colors.dart';
import '../model/trip.dart';

class TravelMethodDialog extends StatelessWidget {
  final TripMethod? currentMethod;

  const TravelMethodDialog({
    super.key,
    this.currentMethod,
  });

  static Future<TripMethod?> show(
      BuildContext context, {
        TripMethod? currentMethod,
      }) {
    return showDialog<TripMethod>(
      context: context,
      builder: (context) => TravelMethodDialog(currentMethod: currentMethod),
    );
  }

  String _methodLabel(TripMethod method, AppLocalizations l10n) {
    switch (method) {
      case TripMethod.boat:
        return l10n.tripMethodBoat;
      case TripMethod.car:
        return l10n.tripMethodCar;
      case TripMethod.rv:
        return l10n.tripMethodRv;
      case TripMethod.plane:
        return l10n.tripMethodPlane;
      case TripMethod.foot:
        return l10n.tripMethodFoot;
      case TripMethod.misc:
        return l10n.tripMethodMisc;
      case TripMethod.bus:
        return l10n.tripMethodBus;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [dark, primary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: primary.withOpacity(0.3),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.travelMethodDialogTitle,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),

            ...TripMethod.values.map((method) {
              final isSelected = currentMethod == method;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => Navigator.pop(context, method),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? Colors.white.withOpacity(0.25)
                            : Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: isSelected
                            ? Border.all(
                          color: Colors.white.withOpacity(0.4),
                          width: 2,
                        )
                            : null,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            method.icon,
                            color: Colors.white,
                            size: 24,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              _methodLabel(method, l10n),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          if (isSelected)
                            const Icon(
                              Icons.check_circle,
                              color: Colors.white,
                              size: 24,
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
