/* Arrowquip Pre-Booking — service worker.
   Deliberately conservative:
   - the app document is network-first, so a deploy is picked up immediately and a
     stale shell can never mask a broken build;
   - only fonts, icons and the logo are cache-first (immutable, versioned by name);
   - Supabase, Salesforce, Nominatim and OSM tiles are NEVER cached. Plan data must
     always come from the network, or a stale tab could show a plan that no longer
     exists. */
const CACHE = 'aq-prebooking-v1';
const PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/aq-logo-red-white-horizontal.png',
  '/fonts/frutiger/FrutigerLTStd-Cn.otf',
  '/fonts/frutiger/FrutigerLTStd-BoldCn.otf',
  '/fonts/frutiger/FrutigerLTStd-BlackCn.otf',
  '/fonts/frutiger/FrutigerLTStd-ExtraBlackCn.otf',
  '/fonts/frutiger/FrutigerLTStd-LightCn.otf'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(PRECACHE.map(function (u) {
      return c.add(u).catch(function () { /* a missing asset must not fail install */ });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                           .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function neverCache(url) {
  return url.hostname.indexOf('supabase.co') >= 0
      || url.hostname.indexOf('nominatim') >= 0
      || url.hostname.indexOf('tile.openstreetmap') >= 0
      || url.pathname.indexOf('/api/') === 0;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (neverCache(url)) return;                     /* straight to network, untouched */

  var isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  if (isDoc) {                                     /* network-first */
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  if (url.origin === location.origin) {            /* cache-first for our own static assets */
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (r) {
          if (r && r.status === 200) {
            var copy = r.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return r;
        });
      })
    );
  }
});
