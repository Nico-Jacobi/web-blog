# Plan 02: Website Komponenten Migration

## Ziel
Alle 9 Dateien mit hardcodierten Strings auf `react-i18next` umstellen. Jede Komponente bekommt den `useTranslation()` Hook; `mapHelpers.js` und `routeStyles.js` werden speziell behandelt da sie kein React-Kontext haben.

## Schnittstellen

### Input (Voraussetzungen)
- Plan 01 abgeschlossen: `i18n.js` existiert, Übersetzungsdateien vorhanden, `useTranslation()` verfügbar

### Output
- Alle 9 Dateien nutzen i18n-Keys
- Keine hardcodierten deutschen oder englischen UI-Strings mehr in Website-Komponenten
- routeStyles.js liefert `labelKey` statt `label` (Breaking Change für Konsumenten)

---

## Implementierungsschritte

### Schritt 1: `Header.jsx` migrieren
`useTranslation` importieren, Strings ersetzen:
```jsx
const { t } = useTranslation();
// "Jennys & Leons " + "Australien Trip" → t('header.title')
// "Nov '25 - Jan '26"                  → t('header.dateRange')
// "Laden…"                             → t('header.loading')
```

### Schritt 2: `Sidebar.jsx` migrieren
```jsx
const { t } = useTranslation();
// "Reiseverlauf" → t('sidebar.heading')
// " Stopps"      → t('sidebar.stops')   (Leerzeichen vor dem Wort im Key weglassen, im JSX setzen falls nötig)
```

### Schritt 3: `PointDetail.jsx` migrieren
```jsx
const { t } = useTranslation();
// "Loslassen zum Neuladen" → t('detail.pullRelease')
// "Zum Neuladen ziehen"   → t('detail.pullPull')
// "Was hier passiert ist" → t('detail.descriptionHeading')
// "Reisetag"              → t('detail.dayHeading')
// "Standort"              → t('detail.locationHeading')
// "Breitengrad:"          → t('detail.lat')
// "Längengrad:"           → t('detail.lon')
```

### Schritt 4: `PasswortGate.jsx` migrieren
```jsx
const { t } = useTranslation();
// "🔒 Passwort:" → t('auth.heading')
// "Passwort"     → t('auth.placeholder')
// "Zugriff verweigert!" → t('auth.error')
// "Freischalten"        → t('auth.submit')
```

### Schritt 5: `GalleryGrid.jsx` migrieren
```jsx
const { t } = useTranslation();
// "Galerie"         → t('gallery.heading')
// "DATEI"/"DATEIEN" → t('gallery.file', { count: fileCount })
//   → i18next Plural: de.json hat "file_one"/"file_other", automatisch aufgelöst
```
Übersetzungsdatei-Eintrag (bereits in Plan 01 so definiert):
```json
"file_one": "DATEI",
"file_other": "DATEIEN"
```

### Schritt 6: `HeroSection.jsx` migrieren
```jsx
const { t } = useTranslation();
// "Bild wird geladen..." → t('common.imageLoading')
```

### Schritt 7: `StopCard.jsx` migrieren
```jsx
const { t } = useTranslation();
// "Neu" → t('common.new')
```

### Schritt 8: `mapHelpers.js` migrieren (kein React-Kontext)
`mapHelpers.js` ist eine reguläre JS-Datei, kein Komponente → kein `useTranslation` Hook.
Stattdessen: `i18n`-Instanz direkt importieren.
```js
import i18n from '../i18n';
// "Loading..." → i18n.t('map.loading')
// "No date"   → i18n.t('map.noDate')
// "Details"   → i18n.t('map.details')
```

### Schritt 9: `routeStyles.js` migrieren (Daten-Objekt)
`routeStyles.js` exportiert ein Array von Objekten mit `label`. Da es kein React ist, aber `label` in Komponenten gerendert wird:
- `label` → `labelKey` umbenennen (i18n-Key statt Text)
- Alle Konsumenten die `style.label` nutzen müssen auf `t(style.labelKey)` umgestellt werden

```js
// Vorher:
{ id: 'car', label: 'Auto', ... }

// Nachher:
{ id: 'car', labelKey: 'travel.car', ... }
```

**Konsumenten von `style.label` finden und anpassen:**
- Einziger Konsument: `website/src/components/Legend.jsx:29` — dort `t()` Hook ergänzen:
  ```jsx
  const { t } = useTranslation();
  // style.label → t(style.labelKey)
  ```

---

## Geänderte Dateien
| Datei | Änderung |
|-------|---------|
| `website/src/components/Header.jsx` | `useTranslation`, 3 Strings |
| `website/src/components/Sidebar.jsx` | `useTranslation`, 2 Strings |
| `website/src/components/PointDetail.jsx` | `useTranslation`, 7 Strings |
| `website/src/components/PasswortGate.jsx` | `useTranslation`, 4 Strings |
| `website/src/components/GalleryGrid.jsx` | `useTranslation`, 2 Strings (mit Plural) |
| `website/src/components/HeroSection.jsx` | `useTranslation`, 1 String |
| `website/src/components/StopCard.jsx` | `useTranslation`, 1 String |
| `website/src/components/mapHelpers.js` | direkter `i18n.t()` Import, 3 Strings |
| `website/src/model/routeStyles.js` | `label` → `labelKey` |
| `website/src/components/Legend.jsx` | `useTranslation`, `style.label` → `t(style.labelKey)` |

## Keine neuen Dateien

## Größen-Check
- Neue Dateien: 0 ✓
- Geänderte Dateien: 9 ✓ (unter Schwellwert 10)
- Implementierungsschritte: 9 — knapp über Schwellwert, aber jeder Schritt ist trivial (nur String-Ersetzungen), kein Sub-Plan nötig

## Verifikation
- [ ] Alle deutschen Strings korrekt auf der Website (de-Mode)
- [ ] Nach Language-Toggle alle englischen Strings korrekt
- [ ] Plural funktioniert: "1 DATEI" / "5 DATEIEN" (de) und "1 FILE" / "5 FILES" (en)
- [ ] Reisemittel-Labels (Auto/Car etc.) korrekt in beiden Sprachen
- [ ] Karten-Popups zeigen korrekte Sprache
- [ ] Kein hardcodierter String mehr in den 9 Dateien (grep nach deutschen Wörtern)

---
*Plan 02 von 5 | Erstellt: 2026-04-22*
