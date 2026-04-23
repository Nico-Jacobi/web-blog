# Plan 01: Website i18n Foundation

## Ziel
i18next-Infrastruktur aufsetzen: Packages installieren, Konfiguration erstellen, Übersetzungsdateien (de + en) anlegen, Language-Toggle-Komponente bauen und in Header integrieren.

## Schnittstellen

### Input (Voraussetzungen)
- Keine vorherigen Pläne nötig, dieser Plan ist der erste

### Output (für Plan 02)
- `website/src/i18n.js` — initialisierte i18n-Instanz, importierbar in allen Komponenten
- `website/public/locales/de/translation.json` — alle deutschen Keys
- `website/public/locales/en/translation.json` — alle englischen Keys
- `useTranslation()` Hook aus `react-i18next` verfügbar in allen Komponenten
- `LanguageToggle`-Komponente existiert und ist im Header eingebaut

---

## Implementierungsschritte

### Schritt 1: Packages installieren
```bash
cd website
npm install i18next react-i18next i18next-http-backend i18next-browser-languagedetector
```

### Schritt 2: `website/src/i18n.js` erstellen
Neue Datei:
```js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: ['de', 'en'],
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18n_language',
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

### Schritt 3: `website/public/locales/de/translation.json` erstellen
```json
{
  "header": {
    "title": "Jennys & Leons Australien Trip",
    "dateRange": "Nov '25 - Jan '26",
    "loading": "Laden…"
  },
  "sidebar": {
    "heading": "Reiseverlauf",
    "stops": "Stopps"
  },
  "detail": {
    "pullRelease": "Loslassen zum Neuladen",
    "pullPull": "Zum Neuladen ziehen",
    "descriptionHeading": "Was hier passiert ist",
    "dayHeading": "Reisetag",
    "locationHeading": "Standort",
    "lat": "Breitengrad:",
    "lon": "Längengrad:"
  },
  "auth": {
    "heading": "🔒 Passwort:",
    "placeholder": "Passwort",
    "error": "Zugriff verweigert!",
    "submit": "Freischalten"
  },
  "gallery": {
    "heading": "Galerie",
    "file_one": "DATEI",
    "file_other": "DATEIEN"
  },
  "common": {
    "imageLoading": "Bild wird geladen...",
    "new": "Neu"
  },
  "map": {
    "loading": "Lädt...",
    "noDate": "Kein Datum",
    "details": "Details"
  },
  "travel": {
    "car": "Auto",
    "rv": "Wohnmobil",
    "bus": "Bus",
    "foot": "Zu Fuß",
    "boat": "Boot",
    "plane": "Flugzeug",
    "misc": "Sonstige"
  }
}
```

### Schritt 4: `website/public/locales/en/translation.json` erstellen
```json
{
  "header": {
    "title": "Jenny's & Leon's Australia Trip",
    "dateRange": "Nov '25 - Jan '26",
    "loading": "Loading…"
  },
  "sidebar": {
    "heading": "Travel Route",
    "stops": "Stops"
  },
  "detail": {
    "pullRelease": "Release to reload",
    "pullPull": "Pull to reload",
    "descriptionHeading": "What happened here",
    "dayHeading": "Travel Day",
    "locationHeading": "Location",
    "lat": "Latitude:",
    "lon": "Longitude:"
  },
  "auth": {
    "heading": "🔒 Password:",
    "placeholder": "Password",
    "error": "Access denied!",
    "submit": "Unlock"
  },
  "gallery": {
    "heading": "Gallery",
    "file_one": "FILE",
    "file_other": "FILES"
  },
  "common": {
    "imageLoading": "Loading image...",
    "new": "New"
  },
  "map": {
    "loading": "Loading...",
    "noDate": "No date",
    "details": "Details"
  },
  "travel": {
    "car": "Car",
    "rv": "Motorhome",
    "bus": "Bus",
    "foot": "On foot",
    "boat": "Boat",
    "plane": "Plane",
    "misc": "Other"
  }
}
```

### Schritt 5: `website/src/main.jsx` — i18n importieren
Ganz oben in `main.jsx` (vor dem React-Import oder direkt danach) hinzufügen:
```js
import './i18n';
```
Das reicht — i18n initialisiert sich selbst beim Import.

### Schritt 6: `website/src/components/LanguageToggle.jsx` erstellen
Neue Datei:
```jsx
import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'de';

  const toggle = () => {
    const next = current === 'de' ? 'en' : 'de';
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="text-sm font-medium px-2 py-1 rounded border border-white/30 text-white hover:bg-white/10 transition-colors"
      aria-label="Switch language"
    >
      {current === 'de' ? 'EN' : 'DE'}
    </button>
  );
}
```

### Schritt 7: `LanguageToggle` in `Header.jsx` einbauen
- Import von `LanguageToggle` hinzufügen
- Komponente im Header-JSX platzieren (neben dem Titel, oben rechts oder in der Headerleiste)
- Kein useTranslation im Header selbst nötig für diesen Schritt (kommt in Plan 02)

---

## Neue Dateien
| Datei | Beschreibung |
|-------|-------------|
| `website/src/i18n.js` | i18n-Konfiguration |
| `website/public/locales/de/translation.json` | Deutsche Übersetzungen |
| `website/public/locales/en/translation.json` | Englische Übersetzungen |
| `website/src/components/LanguageToggle.jsx` | Sprach-Toggle-Button |

## Geänderte Dateien
| Datei | Änderung |
|-------|---------|
| `website/src/main.jsx` | `import './i18n'` hinzufügen |
| `website/src/components/Header.jsx` | `LanguageToggle` importieren und einbauen |

## Größen-Check
- Neue Dateien: 4 ✓ (unter Schwellwert 5)
- Geänderte Dateien: 2 ✓ (unter Schwellwert 10)
- Implementierungsschritte: 7 ✓ (unter Schwellwert 8)

## Verifikation
- [ ] `npm run dev` startet fehlerfrei
- [ ] Browser-Console zeigt keine i18n-Fehler
- [ ] Network-Tab zeigt Request auf `/locales/de/translation.json`
- [ ] Language-Toggle-Button erscheint im Header
- [ ] Klick auf Toggle wechselt Button-Text zwischen "DE" und "EN"
- [ ] localStorage enthält `i18n_language` nach Sprachswitch

---
*Plan 01 von 5 | Erstellt: 2026-04-22*
