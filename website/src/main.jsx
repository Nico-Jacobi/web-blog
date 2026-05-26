import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPage from './pages/AdminPage.jsx';
import './index.css';
import { BASE_PATH } from './controller/router.js';
import { SettingsProvider } from './context/SettingsContext';
import { setFaviconEmoji } from './controller/favicon.js';

const _t = localStorage.getItem('theme');
if (_t === 'dark' || (!_t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

const _icon = localStorage.getItem('siteIcon');
if (_icon) setFaviconEmoji(_icon);

const pathname = window.location.pathname;
const adminPath = BASE_PATH + '/admin';
const isAdmin = pathname === adminPath || pathname === adminPath + '/';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <SettingsProvider>
            {isAdmin ? <AdminPage /> : <App />}
        </SettingsProvider>
    </React.StrictMode>
);