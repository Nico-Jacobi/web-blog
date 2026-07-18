import React, { useState, useEffect } from 'react';
import { Download, FileJson, Lock, ArrowLeft, HardDrive, ImageIcon, Settings, Eye, EyeOff, Check, RotateCcw, Route, Car, Bus, Ship, Plane, Footprints, Compass, Caravan, Smile, Train, Bike, Menu, X } from 'lucide-react';
import { API_BASE } from '../constants.js';
import { setFaviconEmoji } from '../App.jsx';
import { BASE_PATH } from '../controller/router.js';
import { applyAccentColor } from '../controller/accentColor.js';
import SettingsPanel from '../components/SettingsPanel';
import { useSettings } from '../context/SettingsContext';

const SESSION_KEY = 'admin_token';

function buildToken(password) {
    return btoa(password);
}

async function verifyToken(token) {
    try {
        const res = await fetch(`${API_BASE}/admin/files`, {
            headers: { 'x-admin-token': token },
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ── Password gate ─────────────────────────────────────────────────────

function AdminLogin({ onSuccess }) {
    const { t } = useSettings();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const token = buildToken(password);
        const ok = await verifyToken(token);
        setLoading(false);
        if (!ok) {
            setError(t('admin.wrongPassword'));
            return;
        }
        sessionStorage.setItem(SESSION_KEY, token);
        onSuccess(token);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-slate-800 text-white p-2.5 rounded-xl">
                        <Lock size={18} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 dark:text-white">Admin Panel</h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Australien Trip</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('passwordGate.placeholder')}
                        autoFocus
                        className={`w-full px-4 py-3 rounded-xl border outline-none text-sm text-slate-900 dark:text-white dark:bg-slate-800 transition-all ${
                            error ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:focus:border-slate-400'
                        }`}
                    />
                    {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-800 text-white text-sm font-bold py-3 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? t('admin.checking') : 'Login'}
                    </button>
                </form>
                <button
                    onClick={() => window.location.href = BASE_PATH + '/'}
                    className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center justify-center gap-1 transition-colors"
                >
                    <ArrowLeft size={12} /> {t('admin.backToApp')}
                </button>
            </div>
        </div>
    );
}

// ── Downloads section ─────────────────────────────────────────────────

function DownloadsSection({ token }) {
    const { t } = useSettings();
    const [files, setFiles] = useState(null);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(null);
    const [mediaBytes, setMediaBytes] = useState(0);

    useEffect(() => {
        fetch(`${API_BASE}/admin/files`, { headers: { 'x-admin-token': token } })
            .then(r => r.json())
            .then(d => setFiles(d.files || []))
            .catch(() => setError(t('admin.filesLoadError')));
    }, [token]);

    const handleDownload = async (file) => {
        setDownloading(file.name);
        try {
            const res = await fetch(
                `${API_BASE}/admin/download?file=${encodeURIComponent(file.name)}`,
                { headers: { 'x-admin-token': token } }
            );
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // silently fail
        } finally {
            setDownloading(null);
        }
    };

    // Streams a zip endpoint to a blob download with byte progress.
    // key marks which button is busy; prefix names the saved file.
    const handleZipDownload = async (endpoint, key, prefix) => {
        setDownloading(key);
        setMediaBytes(0);
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                headers: { 'x-admin-token': token },
            });
            const reader = res.body.getReader();
            const chunks = [];
            let received = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                setMediaBytes(received);
            }
            const blob = new Blob(chunks, { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // silently fail
        } finally {
            setDownloading(null);
            setMediaBytes(0);
        }
    };

    const handleDownloadMedia = () =>
        handleZipDownload('/admin/download-media', '__media__', 'media-backup');
    const handleDownloadFull = () =>
        handleZipDownload('/admin/download-full', '__full__', 'full-backup');

    if (error) return <p className="text-red-500 text-sm">{error}</p>;
    if (!files) return <p className="text-slate-400 dark:text-slate-500 text-sm">{t('admin.loading')}</p>;

    const rowClass = "w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer border border-slate-100 dark:border-slate-700";

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('admin.fullBackup')}</h3>
                <button onClick={handleDownloadFull} disabled={downloading === '__full__'} className={rowClass}>
                    <span className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                        <HardDrive size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        {t('admin.fullBackup')} <span className="text-slate-400 dark:text-slate-500 font-normal">({t('admin.fullBackupDesc')})</span>
                    </span>
                    <span className="flex items-center gap-2 text-slate-400 dark:text-slate-500 shrink-0 ml-4">
                        {downloading === '__full__' ? (
                            <span className="text-xs text-orange-500 tabular-nums">
                                {mediaBytes > 0 ? `${(mediaBytes / 1024 / 1024).toFixed(1)} MB…` : t('admin.connecting')}
                            </span>
                        ) : (
                            <>
                                <span className="text-xs">zip</span>
                                <Download size={15} />
                            </>
                        )}
                    </span>
                </button>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{t('admin.fullBackupHint')}</p>
            </div>

            <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('admin.media')}</h3>
                <button onClick={handleDownloadMedia} disabled={downloading === '__media__'} className={rowClass}>
                    <span className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                        <ImageIcon size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        media/ <span className="text-slate-400 dark:text-slate-500 font-normal">({t('admin.allPhotosVideos')})</span>
                    </span>
                    <span className="flex items-center gap-2 text-slate-400 dark:text-slate-500 shrink-0 ml-4">
                        {downloading === '__media__' ? (
                            <span className="text-xs text-orange-500 tabular-nums">
                                {mediaBytes > 0 ? `${(mediaBytes / 1024 / 1024).toFixed(1)} MB…` : t('admin.connecting')}
                            </span>
                        ) : (
                            <>
                                <span className="text-xs">zip</span>
                                <Download size={15} />
                            </>
                        )}
                    </span>
                </button>
            </div>

            <div>
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{t('admin.data')}</h3>
                <div className="space-y-2">
                    {files.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-sm">{t('admin.noFiles')}</p>}
                    {files.map(file => (
                        <button key={file.name} onClick={() => handleDownload(file)} disabled={downloading === file.name} className={rowClass}>
                            <span className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                                <FileJson size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                {file.name}
                            </span>
                            <span className="flex items-center gap-2 text-slate-400 dark:text-slate-500 shrink-0 ml-4">
                                <span className="text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                                {downloading === file.name ? (
                                    <span className="text-xs text-orange-500">{t('admin.loading')}</span>
                                ) : (
                                    <Download size={15} />
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Settings section ──────────────────────────────────────────────────

function SettingsSection({ token }) {
    const { t } = useSettings();
    const [titleMain, setTitleMain] = useState('');
    const [titleAccent, setTitleAccent] = useState('');
    const [tabTitle, setTabTitle] = useState('');
    const [readPass, setReadPass] = useState('');
    const [accentColor, setAccentColor] = useState('#ea580c');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/admin/settings`, { headers: { 'x-admin-token': token } })
            .then(r => r.json())
            .then(d => {
                setTitleMain(d.titleMain || '');
                setTitleAccent(d.titleAccent || '');
                setTabTitle(d.tabTitle || '');
                setReadPass(d.readPass || '');
                const color = d.accentColor || '#ea580c';
                setAccentColor(color);
                applyAccentColor(color);
                setLoading(false);
            })
            .catch(() => { setError(t('admin.settingsLoadError')); setLoading(false); });
    }, [token]);

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/admin/settings`, {
                method: 'POST',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ titleMain, titleAccent, tabTitle, readPass, accentColor }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || t('admin.error')); return; }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            setError(t('admin.connectionError'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-slate-400 dark:text-slate-500 text-sm">{t('admin.loading')}</p>;

    const preview = titleMain + (titleAccent ? ' ' + titleAccent : '');
    const inputClass = "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:border-slate-400 dark:focus:border-slate-400 transition-all";
    const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";
    const hintClass = "text-xs text-slate-400 dark:text-slate-500 mt-1.5";

    return (
        <form onSubmit={handleSave} className="max-w-md space-y-6">

            <div className="space-y-3">
                <label className={labelClass}>{t('admin.headerTitle')}</label>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={titleMain}
                            onChange={e => setTitleMain(e.target.value)}
                            placeholder="Jennys & Leons"
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('admin.normalBlack')}</p>
                    </div>
                    <div className="flex-1">
                        <input
                            type="text"
                            value={titleAccent}
                            onChange={e => setTitleAccent(e.target.value)}
                            placeholder="Australien Trip"
                            className="w-full px-4 py-3 rounded-xl border border-orange-200 dark:border-orange-800 outline-none text-sm text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-800 focus:border-orange-400 transition-all"
                        />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('admin.accentOrange')}</p>
                    </div>
                </div>
                {preview && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                        {t('admin.preview')} <span className="font-bold text-slate-700 dark:text-slate-300">{titleMain}</span>{titleAccent && <> <span className="font-bold text-orange-500">{titleAccent}</span></>}
                    </p>
                )}
            </div>

            <div>
                <label className={`${labelClass} mb-2`}>{t('admin.tabTitle')}</label>
                <input
                    type="text"
                    value={tabTitle}
                    onChange={e => setTabTitle(e.target.value)}
                    placeholder={preview || t('admin.tabTitlePlaceholder')}
                    className={inputClass}
                />
                <p className={hintClass}>{t('admin.tabTitleHint')}</p>
            </div>

            <div>
                <label className={`${labelClass} mb-2`}>{t('admin.readPassword')}</label>
                <div className="relative">
                    <input
                        type={showPass ? 'text' : 'password'}
                        value={readPass}
                        onChange={e => setReadPass(e.target.value)}
                        className={`${inputClass} pr-12 font-mono`}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <p className={hintClass}>{t('admin.readPasswordHint')}</p>
            </div>

            <div>
                <label className={`${labelClass} mb-2`}>{t('admin.accentColor')}</label>
                <div className="flex items-center gap-3">
                    <input
                        type="color"
                        value={accentColor}
                        onChange={e => { setAccentColor(e.target.value); applyAccentColor(e.target.value); }}
                        className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-800"
                    />
                    <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{accentColor}</span>
                    <button
                        type="button"
                        onClick={() => { setAccentColor('#ea580c'); applyAccentColor('#ea580c'); }}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        <RotateCcw size={12} /> Reset
                    </button>
                </div>
                <p className={hintClass}>{t('admin.accentColorHint')}</p>
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
                {saved ? <><Check size={15} /> {t('admin.saved')}</> : saving ? t('admin.saving') : t('admin.save')}
            </button>
        </form>
    );
}

// ── Route styles section ──────────────────────────────────────────────

const MODE_ICONS = {
    car:   Car,
    rv:    Caravan,
    bus:   Bus,
    foot:  Footprints,
    boat:  Ship,
    plane: Plane,
    train: Train,
    bike:  Bike,
    misc:  Compass,
};

const DEFAULT_STYLES = {
    car:   { color: '#EF4444', weight: 3,   dashArray: '' },
    rv:    { color: '#16A34A', weight: 3,   dashArray: '' },
    bus:   { color: '#7C3AED', weight: 3,   dashArray: '' },
    foot:  { color: '#6B7280', weight: 2,   dashArray: '2,6' },
    boat:  { color: '#0369A1', weight: 2.5, dashArray: '5,7' },
    plane: { color: '#22D3EE', weight: 3.5, dashArray: '8,6' },
    train: { color: '#D97706', weight: 3,   dashArray: '' },
    bike:  { color: '#65A30D', weight: 2,   dashArray: '4,5' },
    misc:  { color: '#9CA3AF', weight: 2,   dashArray: '' },
};

function RouteStylesSection({ token }) {
    const { t } = useSettings();

    const DASH_PRESETS = [
        { label: t('admin.dashSolid'),    value: '' },
        { label: t('admin.dashDashed'),   value: '5,8' },
        { label: t('admin.dashLongDash'), value: '12,6' },
        { label: t('admin.dashDotted'),   value: '2,6' },
        { label: t('admin.dashDashDot'),  value: '10,4,2,4' },
    ];

    const [styles, setStyles] = useState(() =>
        Object.fromEntries(Object.entries(DEFAULT_STYLES).map(([k, v]) => [k, { ...v }]))
    );
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/admin/route-styles`, { headers: { 'x-admin-token': token } })
            .then(r => r.json())
            .then(d => {
                setStyles(prev => {
                    const merged = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v }]));
                    for (const mode of Object.keys(merged)) {
                        if (d[mode]) Object.assign(merged[mode], d[mode]);
                    }
                    return merged;
                });
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [token]);

    const update = (mode, field, value) =>
        setStyles(prev => ({ ...prev, [mode]: { ...prev[mode], [field]: value } }));

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/admin/route-styles`, {
                method: 'POST',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify(styles),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || t('admin.error')); return; }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            setError(t('admin.connectionError'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-slate-400 dark:text-slate-500 text-sm">{t('admin.loading')}</p>;

    return (
        <form onSubmit={handleSave} className="max-w-2xl space-y-6">
            <div className="space-y-2">
                {Object.entries(styles).map(([mode, s]) => {
                    const Icon = MODE_ICONS[mode];
                    const modeKey = `admin.routes${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
                    return (
                        <div key={mode} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 w-28 shrink-0">
                                {Icon && <Icon size={15} style={{ color: s.color }} />}
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(modeKey)}</span>
                            </div>

                            <input
                                type="color"
                                value={s.color}
                                onChange={e => update(mode, 'color', e.target.value)}
                                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-700 shrink-0"
                            />

                            <div className="flex items-center gap-2 shrink-0">
                                <input
                                    type="range"
                                    min="1" max="8" step="0.5"
                                    value={s.weight}
                                    onChange={e => update(mode, 'weight', parseFloat(e.target.value))}
                                    className="w-24 accent-slate-700"
                                />
                                <span className="text-xs text-slate-500 dark:text-slate-400 w-9 tabular-nums">{s.weight}px</span>
                            </div>

                            <select
                                value={s.dashArray ?? ''}
                                onChange={e => update(mode, 'dashArray', e.target.value)}
                                className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 outline-none shrink-0 focus:border-slate-400"
                            >
                                {DASH_PRESETS.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>

                            <svg width="60" height="14" className="shrink-0">
                                <line
                                    x1="2" y1="7" x2="58" y2="7"
                                    stroke={s.color}
                                    strokeWidth={Math.min(s.weight, 6)}
                                    strokeDasharray={s.dashArray || ''}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                    );
                })}
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    {saved ? <><Check size={15} /> {t('admin.saved')}</> : saving ? t('admin.saving') : t('admin.save')}
                </button>
                <button
                    type="button"
                    onClick={() => setStyles(Object.fromEntries(Object.entries(DEFAULT_STYLES).map(([k, v]) => [k, { ...v }])))}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    <RotateCcw size={12} /> {t('admin.reset')}
                </button>
            </div>
        </form>
    );
}

// ── Icon section ─────────────────────────────────────────────────────

const ICON_SUGGESTIONS = [
    '🦘', '🌏', '🗺️', '✈️', '🚗', '🏕️', '🌄', '🌅',
    '🏔️', '🌊', '🦅', '🏜️', '⛺', '🎒', '🧭', '📸',
    '🌿', '🚌', '🛳️', '🌞', '🐨', '🦁', '🐚', '❤️',
];

function IconSection({ token }) {
    const { t } = useSettings();
    const [icon, setIcon] = useState('🦘');
    const [custom, setCustom] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/admin/settings`, { headers: { 'x-admin-token': token } })
            .then(r => r.json())
            .then(d => { setIcon(d.siteIcon || '🦘'); setLoading(false); })
            .catch(() => setLoading(false));
    }, [token]);

    const select = (emoji) => {
        setIcon(emoji);
        setCustom('');
        setFaviconEmoji(emoji);
    };

    const handleCustomChange = (val) => {
        setCustom(val);
        const trimmed = [...val.trim()].slice(0, 2).join('');
        if (trimmed) { setIcon(trimmed); setFaviconEmoji(trimmed); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/admin/settings`, {
                method: 'POST',
                headers: { 'x-admin-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteIcon: icon }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || t('admin.error')); return; }
            localStorage.setItem('siteIcon', icon);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            setError(t('admin.connectionError'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-slate-400 dark:text-slate-500 text-sm">{t('admin.loading')}</p>;

    return (
        <form onSubmit={handleSave} className="max-w-md space-y-6">
            <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-5xl select-none">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('admin.currentIcon')}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('admin.currentIconHint')}</p>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {t('admin.suggestions')}
                </label>
                <div className="grid grid-cols-8 gap-1.5">
                    {ICON_SUGGESTIONS.map(emoji => (
                        <button
                            key={emoji}
                            type="button"
                            onClick={() => select(emoji)}
                            className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110 ${
                                icon === emoji
                                    ? 'bg-slate-800 ring-2 ring-slate-800 ring-offset-1 dark:ring-offset-slate-900'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t('admin.customEmoji')}
                </label>
                <input
                    type="text"
                    value={custom}
                    onChange={e => handleCustomChange(e.target.value)}
                    placeholder="z.B. 🏄"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 outline-none text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:border-slate-400 dark:focus:border-slate-400 transition-all"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{t('admin.customEmojiHint')}</p>
            </div>

            {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

            <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
                {saved ? <><Check size={15} /> {t('admin.saved')}</> : saving ? t('admin.saving') : t('admin.save')}
            </button>
        </form>
    );
}

// ── Main admin page ───────────────────────────────────────────────────

export default function AdminPage() {
    const { t } = useSettings();
    const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY));
    const [verified, setVerified] = useState(false);
    const [activeSection, setActiveSection] = useState('downloads');
    const [menuOpen, setMenuOpen] = useState(false);

    const NAV = [
        { id: 'downloads', label: t('admin.downloads'), icon: HardDrive },
        { id: 'settings',  label: t('admin.settings'),  icon: Settings },
        { id: 'icon',      label: t('admin.icon'),       icon: Smile },
        { id: 'routes',    label: t('admin.routes'),     icon: Route },
    ];

    useEffect(() => {
        if (!token) return;
        verifyToken(token).then(ok => {
            if (!ok) {
                sessionStorage.removeItem(SESSION_KEY);
                setToken(null);
            } else {
                setVerified(true);
            }
        });
    }, [token]);

    if (!token || !verified) {
        return <AdminLogin onSuccess={tok => { setToken(tok); setVerified(true); }} />;
    }

    return (
        <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 flex flex-col">
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="md:hidden -ml-1 p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        aria-label={t('admin.menu')}
                    >
                        <Menu size={20} />
                    </button>
                    <div className="bg-slate-800 text-white p-2 rounded-xl">
                        <Lock size={15} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 dark:text-white">Admin Panel</h1>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Australien Trip</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.location.href = BASE_PATH + '/'}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        {t('admin.backToApp')}
                    </button>
                    <SettingsPanel />
                </div>
            </header>

            <div className="flex flex-1 min-h-0">
                {/* Mobile backdrop */}
                {menuOpen && (
                    <div
                        onClick={() => setMenuOpen(false)}
                        className="md:hidden fixed inset-0 z-30 bg-black/40"
                    />
                )}

                <nav
                    className={`w-52 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 transition-transform duration-200
                        fixed inset-y-0 left-0 z-40 md:static md:z-auto md:translate-x-0
                        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    <div className="flex items-center justify-between mb-2 px-2">
                        <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">{t('admin.menu')}</p>
                        <button
                            onClick={() => setMenuOpen(false)}
                            className="md:hidden -mr-1 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    {NAV.map(item => {
                        const Icon = item.icon;
                        const active = activeSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => { setActiveSection(item.id); setMenuOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                                    active ? 'bg-slate-800 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <Icon size={15} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                <main className="flex-1 p-4 sm:p-8 overflow-y-auto">
                    {activeSection === 'downloads' && (
                        <>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t('admin.downloads')}</h2>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{t('admin.downloadsDesc')}</p>
                            <DownloadsSection token={token} />
                        </>
                    )}
                    {activeSection === 'settings' && (
                        <>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t('admin.settings')}</h2>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{t('admin.settingsDesc')}</p>
                            <SettingsSection token={token} />
                        </>
                    )}
                    {activeSection === 'icon' && (
                        <>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t('admin.icon')}</h2>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{t('admin.iconDesc')}</p>
                            <IconSection token={token} />
                        </>
                    )}
                    {activeSection === 'routes' && (
                        <>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">{t('admin.routes')}</h2>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{t('admin.routesDesc')}</p>
                            <RouteStylesSection token={token} />
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
