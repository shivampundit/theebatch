const CACHE_PREFIX = "batch-2025-26-";
const CACHE_NAME = CACHE_PREFIX + "v6";
const SHELL = [
  "./",
  "./index.html",
  "./journey.html",
  "./albums.html",
  "./visits.html",
  "./activities.html",
  "./classroom.html",
  "./speakers.html",
  "./yearbook.html",
  "./private.html",
  "./saved.html",
  "./about.html",
  "./offline.html",
  "./inaugurate.html",
  "./css/styles.css",
  "./css/pages.css",
  "./css/ceremony.css",
  "./js/app.js",
  "./js/inaugurate.js",
  "./js/private-gallery.js",
  "./data/portal-data.js",
  "./assets/icons/monogram.svg",
  "./media/albums/chairman/01.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const relativePath = url.href.slice(self.registration.scope.length);
  const isMedia = relativePath.startsWith("media/");
  const fromNetwork = async () => {
    const response = await fetch(event.request);
    if (response.ok && !url.search) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  };
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isMedia) return (await cache.match(event.request)) || fromNetwork();
    try {
      const response = await fromNetwork();
      if (response.ok) return response;
      return (await cache.match(event.request)) || response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        // Photo share URLs reuse the cached document; the query is handled locally.
        const plainUrl = new URL(event.request.url);
        plainUrl.search = "";
        const document = await cache.match(plainUrl.href);
        if (document) return document;
        const offline = await cache.match(new URL("./offline.html", self.registration.scope).href);
        if (offline) {
          const html = (await offline.text()).replace("<head>", '<head><base href="' + self.registration.scope + '">');
          return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
      }
      throw error;
    }
  })());
});
