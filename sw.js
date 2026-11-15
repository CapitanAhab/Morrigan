// Offline cache for the app. build.py fills in the version and file list.
const CACHE = 'morrigan-1c66fc7a3f';
const FILES = [
  "./",
  "index.html",
  "story.html",
  "character.html",
  "familiars.html",
  "manifest.webmanifest",
  "app/app.css",
  "app/support.js",
  "app/fonts/cormorant-garamond-latin-500-italic.woff2",
  "app/fonts/cormorant-garamond-latin-500-normal.woff2",
  "app/fonts/cormorant-garamond-latin-600-italic.woff2",
  "app/fonts/cormorant-garamond-latin-600-normal.woff2",
  "app/fonts/jost-latin-300-normal.woff2",
  "app/fonts/jost-latin-400-normal.woff2",
  "app/fonts/jost-latin-500-normal.woff2",
  "assets/cackle.webm",
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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
