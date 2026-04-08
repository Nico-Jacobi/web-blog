export function isVideo(path) {
    if (!path) return false;
    const lower = path.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');
}

export function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

export function setCookie(name, value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${30 * 24 * 60 * 60}; SameSite=Strict; Secure`;
}

export function deleteCookie(name) {
    document.cookie = `${name}=; max-age=0; SameSite=Strict; Secure`;
}
