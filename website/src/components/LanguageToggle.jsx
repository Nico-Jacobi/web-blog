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
      className="text-sm font-medium px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
      aria-label="Switch language"
    >
      {current === 'de' ? 'EN' : 'DE'}
    </button>
  );
}
