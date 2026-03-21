self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {};
    const title = data.title || 'Neuer Stop!';
    const options = {
        body: data.body || 'Ein neuer Ort wurde zur Reise hinzugefügt.',
        icon: '/vite.svg',
        badge: '/vite.svg',
        data: { url: self.location.origin }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(self.location.origin);
        })
    );
});
