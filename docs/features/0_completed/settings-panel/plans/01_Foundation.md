# Plan 01: Foundation (SettingsContext + i18n + Init)

## Ziel
Globalen State für Theme und Locale bereitstellen, i18n-Infrastruktur aufbauen, FOUC verhindern.

## Neue Dateien
- `website/src/context/SettingsContext.jsx`
- `website/src/i18n/de.json`
- `website/src/i18n/en.json`

## Geänderte Dateien
- `website/src/main.jsx`
- `website/src/App.jsx`
- `website/src/index.css`

---

## Implementierungsschritte

### Schritt 1: i18n-Dateien erstellen

**`website/src/i18n/de.json`**
```json
{
  "header": {
    "loading": "Laden…"
  },
  "sidebar": {
    "journey": "Reiseverlauf",
    "stops": "Stopps"
  },
  "stopCard": {
    "new": "Neu"
  },
  "pointDetail": {
    "releaseToRefresh": "Loslassen zum Neuladen",
    "pullToRefresh": "Zum Neuladen ziehen",
    "whatHappened": "Was hier passiert ist",
    "travelDay": "Reisetag",
    "location": "Standort",
    "latitude": "Breitengrad:",
    "longitude": "Längengrad:"
  },
  "passwordGate": {
    "title": "🔒 Passwort:",
    "placeholder": "Passwort",
    "denied": "Zugriff verweigert!",
    "unlock": "Freischalten"
  },
  "gallery": {
    "title": "Galerie",
    "file": "DATEI",
    "files": "DATEIEN"
  },
  "hero": {
    "loading": "Bild wird geladen..."
  },
  "settings": {
    "title": "Einstellungen",
    "appearance": "Erscheinungsbild",
    "light": "Hell",
    "dark": "Dunkel",
    "language": "Sprache",
    "german": "Deutsch",
    "english": "English"
  }
}
```

**`website/src/i18n/en.json`**
```json
{
  "header": {
    "loading": "Loading…"
  },
  "sidebar": {
    "journey": "Journey",
    "stops": "Stops"
  },
  "stopCard": {
    "new": "New"
  },
  "pointDetail": {
    "releaseToRefresh": "Release to refresh",
    "pullToRefresh": "Pull to refresh",
    "whatHappened": "What happened here",
    "travelDay": "Travel day",
    "location": "Location",
    "latitude": "Latitude:",
    "longitude": "Longitude:"
  },
  "passwordGate": {
    "title": "🔒 Password:",
    "placeholder": "Password",
    "denied": "Access denied!",
    "unlock": "Unlock"
  },
  "gallery": {
    "title": "Gallery",
    "file": "FILE",
    "files": "FILES"
  },
  "hero": {
    "loading": "Loading image..."
  },
  "settings": {
    "title": "Settings",
    "appearance": "Appearance",
    "light": "Light",
    "dark": "Dark",
    "language": "Language",
    "german": "Deutsch",
    "english": "English"
  }
}
```

---

### Schritt 2: SettingsContext erstellen

**`website/src/context/SettingsContext.jsx`**
```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import de from '../i18n/de.json';
import en from '../i18n/en.json';

const translations = { de, en };

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() =>
    localStorage.getItem('theme') || 'system'
  );
  const [locale, setLocaleState] = useState(() =>
    localStorage.getItem('locale') || 'de'
  );

  const setTheme = (val) => {
    localStorage.setItem('theme', val);
    setThemeState(val);
    applyTheme(val);
  };

  const setLocale = (val) => {
    localStorage.setItem('locale', val);
    setLocaleState(val);
  };

  // t('sidebar.journey') → nested key lookup
  const t = (key) => {
    const parts = key.split('.');
    let val = translations[locale];
    for (const p of parts) val = val?.[p];
    return val ?? key;
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, locale, setLocale, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}
```

---

### Schritt 3: FOUC-Prävention in main.jsx

Vor dem React-Mount in `website/src/main.jsx` einfügen:
```jsx
// Inline theme init — muss VOR React-Mount laufen
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}
```

Dann `<SettingsProvider>` als Root-Wrapper:
```jsx
import { SettingsProvider } from './context/SettingsContext';

root.render(
  <SettingsProvider>
    {isAdmin ? <AdminPage /> : <App />}
  </SettingsProvider>
);
```

---

### Schritt 4: Tailwind Dark Mode in index.css konfigurieren

In `website/src/index.css` am Anfang nach `@import "tailwindcss"`:
```css
@variant dark (&:where(.dark, .dark *));
```

*(Tailwind v4 Syntax — ersetzt `darkMode: 'class'` aus der alten Config)*

---

### Schritt 5: App.jsx – kein Provider-Wrapping nötig (bereits in main.jsx)

Keine weiteren Änderungen in App.jsx für Foundation nötig.

---

## Schnittstellen (Output für andere Pläne)

| Export | Typ | Konsumenten |
|--------|-----|-------------|
| `useSettings()` | Hook | Plan 02 (SettingsPanel), Plan 04 (i18n) |
| `SettingsProvider` | Component | main.jsx |
| `t(key)` | Funktion via Hook | Alle Komponenten in Plan 04 |
| `theme`, `setTheme` | State via Hook | Plan 02 (Toggle), Plan 03 (dark: Klassen reagieren automatisch) |
