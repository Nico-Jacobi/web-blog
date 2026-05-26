import { createContext, useContext, useState } from 'react';
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
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}
