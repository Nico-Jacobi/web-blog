import { useEffect, useRef, useState } from 'react';
import { Settings, ShieldCheck } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { sharedButtonStyle, sharedIconStyle } from './styles';
import { BASE_PATH } from '../controller/router.js';

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme, locale, setLocale, t } = useSettings();
  const ref = useRef(null);
  const isAdmin = window.location.pathname.includes('/admin');

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
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-xl border bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 z-50 overflow-hidden">

          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-400 dark:text-slate-500">
              {t('settings.appearance')}
            </p>
            <div className="flex gap-1">
              {['light', 'dark'].map((val) => (
                <button
                  key={val}
                  onClick={() => setTheme(val)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    theme === val
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

          <div className="px-4 pt-2 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-slate-400 dark:text-slate-500">
              {t('settings.language')}
            </p>
            <div className="flex gap-1">
              {['de', 'en'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setLocale(lang); setOpen(false); }}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    locale === lang
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {lang === 'de' ? t('settings.german') : t('settings.english')}
                </button>
              ))}
            </div>
          </div>

          {!isAdmin && (
            <>
              <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3" />

              <div className="px-2 py-2">
                <a
                  href={BASE_PATH + '/admin'}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <ShieldCheck size={15} />
                  Admin
                </a>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
