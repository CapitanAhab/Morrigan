// Offline support. build.mjs fills in the version and file list.
// Screens always open from the copy saved on the phone (instant, works offline).
// When the site changes, this file changes: the browser installs it in the background with a fresh
// copy of everything, it takes over, and support.js reloads the Menu once.
const CACHE = 'morrigan-f1465debe6';
const FILES = [
  "./",
  "index.html",
  "story.html",
  "character.html",
  "familiars.html",
  "voices.html",
  "manifest.webmanifest",
  "app/app.css",
  "app/voices.js",
  "app/support.js",
  "app/fonts/cormorant-garamond-latin-500-italic.woff2",
  "app/fonts/cormorant-garamond-latin-500-normal.woff2",
  "app/fonts/cormorant-garamond-latin-600-normal.woff2",
  "app/fonts/jost-latin-300-normal.woff2",
  "app/fonts/jost-latin-400-normal.woff2",
  "app/fonts/jost-latin-500-normal.woff2",
  "assets/card_artifact.jpg",
  "assets/card_healer.jpg",
  "assets/card_merchant.jpg",
  "assets/card_soldier.jpg",
  "assets/card_wizard.jpg",
  "assets/fam_cat.webp",
  "assets/fam_octopus.webp",
  "assets/fam_owl.webp",
  "assets/fam_raven.webp",
  "assets/fam_spider.webp",
  "assets/morrigan_ink.webp",
  "assets/morrigan_token.webp",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req))
  );
});
