const CACHE_NAME = 'acervo-pwa-v3';
const APP_SHELL = [
  '',
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'html/login.html',
  'html/feed.html',
  'css/style.css',
  'css/login.css',
  'js/config.js',
  'js/ui.js',
  'js/auth.js',
  'js/db.js',
  'js/login.js',
  'js/feed.js',
  'js/pwa.js',
  'img/login-bg.jpg',
  'img/pwa-icon-180.png',
  'img/pwa-icon-192.png',
  'img/pwa-icon-512.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('acervo-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return await cache.match(request, { ignoreSearch: true })
          || await cache.match(new URL('html/login.html', self.registration.scope));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});

self.addEventListener('push', event => {
  const payload = event.data?.json() || {};
  const url = new URL(payload.url || 'html/feed.html', self.registration.scope);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(self.registration.showNotification(payload.title || 'Quotes and Articles', {
    body: payload.body || 'Há uma nova publicação.',
    icon: new URL('img/pwa-icon-192.png', self.registration.scope).href,
    badge: new URL('img/pwa-icon-180.png', self.registration.scope).href,
    data: { url: url.href },
    tag: payload.tag || 'new-post'
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || 'html/feed.html', self.registration.scope);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (new URL(client.url).origin === url.origin) {
        await client.navigate(url.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
