import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PasswordGate({ onPasswordSubmit, authError }) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onPasswordSubmit(password);
    };

    return (
        <div className="fixed inset-0 bg-orange-50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-orange-100 text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-6">{t('auth.heading')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.placeholder')}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-slate-900 ${
                            authError ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-orange-500'
                        }`}
                        autoFocus
                    />
                    {authError && <p className="text-red-500 text-xs font-bold">{t('auth.error')}</p>}
                    <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition-colors">
                        {t('auth.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}