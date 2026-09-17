// Réception des notifications push (importé par le service worker généré).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Charge mentale partagée';
  // Une échéance proche vibre et reste affichée tant qu'on ne l'a pas vue.
  const urgent = data.urgent === true;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'cmp',
      renotify: true,
      requireInteraction: urgent,
      vibrate: urgent ? [90, 60, 90, 60, 180] : [60],
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
