// Réception des notifications push (importé par le service worker généré).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Charge mentale partagée';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'cmp',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ('focus' in c) return c.focus();
        }
        return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
      }),
  );
});
