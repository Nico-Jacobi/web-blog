import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';

export default function PasswordGate({ onPasswordSubmit, authError }) {
    const { t } = useSettings();
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onPasswordSubmit(password);
    };

    return (
        <div className="fixed inset-0 bg-orange-50 dark:bg-slate-900 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-sm w-full border border-orange-100 dark:border-slate-700 text-center">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">{t('passwordGate.title')}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('passwordGate.placeholder')}
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-slate-900 dark:text-white ${
                            authError ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-slate-200 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-400'
                        }`}
                        autoFocus
                    />
                    {authError && <p className="text-red-500 text-xs font-bold">{t('passwordGate.denied')}</p>}
                    <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition-colors">
                        {t('passwordGate.unlock')}
                    </button>
                </form>
            </div>
        </div>
    );
}