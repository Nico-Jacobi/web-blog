# Masterplan: Settings-Panel (Dark Mode + Sprache)

## 1. Ziel & Nutzen

Ein Settings-Zahnrad-Icon oben rechts im Header öffnet ein kleines Panel, über das der Nutzer:
- **Dark / Light Mode** umschalten kann
- **Sprache** (DE / EN) wechseln kann

Die Einstellung wird in `localStorage` persistiert und sofort angewendet.

---

## 2. User Stories

| Story | Akzeptanzkriterium |
|-------|-------------------|
| Als Nutzer möchte ich Dark Mode aktivieren | `<html>` bekommt Klasse `dark`, Seite wechselt zu dunklem Theme |
| Als Nutzer möchte ich die Sprache auf EN wechseln | Alle sichtbaren Strings werden auf Englisch dargestellt |
| Als Nutzer möchte ich, dass meine Einstellungen gespeichert bleiben | Nach Reload sind Dark Mode und Sprache noch aktiv |
| Als Nutzer möchte ich das Panel schließen können | Klick außerhalb oder auf X schließt das Panel |

---

## 3. Architektur-Überblick

```
App.jsx
 └── SettingsContext (Provider)         ← neu: global state für theme + locale
      ├── Header.jsx                    ← Settings-Icon + Panel einbinden
      │    └── SettingsPanel.jsx        ← neu: Dropdown mit Toggle + Lang-Switch
      └── alle anderen Komponenten      ← nutzen useTranslation() Hook
           └── i18n/                   ← neu: translations/de.json, translations/en.json
```

### Theme-System
- Tailwind v4 `darkMode: 'class'` → `dark` Klasse auf `<html>`
- CSS-Variablen (`--bg`, `--text`, `--surface`) ergänzen das bestehende `--accent` System
- `applyAccentColor()` bleibt unverändert, wird aber Dark-Mode-aware

### i18n
- **Kein externes Package** – schlanker eigener `useTranslation()` Hook + JSON-Dateien
- Translations in `src/i18n/de.json` und `src/i18n/en.json`
- `SettingsContext` stellt `locale`, `setLocale`, `t()` bereit

---

## 4. Komponenten & Dateien

### Neu erstellen
| Datei | Zweck |
|-------|-------|
| `src/context/SettingsContext.jsx` | React Context: `theme`, `setTheme`, `locale`, `setLocale`, `t()` |
| `src/i18n/de.json` | Deutsche Übersetzungen |
| `src/i18n/en.json` | Englische Übersetzungen |
| `src/components/SettingsPanel.jsx` | UI: Zahnrad-Icon + Dropdown-Panel |

### Ändern
| Datei | Was ändert sich |
|-------|----------------|
| `src/main.jsx` | Theme-Klasse beim Init setzen (vor React-Mount, verhindert Flash) |
| `src/App.jsx` | `SettingsProvider` wrappen, Dark-Mode-Klassen hinzufügen |
| `src/index.css` | CSS-Variablen für Dark Mode definieren |
| `src/components/Header.jsx` | SettingsPanel einbinden, Strings durch `t()` ersetzen |
| `src/components/styles.js` | `sharedButtonStyle` / `sharedIconStyle` dark-mode-fähig machen |
| `src/components/Sidebar.jsx` | Strings durch `t()` ersetzen, dark-Klassen |
| `src/components/StopCard.jsx` | Strings durch `t()` ersetzen, dark-Klassen |
| `src/components/PointDetail.jsx` | Strings durch `t()` ersetzen, dark-Klassen |
| `src/components/PasswortGate.jsx` | dark-Klassen |
| `src/components/MapView.jsx` | dark-Klassen (Leaflet Tile Layer ggf. wechseln) |
| `src/controller/accentColor.js` | Dark-Mode-aware Farben ergänzen |

---

## 5. Settings-Panel UI

```
┌─────────────────────────────┐
│  ⚙ Einstellungen            │  ← Trigger: Settings-Icon im Header
├─────────────────────────────┤
│  Erscheinungsbild           │
│  ○ Hell   ● Dunkel          │  ← Radio-Buttons oder Toggle
├─────────────────────────────┤
│  Sprache                    │
│  ● Deutsch   ○ English      │  ← Radio-Buttons
└─────────────────────────────┘
```

- Positionierung: `absolute top-full right-0` unter dem Header-Icon
- Schließt sich bei Klick außerhalb (`useEffect` + `mousedown` Listener)
- Gleiches Button-Design wie bestehende Header-Buttons (`sharedButtonStyle`)

---

## 6. Dark-Mode-Strategie

### CSS-Variablen Ansatz (in index.css)
```css
:root {
  --bg-primary: theme(colors.white);
  --bg-surface: theme(colors.slate.50);
  --text-primary: theme(colors.slate.900);
  --text-muted: theme(colors.slate.500);
  --border: theme(colors.slate.200);
}

.dark {
  --bg-primary: theme(colors.slate.900);
  --bg-surface: theme(colors.slate.800);
  --text-primary: theme(colors.slate.50);
  --text-muted: theme(colors.slate.400);
  --border: theme(colors.slate.700);
}
```

Komponenten nutzen dann `bg-[var(--bg-primary)]` statt `bg-white` – oder direktes `dark:bg-slate-900`.

**Entscheidung:** Tailwind `dark:` Varianten sind einfacher zu reviewen und zu schreiben → primäre Strategie. CSS-Variablen nur wo nötig (z.B. dynamischer Accent).

### Flash of unstyled content verhindern
In `main.jsx` vor React-Mount:
```js
const saved = localStorage.getItem('theme');
if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}
```

---

## 7. i18n-Strategie

### Schlüssel-Struktur (de.json / en.json)
```json
{
  "header": {
    "loading": "Laden…"
  },
  "sidebar": {
    "journey": "Reiseverlauf",
    "stops": "Stopps"
  },
  "settings": {
    "title": "Einstellungen",
    "appearance": "Erscheinungsbild",
    "light": "Hell",
    "dark": "Dunkel",
    "language": "Sprache"
  },
  "stopCard": { ... },
  "pointDetail": { ... }
}
```

### useTranslation Hook
```js
// Liest locale aus SettingsContext, gibt t(key) zurück
const { t } = useTranslation();
t('header.loading') // → "Laden…" oder "Loading…"
```

---

## 8. Persistenz & Init

| Setting | Speicherort | Default |
|---------|-------------|---------|
| `theme` | `localStorage['theme']` | System-Präferenz (`prefers-color-scheme`) |
| `locale` | `localStorage['locale']` | `'de'` |

---

## 9. Was muss weg

### Hardcoded Strings (38 Strings → i18n-Schlüssel)

| Komponente | String | i18n-Schlüssel |
|------------|--------|----------------|
| Header.jsx:115 | `"Laden…"` | `header.loading` |
| Sidebar.jsx:56 | `"Reiseverlauf"` | `sidebar.journey` |
| Sidebar.jsx:59 | `"Stopps"` | `sidebar.stops` |
| StopCard.jsx:40 | `"Neu"` | `stopCard.new` |
| PointDetail.jsx:114 | `"Loslassen zum Neuladen"` | `pointDetail.releaseToRefresh` |
| PointDetail.jsx:114 | `"Zum Neuladen ziehen"` | `pointDetail.pullToRefresh` |
| PointDetail.jsx:135 | `"Was hier passiert ist"` | `pointDetail.whatHappened` |
| PointDetail.jsx:147 | `"Reisetag"` | `pointDetail.travelDay` |
| PointDetail.jsx:156 | `"Standort"` | `pointDetail.location` |
| PointDetail.jsx:159 | `"Breitengrad:"` | `pointDetail.latitude` |
| PointDetail.jsx:160 | `"Längengrad:"` | `pointDetail.longitude` |
| PasswortGate.jsx:14 | `"🔒 Passwort:"` | `passwordGate.title` |
| PasswortGate.jsx:20 | `"Passwort"` | `passwordGate.placeholder` |
| PasswortGate.jsx:26 | `"Zugriff verweigert!"` | `passwordGate.denied` |
| PasswortGate.jsx:28 | `"Freischalten"` | `passwordGate.unlock` |
| GalleryGrid.jsx:42 | `"Galerie"` | `gallery.title` |
| GalleryGrid.jsx:45 | `"DATEI"` | `gallery.file` |
| GalleryGrid.jsx:45 | `"DATEIEN"` | `gallery.files` |
| HeroSection.jsx:46 | `"Bild wird geladen..."` | `hero.loading` |

### Hardcoded Farb-Klassen (65+ Klassen → +dark: Variante)

Betrifft: Header, Sidebar, StopCard, PointDetail, PasswortGate, App, MapView, GalleryGrid, HeroSection, MediaLightbox, Legend

Vollständige Liste in der Impact-Analyse (Agent-Output). Zusammenfassung:
- `bg-white` → `+dark:bg-slate-900` (Hauptflächen)
- `bg-white` → `+dark:bg-slate-800` (Karten/Panels)
- `bg-slate-50` → `+dark:bg-slate-900`
- `bg-orange-50` → `+dark:bg-orange-950`
- `text-slate-900` → `+dark:text-white`
- `text-slate-700` → `+dark:text-slate-200`
- `text-slate-400` → `+dark:text-slate-500`
- `border-slate-200` → `+dark:border-slate-700`
- `border-orange-100` → `+dark:border-orange-900`

---

## 10. Aufrufer

| Was wird ersetzt | Aufrufer (Dateien) |
|------------------|--------------------|
| `SettingsContext` muss bereitgestellt werden | `main.jsx` (Provider-Wrapping) |
| `useTranslation()` Hook | Header, Sidebar, StopCard, PointDetail, PasswortGate, GalleryGrid, HeroSection |
| `dark:` Tailwind-Klassen | Header, Sidebar, StopCard, PointDetail, PasswortGate, App, MapView, GalleryGrid, HeroSection, MediaLightbox, Legend |
| `sharedButtonStyle` / `sharedIconStyle` | Header (Settings-Icon-Button), alle anderen Button-Aufrufer bleiben kompatibel |

---

## 11. Akzeptanzkriterien

- [ ] Settings-Icon sichtbar in Header oben rechts auf allen Bildschirmgrößen
- [ ] Dark Mode wechselt sofort ohne Reload, kein FOUC beim Laden
- [ ] Sprache wechselt sofort, alle Strings im sichtbaren UI sind übersetzt
- [ ] Einstellungen überleben Reload und neuen Browser-Tab
- [ ] Bestehende Accent-Color-Logik funktioniert weiterhin (in beiden Themes)
- [ ] Panel schließt sich bei Klick außerhalb
- [ ] Kein visueller Bruch auf Mobile (Header bleibt einzeilig)
