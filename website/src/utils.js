export function isVideo(path) {
    if (!path) return false;
    const lower = path.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
}

export function getAuthToken(slug) {
    return sessionStorage.getItem('auth_' + slug) ?? null;
}

export function setAuthToken(slug, value) {
    if (value == null || value === '') {
        deleteAuthToken(slug);
        return;
    }
    sessionStorage.setItem('auth_' + slug, value);
}

export function deleteAuthToken(slug) {
    sessionStorage.removeItem('auth_' + slug);
}
