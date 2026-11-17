'use strict';
// ---------------------------------------------------------------------------
// Service Worker – nur für die Online-Fassung auf GitHub Pages (installierbare App, Start ohne Internet).
// Nicht Teil des Releases (tools/pack.js lässt ihn weg). Registriert in ui.js, nur über https bzw. localhost.
//
// Strategie „erst das Netz, dann der Zwischenspeicher“: Online kommt immer die aktuelle Fassung (keine veralteten
// Stände nach einem Update); jede geladene Datei wird dabei für den Offline-Fall aufbewahrt. Ohne Netz startet die
// App aus dem Zwischenspeicher.
// ---------------------------------------------------------------------------
const CACHE = 'archipel-v1';
const CORE = ['./', 'index.html', 'favicon.svg', 'manifest.webmanifest',
  'js/data.js', 'js/map.js', 'js/game.js', 'js/ai.js', 'js/gfx.js', 'js/sfx.js', 'js/ui.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('archipel-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
