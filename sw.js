// Service Worker: hält eine Kopie der App-Dateien im Handy vor.
// Mit Netz kommt immer die neueste Fassung, ohne Netz die gespeicherte.
const CACHE = 'drehtag-v10';
const DATEIEN = [
  './', 'index.html', 'css/app.css',
  'js/app.js', 'js/modell.js', 'js/db.js', 'js/zustand.js', 'js/ansichten.js', 'js/aktionen.js',
  'js/dateien.js', 'js/util.js', 'js/sketch.js', 'js/prompter.js', 'js/aufnahme.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Bei schlechtem Netz nicht ewig warten: nach 3 Sekunden die gespeicherte Fassung nehmen
      const netz = await Promise.race([
        fetch(req),
        new Promise((_, nein) => setTimeout(() => nein(new Error('zu langsam')), 3000)),
      ]);
      if (netz.ok) cache.put(req, netz.clone());
      return netz;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
    }
  })());
});
