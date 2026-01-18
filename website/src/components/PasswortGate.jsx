import React, { useState } from 'react';

export default function PasswordGate({ onPasswordSubmit, authError }) {
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        localStorage.setItem('trip_auth_key', password);
        onPasswordSubmit(password);
    };

    return (
        <div className="fixed inset-0 bg-orange-50 flex items-center justify-center p-4 z-[9999]">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-orange-100 text-center">
                <h2 className="text-2xl font-black text-slate-900 mb-6">🔒 Passwort:</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Passwort"
                        /* Added text-slate-900 for black points */
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all text-slate-900 ${
                            authError ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-orange-500'
                        }`}
                        autoFocus
                    />
                    {authError && <p className="text-red-500 text-xs font-bold">Zugriff verweigert!</p>}
                    <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-700 transition-colors">
                        Freischalten
                    </button>
                </form>
            </div>
        </div>
    );
}