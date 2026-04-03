import { API_BASE, VAPID_PUBLIC_KEY } from '../constants.js';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        return await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
        console.error('SW registration failed:', err);
        return null;
    }
}

export async function setupPushNotifications(token) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        const reg = await navigator.serviceWorker.ready;

        let subscription = await reg.pushManager.getSubscription();

        if (!subscription) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        } else {
            // Already subscribed — skip re-sending to server
            return;
        }

        await fetch(`${API_BASE}/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Token': btoa(token)
            },
            body: JSON.stringify(subscription)
        });
    } catch (err) {
        console.error('Push setup failed:', err);
    }
}
