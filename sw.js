'use strict';
// ---------------------------------------------------------------------------
// Service Worker – nur für die Online-Fassung auf GitHub Pages (installierbare App, Start ohne Internet).
// Nicht Teil des Releases (tools/pack.js lässt ihn weg). Registriert in ui.js, nur über https bzw. localhost.
//
// Strategie „erst das Netz, dann der Zwischenspeicher“: Online kommt immer die aktuelle Fassung (keine veralteten
// Stände nach einem Update); jede geladene Datei wird dabei für den Offline-Fall aufbewahrt. Ohne Netz startet die
// App aus dem Zwischenspeicher.
// „Erst das Netz“ heißt: jedes Mal beim Server nachfragen (cache: 'no-cache'). GitHub Pages erlaubt dem Browser sonst,
// Dateien 10 Minuten ungefragt wiederzuverwenden – nach einem Update lief dann noch die alte Fassung, im ungünstigen Fall
// neue Seite mit alten Skripten. Unveränderte Dateien bestätigt der Server nur knapp („unverändert“, 304).
// ---------------------------------------------------------------------------
const CACHE = 'archipel-v1';
const CORE = ['./', 'index.html', 'favicon.svg', 'manifest.webmanifest',
  'js/data.js', 'js/map.js', 'js/game.js', 'js/ai.js', 'js/gfx.js', 'js/sfx.js',
  'js/ui-karte.js', 'js/ui-zug.js', 'js/ui-leiste.js', 'js/ui-fenster.js', 'js/ui-eingabe.js', 'js/ui-schau.js', 'js/ui-start.js'];

// Aufrufe der Seite selbst (mode 'navigate') lassen sich nicht in jedem Browser mit geänderten Optionen nachbauen – dort über die Adresse
const fromNet = req => req.mode === 'navigate'
  ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
  : fetch(req, { cache: 'no-cache' });
// An die Seite geht jede Antwort mit „Cache-Control: no-cache“. Sonst nimmt Chrome beim Neuladen im selben Tab die Skripte
// ungefragt aus seinem Arbeitsspeicher (dort gelten die 10 Minuten von GitHub Pages weiter) – die Anfrage erreicht diesen
// Service Worker dann gar nicht, und zur frischen Seite kämen alte Skripte (im Test nachgewiesen).
const askFirst = res => {
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'no-cache' }))))
    .catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('archipel-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Erklärvideos und Werkzeuge gehören nicht zum Spiel: nicht abfangen, nicht zwischenspeichern
  // (Videos kommen außerdem in Teilstücken – Antworten mit Status 206 lassen sich nicht speichern)
  if (/\/(docs|tools)\//.test(url.pathname) || req.headers.has('range')) return;
  e.respondWith(
    fromNet(req).then(res => {
      if (!res.ok) return res;
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      return askFirst(res);
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
