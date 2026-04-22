import { useTranslation } from 'react-i18next';

/**
 * Shown when the visitor lands on the bare root URL without a blog slug.
 * Intentionally minimal — for privacy reasons we don't list existing blogs.
 */
export default function LandingPage({ blogNotFound = false }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh w-screen bg-gradient-to-br from-orange-50 to-slate-100 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {t('landing.title', 'Travel blogs')}
        </h1>
        <p className="text-slate-600 mb-6">
          {blogNotFound
            ? t('landing.blogNotFound', "This blog doesn't exist (or hasn't been created yet).")
            : t('landing.intro', 'A platform for personal travel blogs. Open the URL of a specific blog to view it.')}
        </p>
        <p className="text-sm text-slate-400">
          {t('landing.urlHint', 'Try domain.com/<your-blog-slug>')}
        </p>
      </div>
    </div>
  );
}
