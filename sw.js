// Counter Book offline cache. Bump CACHE_NAME (e.g. v2, v3...) any time index.html is updated
// on GitHub, so returning devices pick up the new version instead of the old cached one.
const CACHE_NAME = "counter-book-v4";
const APP_FILES = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Network-first: try to fetch the latest version when online (so you see updates right away),
// fall back to the cached copy when offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPageDocument = event.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/");
  if(isPageDocument){
    // `cache:"no-store"` alone stops THIS DEVICE from reusing its own old copy, but it can't
    // make GitHub Pages' own CDN skip its edge cache, and some Android WebView versions don't
    // fully honor no-store inside a service worker either. A changing query string defeats all
    // of that at once — a different URL is a different resource to every one of those layers,
    // so none of them has a stale copy to serve in the first place. The cache is still read
    // and written using the ORIGINAL request (without the cache-busting param) so the offline
    // fallback below keeps working normally.
    const bustedUrl = new URL(url); bustedUrl.searchParams.set("_cb", Date.now());
    event.respondWith(
      fetch(bustedUrl.toString(), { cache: "no-store" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
