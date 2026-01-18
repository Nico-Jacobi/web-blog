import { useState, useEffect } from 'react';

export function useLeaflet() {
    const [leafletReady, setLeafletReady] = useState(false);

    useEffect(() => {
        if (window.L) {
            setLeafletReady(true);
            return;
        }

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(cssLink);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => setLeafletReady(true);
        document.body.appendChild(script);
    }, []);

    return leafletReady;
}