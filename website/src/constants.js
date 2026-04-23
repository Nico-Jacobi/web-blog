// Backend base URL — overridable per build via VITE_API_BASE.
export const API_BASE = import.meta.env?.VITE_API_BASE ?? 'https://api.1ej.de';

// Web Push VAPID public key. Until per-blog VAPID keys are wired up the same
// key is used for all tenants; the subscription itself is stored per-blog
// server-side (see services/push.js).
export const VAPID_PUBLIC_KEY = 'BOjyu53x_por-j-_XIBbBSfMjaBFad7hQTKA3wgsLgpmib3wSUfdOjmw5LDzed-ADHL2_cQNN3-dDqJ2Duabf0U';
