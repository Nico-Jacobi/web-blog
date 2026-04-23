# Multi-Language Support (i18n) - Masterplan

## Status
- [x] Phase 1: Masterplan (in Arbeit)
- [x] Phase 1b: Impact-Analyse
- [ ] Phase 2: Implementierungspläne
- [ ] Phase 2b: Sub-Pläne (falls nötig)
- [ ] Implementierung gestartet
- [ ] Cleanup-Validierung
- [ ] Feature abgeschlossen

---

## 1. Ziel

**Was soll erreicht werden?**
Website und Flutter App sollen vollständig internationalisiert werden: alle UI-Strings werden aus dem Code extrahiert und über ein Übersetzungssystem verwaltet. Nutzer können die Sprache auf der Website per Toggle im Header und in der App über die Einstellungsseite wechseln. Minimum: Deutsch (de) und Englisch (en).

**Anwendungsfall:**
- Ein englischsprachiger Besucher öffnet die Website und schaltet per Header-Button auf Englisch um – alle Labels, Buttons und Meldungen erscheinen sofort auf Englisch.
- Ein Nutzer der App öffnet die Einstellungsseite, wählt "English" aus dem Dropdown – die gesamte App-UI (Seiten, Buttons, Fehlertexte) wechselt sofort die Sprache.

---

## 2. Ist-Zustand

**Aktuelle Implementierung:**

*Website (React 19 + Vite):*
- Strings vollständig hardcoded in JSX-Komponenten
- Keinerlei i18n-Infrastruktur vorhanden
- Sprache implizit Deutsch

*Flutter App:*
- `flutter_app/lib/strings.dart` — zentrale Konstanten-Klasse `AppStrings` mit 152 Einträgen, alles Deutsch
- Settings-Page vorhanden (`settings_page.dart`), speichert in SharedPreferences
- Kein Lokalisierungssystem, kein Sprach-Selector

**Probleme mit aktuellem Ansatz:**
- Strings in verschiedenen Sprachen nicht möglich
- Website-Strings über 13 Komponenten verstreut, kein zentraler Zugriff
- `strings.dart` ist statisch — kein Runtime-Sprachswitch möglich

**Relevante Dateien:**
- `flutter_app/lib/strings.dart` — alle App-Strings (wird ersetzt)
- `flutter_app/lib/pages/settings_page.dart` — Settings UI (wird erweitert)
- `flutter_app/pubspec.yaml` — Dependencies (neue Packages nötig)
- `website/src/components/` — 13 Komponenten mit hardcodierten Strings
- `website/src/controller/routeStyles.js` — Reisemittel-Labels (hardcoded Deutsch)

---

## 3. Soll-Zustand

**Gewünschtes Verhalten:**

*Website:*
- `react-i18next` als i18n-Framework
- Übersetzungsdateien: `website/public/locales/de/translation.json` und `website/public/locales/en/translation.json`
- Language-Toggle-Button im Header (DE / EN)
- Gewählte Sprache wird in `localStorage` gespeichert und beim nächsten Besuch wiederhergestellt
- Alle UI-Strings in allen 13 Komponenten über `t('key')` Hook referenziert

*Flutter App:*
- Offizielles Flutter-Lokalisierungssystem: `flutter_localizations` + `intl` Package
- ARB-Dateien: `flutter_app/lib/l10n/app_de.arb` und `flutter_app/lib/l10n/app_en.arb`
- Code-Generator erzeugt typisierte `AppLocalizations`-Klasse
- `strings.dart` wird vollständig gelöscht, alle Referenzen auf `AppLocalizations.of(context)` umgestellt
- Settings-Page: Dropdown/Segment-Control zur Sprachauswahl (Deutsch / English)
- Gewählte Sprache wird in SharedPreferences gespeichert und beim App-Start wiederhergestellt
- `MaterialApp` erhält `locale` + `localizationsDelegates` aus Provider/State

**User Flow (Website):**
1. Nutzer öffnet Website → Sprache aus localStorage geladen (default: de)
2. Nutzer klickt Language-Toggle im Header (z.B. "EN")
3. Alle Texte wechseln sofort (kein Reload nötig)
4. Sprache wird in localStorage gespeichert

**User Flow (Flutter App):**
1. App startet → SharedPreferences Sprache laden (default: de)
2. Nutzer öffnet Settings → sieht Sprach-Selector
3. Nutzer wählt "English"
4. App-UI wechselt sofort (inkl. aktuelle Seite)
5. Einstellung bleibt nach App-Neustart erhalten

---

## 4. Architektur-Entscheidungen

### Website: `react-i18next`
- **Begründung:** Standard für React i18n, große Community, unterstützt JSON-Übersetzungsdateien (lazy loaded), einfacher `useTranslation()` Hook, kein Runtime-Overhead wenn Sprache bereits geladen
- **Alternativen verworfen:** `react-intl` (komplexer, mehr Boilerplate), `next-intl` (nur Next.js)
- **Übersetzungsdateien:** `public/locales/{lang}/translation.json` — werden per HTTP geladen (kein Bundle-Bloat)
- **Initialisierung:** `i18n.js` Konfigurationsdatei, LanguageDetector für localStorage

### Flutter: Offizielles `flutter_localizations` + `intl`
- **Begründung:** Offizieller Flutter-Weg, code-generierte typisierte Klassen (keine String-Key-Tippfehler), IDE-Autovervollständigung, ARB-Format ist Industriestandard
- **Alternativen verworfen:** `easy_localization` (Community-Package, overhead), `get` i18n (zu sehr an GetX gekoppelt)
- **Sprachverwaltung:** `LanguageProvider` (Provider-basiert) hält aktuelle `Locale`, `MaterialApp.locale` reagiert darauf
- **Persistenz:** SharedPreferences Key `app_language` speichert Sprachcode (z.B. `"en"`)

### Sprachkodierung
- Sprachcodes: `de` (Deutsch), `en` (Englisch)
- Keys: `snake_case`, hierarchisch per Sektion (z.B. `settings.language`, `common.loading`)

---

## 5. Beachtenswertes

### Performance
- Website: Übersetzungsdateien werden lazy per HTTP geladen → beim ersten Sprachswitch kurze Ladezeit (negligible bei kleinen JSON-Files)
- Flutter: ARB-Dateien werden in den App-Bundle eingebaut → kein Netzwerk-Overhead

### Migration (Flutter)
- `strings.dart` hat 152 Einträge — alle müssen als ARB-Keys in `app_de.arb` + `app_en.arb` übernommen werden
- Alle Verwendungsstellen von `AppStrings.xyz` müssen auf `AppLocalizations.of(context)!.xyz` umgestellt werden (Impact-Analyse zeigt Umfang)
- `context` muss an alle betroffenen Widget-Build-Methoden verfügbar sein

### Besonderheiten
- Reisemittel-Labels (Auto, Bus, Wohnmobil etc.) existieren sowohl in der Website (`routeStyles.js`) als auch in der App (`strings.dart`) — beide müssen separat übersetzt werden
- Website hat keinen `context` wie Flutter — Sprache ist eine globale i18n-Instanz

---

## 6. Abhängigkeiten

**Neue Packages:**

*Website:*
```
i18next
react-i18next
i18next-http-backend
i18next-browser-languagedetector
```

*Flutter App:*
```yaml
flutter_localizations: sdk: flutter
intl: ^0.19.0
```
(+ `generate: true` in pubspec.yaml)

**Voraussetzungen:** Keine — Feature ist unabhängig von anderen laufenden Entwicklungen.

**Betroffene Features:** Alle UI-Komponenten (Website + App) werden berührt, aber nur Strings ersetzt — keine Logik-Änderungen.

---

## 7. Nicht-Ziele

**Explizit NICHT Teil dieses Features:**
- Übersetzung von Blog-Inhalten (Beschreibungstexte der Reisestopps) — nur UI-Strings
- Mehr als 2 Sprachen initial (de + en)
- RTL-Sprachunterstützung
- Automatische Spracherkennung per Browser/Device-Locale (nice-to-have, kann später hinzugefügt werden)
- Server-seitige i18n (fileserver.js ist unberührt)
- Übersetzungs-Management-Tool (Crowdin, Lokalise etc.)

**Spätere Erweiterungen (out of scope):**
- Weitere Sprachen (fr, es, …)
- Automatische Browser/Device-Spracherkennung als Default
- Plural-Formen und Formatierungen (Datum, Zahlen)

---

## 8. Offene Fragen

- [x] Getrennte Pläne für App und Website? → **Ja**, sind technisch unabhängig
- [ ] Welche Sprache soll Default sein wenn keine gespeichert? → Deutsch (`de`) empfohlen (da alles aktuell Deutsch)
- [ ] Soll die Website-Sprache Browser-Sprache detektieren oder immer Deutsch als Default? → Empfehlung: immer Deutsch als Default (simpler, Blog ist primär deutsch)
- [ ] Englische Übersetzungen: Wer liefert diese? → User muss Englisch-Strings bereitstellen oder Claude übersetzt initial (kann später korrigiert werden)

---

## 9. Was muss weg (Impact-Analyse)

> **Hinweis:** Diese Sektion wird vom `impact-analyzer` Agent automatisch befüllt.

### 9.1 Zu löschende Dateien
| Datei | Grund für Löschung |
|-------|-------------------|
| `flutter_app/lib/strings.dart` | Wird vollständig durch generierte `AppLocalizations` ersetzt |

### 9.2 Zu löschender Code (Methoden, Klassen, Funktionen)
| Datei | Element | Grund |
|-------|---------|-------|
| `flutter_app/lib/strings.dart` | gesamte `AppStrings`-Klasse (83 Keys) | Ersetzt durch generierte `AppLocalizations` |

### 9.3 Veraltete Patterns die ersetzt werden
| Altes Pattern | Neues Pattern | Betroffene Stellen |
|---------------|---------------|-------------------|
| `AppStrings.xyz` (Flutter) | `AppLocalizations.of(context)!.xyz` | 10 Pages + 3 Widgets (82 Verwendungen) |
| Hardcoded String-Literale in JSX | `t('key')` via `useTranslation()` Hook | 8 Website-Komponenten + routeStyles.js |
| `label: 'Auto'` in routeStyles.js | `labelKey: 'travel.car'` + `t()` beim Rendern | website/src/model/routeStyles.js |

---

## 10. Betroffene Aufrufer (Impact-Analyse)

> **Hinweis:** Vom `impact-analyzer` Agent befüllt.

### 10.1 Direkte Aufrufer — Flutter `AppStrings`
| Datei | Aufrufe | Muss geändert zu |
|-------|---------|-----------------|
| `flutter_app/lib/pages/create_point_page.dart` | 22 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/sync_status_page.dart` | 19 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/browse_files_page.dart` | 16 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/manage_points_page.dart` | 14 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/create_waypoint_page.dart` | 9 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/settings_page.dart` | 9 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/coordinate_picker.dart` | 4 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/pages/start_page.dart` | 4 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/model/trip.dart` | 7 Stellen (tripMethod labels) | `AppLocalizations.of(context)!.xyz` via Parameter |
| `flutter_app/lib/main.dart` | 1 Stelle + 6 hardcoded Notification-Strings | `AppLocalizations` + ARB-Keys |
| `flutter_app/lib/widgets/waypoint_card.dart` | 3 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/widgets/info_icon.dart` | 3 Stellen | `AppLocalizations.of(context)!.xyz` |
| `flutter_app/lib/widgets/travel_method_dialog.dart` | 1 Stelle | `AppLocalizations.of(context)!.xyz` |

### 10.1b Direkte Aufrufer — Website Hardcoded Strings
| Datei | Strings | Muss geändert zu |
|-------|---------|-----------------|
| `website/src/components/Header.jsx` | Titel, Datum, "Laden…" | `t('header.title')` etc. |
| `website/src/components/Sidebar.jsx` | "Reiseverlauf", " Stopps" | `t('sidebar.heading')` etc. |
| `website/src/components/PointDetail.jsx` | 5 Strings (Überschriften, Pull-to-reload) | `t('detail.xyz')` |
| `website/src/components/PasswortGate.jsx` | 4 Strings | `t('auth.xyz')` |
| `website/src/components/GalleryGrid.jsx` | "Galerie", "DATEI"/"DATEIEN" | `t('gallery.heading')`, `t('gallery.files', {count})` |
| `website/src/components/HeroSection.jsx` | "Bild wird geladen..." | `t('common.imageLoading')` |
| `website/src/components/mapHelpers.js` | "Loading...", "No date", "Details" | `i18n.t('map.xyz')` (außerhalb React) |
| `website/src/components/StopCard.jsx` | "Neu" Badge | `t('stopcard.new')` |
| `website/src/model/routeStyles.js` | 7 Reisemittel-Labels | `labelKey: 'travel.car'` etc. |

### 10.2 Transitive Aufrufer
| Datei | Aufrufkette | Muss geändert werden? |
|-------|-------------|----------------------|
| `flutter_app/lib/model/trip.dart` | `tripMethod → label` wird in Pages gerendert | Ja — Label-Erzeugung braucht `context` oder Locale-String |

### 10.3 Besondere Fälle
- `flutter_app/lib/pages/create_point_page.dart:466` — hardcodierter englischer Fallback-String `"Error saving data"` → ebenfalls in ARB aufnehmen
- `flutter_app/lib/model/trip.dart` — `tripMethod`-Labels direkt im Model → Model-Methode muss `BuildContext` als Parameter erhalten oder Labels werden in der UI aufgelöst

### 10.3 Betroffene Tests
| Test-Datei | Beschreibung | Anpassung nötig |
|------------|--------------|-----------------|
| (keine Tests vorhanden) | | |

---

## 11. Akzeptanzkriterien

### Funktionale Kriterien
- [ ] Website zeigt alle UI-Texte auf Deutsch (de) per Default
- [ ] Website Language-Toggle schaltet zwischen DE und EN um (alle Texte wechseln)
- [ ] Website-Sprachauswahl bleibt nach Seiten-Reload erhalten (localStorage)
- [ ] Flutter App zeigt alle UI-Texte auf Deutsch per Default
- [ ] Flutter Settings-Page enthält Sprach-Selector (DE / EN)
- [ ] Flutter App wechselt Sprache sofort nach Auswahl (kein Restart nötig)
- [ ] Flutter Sprachauswahl bleibt nach App-Neustart erhalten (SharedPreferences)
- [ ] Alle Reisemittel-Labels (Auto, Bus, etc.) sind in beiden Sprachen korrekt

### Technische Kriterien (automatisch geprüft)
- [ ] `strings.dart` vollständig gelöscht, kein Import davon mehr vorhanden
- [ ] Kein direkter Einsatz von `AppStrings` mehr im Flutter-Code
- [ ] Keine hardcodierten deutschen Strings mehr in Website-JSX-Komponenten
- [ ] Build läuft fehlerfrei (Website + Flutter)
- [ ] Keine `// TODO` Kommentare im neuen Code

### Qualitätskriterien
- [ ] Übersetzungs-Keys sind konsistent und hierarchisch (z.B. `settings.language`, `common.error`)
- [ ] Keys zwischen Website und App sind thematisch ähnlich (auch wenn technisch getrennt)
- [ ] Keine Duplikation: jeder String hat genau einen Key

---

## 12. Nächste Schritte

Nach Freigabe dieses Masterplans:
1. `impact-analyzer` ausführen → Sektionen 9.2, 10.1, 10.2 befüllen
2. Recherche zu Best Practices (i18next Setup, ARB-Format)
3. Erstellung der Implementierungspläne:
   - `01_Website_Foundation.md` — i18n Setup, Übersetzungsdateien, i18n.js
   - `02_Website_Components.md` — Alle 13 Komponenten umstellen
   - `03_App_Foundation.md` — flutter_localizations Setup, ARB-Dateien, LanguageProvider
   - `04_App_Migration.md` — strings.dart ersetzen, alle Aufrufer umstellen
4. Größen-Check pro Plan → ggf. Sub-Pläne
5. Kohärenz-Check aller Pläne
6. Start der Implementierung

---

*Erstellt am: 2026-04-22*
*Letzte Aktualisierung: 2026-04-22*
