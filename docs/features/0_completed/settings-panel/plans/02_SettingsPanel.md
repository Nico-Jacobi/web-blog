# Plan 02: SettingsPanel UI-Komponente

## Ziel
Das Zahnrad-Icon im Header oben rechts und das Dropdown-Panel mit Theme-Toggle und Sprach-Switcher.

## Neue Dateien
- `website/src/components/SettingsPanel.jsx`

## Geänderte Dateien
- `website/src/components/Header.jsx`
- `website/src/components/styles.js`

## Abhängigkeiten
- Plan 01 muss fertig sein (`useSettings` Hook verfügbar)

---

## Implementierungsschritte

### Schritt 1: SettingsPanel-Komponente erstellen

**`website/src/components/SettingsPanel.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { Settings } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { sharedButtonStyle, sharedIconStyle } from './styles';

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, locale, setLocale, t } = useSettings();
  const ref = useRef(null);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className={sharedButtonStyle}
        onClick={() => setOpen(o => !o)}
        aria-label={t('settings.title')}
      >
        <Settings size={18} className={sharedIconStyle} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border
                        bg-white border-slate-200
                        dark:bg-slate-800 dark:border-slate-700
                        z-50 overflow-hidden">

          {/* Erscheinungsbild */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2
                          text-slate-400 dark:text-slate-500">
              {t('settings.appearance')}
            </p>
            <div className="flex gap-1">
              {['light', 'dark'].map((val) => (
                <button
                  key={val}
                  onClick={() => setTheme(val)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${theme === val
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                >
                  {t(`settings.${val}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3" />

          {/* Sprache */}
          <div className="px-4 pt-2 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2
                          text-slate-400 dark:text-slate-500">
              {t('settings.language')}
            </p>
            <div className="flex gap-1">
              {['de', 'en'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setLocale(lang); setOpen(false); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${locale === lang
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                >
                  {lang === 'de' ? t('settings.german') : t('settings.english')}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
```


---

### Schritt 2: SettingsPanel in Header.jsx einbinden

In `website/src/components/Header.jsx`:

1. Import ergänzen:
```jsx
import SettingsPanel from './SettingsPanel';
```

2. SettingsPanel rechts neben dem Känguru-Button einfügen (oder als letztes Element in der rechten Icon-Gruppe):
```jsx
{/* Settings-Icon — ganz rechts */}
<SettingsPanel />
```

Platzierung: Im Header-JSX in der `div` mit den rechten Icons (wo auch das Känguru-Icon ist).

---

### Schritt 3: styles.js — dark-mode-aware machen

`website/src/components/styles.js`:
```js
export const sharedButtonStyle = "group bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-600 p-2 md:p-3 rounded-full shadow-lg transition-all hover:shadow-xl border border-slate-200 outline-offset-2 focus:outline-orange-500";
export const sharedIconStyle = "text-slate-700 dark:text-slate-300 group-hover:text-orange-500 transition-colors";
```

---

## Schnittstellen (Output für andere Pläne)

| Output | Konsumenten |
|--------|-------------|
| `SettingsPanel` in Header sichtbar | Kein weiterer Plan nötig |
| `sharedButtonStyle` dark-aware | Alle Komponenten die styles.js nutzen, profitieren automatisch |

---

## Visuelles Ergebnis

```
Header: [Map-Icon]  Titel + Datum + Distanz  [🦘] [⚙]
                                                        ↓ Klick
                                             ┌──────────────────┐
                                             │ ERSCHEINUNGSBILD │
                                             │ [Hell] [Dunkel]  │
                                             │ ──────────────── │
                                             │ SPRACHE          │
                                             │ [Deutsch][Eng]   │
                                             └──────────────────┘
```
