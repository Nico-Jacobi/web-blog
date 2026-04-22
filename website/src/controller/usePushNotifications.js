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

/**
 * Push the current blog slug + read token to the service worker so it can
 * inject the right header into image requests for caching.
 */
export async function sendAuthToServiceWorker(slug, token) {
  if (!slug || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const target = navigator.serviceWorker.controller || reg.active;
    if (target) target.postMessage({ type: 'auth', slug, token: token || null });
  } catch (err) {
    console.error('SW auth handshake failed:', err);
  }
}

export async function setupPushNotifications(slug, token) {
  if (!slug || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } else {
      // Already subscribed — skip re-sending.
      return;
    }

    await fetch(`${API_BASE}/blogs/${slug}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Read-Token': token } : {}),
      },
      body: JSON.stringify(subscription),
    });
  } catch (err) {
    console.error('Push setup failed:', err);
  }
}
