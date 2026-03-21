import { useState, useEffect } from 'react';

export function useLeaflet() {
    const [leafletReady, setLeafletReady] = useState(false);

    useEffect(() => {
        if (window.L) {
            setLeafletReady(true);
            return;
        }

        let cssLoaded = false;
        let jsLoaded = false;
        const check = () => { if (cssLoaded && jsLoaded) setLeafletReady(true); };

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        cssLink.onload = () => { cssLoaded = true; check(); };
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => { jsLoaded = true; check(); };
        document.body.appendChild(script);
    }, []);

    return leafletReady;
}