// Counter Book offline cache. Bump CACHE_NAME (e.g. v42, v43...) any time index.html is updated
// on GitHub, so returning devices pick up the new version.
const CACHE_NAME = "counter-book-v55";
const APP_FILES = ["./", "./index.html"];
// Big, versioned library files (Firebase SDK, OCR/barcode readers). They never change for a given
// URL, so after the first download they are served from the phone instead of the network.
const LIBRARY_HOSTS = ["www.gstatic.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache:"reload" = really fetch the newest copy, not an older one held by the browser/CDN
      Promise.all(APP_FILES.map((u) => fetch(u, { cache: "reload" }).then((r) => r.ok && cache.put(u, r))))
    )
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 1) Library scripts: cache-first (instant after the first visit).
  if (LIBRARY_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
    return;
  }

  // 2) The app page: show the saved copy IMMEDIATELY, refresh it in the background. (The old
  // "wait for the network first" rule made every launch wait for GitHub to answer.) A newly
  // published version is picked up in the background and used on the next open; bumping
  // CACHE_NAME above also triggers the in-app "new version" banner right away.
  const isPage = req.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/");
  if (isPage && url.origin === self.location.origin) {
    const busted = new URL(url); busted.searchParams.set("_cb", Date.now());
    const refresh = fetch(busted.toString(), { cache: "no-store" })
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => null);
    event.waitUntil(refresh);
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || refresh.then((r) => r || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // 3) Everything else (e.g. version.json): network first, saved copy if offline.
  event.respondWith(
    fetch(req, { cache: "no-store" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
