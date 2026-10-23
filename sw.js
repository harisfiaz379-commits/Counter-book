// Counter Book offline cache. Bump CACHE_NAME (e.g. v42, v43...) any time index.html is updated
// on GitHub, so returning devices pick up the new version.
const CACHE_NAME = "counter-book-v126";
// Every cache this service worker ever creates is named with this prefix. The activate handler
// below only ever deletes caches that start with it — if this origin ever hosts another app or
// another service worker (e.g. a different project under the same GitHub Pages username), its
// caches share the same per-origin CacheStorage but never match this prefix, so they're left
// alone instead of being wiped out on every Counter Book update.
const CACHE_PREFIX = "counter-book-";
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
      // Only ever delete OUR OWN old cache versions (counter-book-v123, -v124, ...), never a cache
      // that doesn't carry our prefix — CacheStorage is shared per-origin, not per-service-worker,
      // so an unprefixed name could belong to something else entirely hosted on the same origin.
      Promise.all(
        names
          .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
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
          if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}); }
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
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => null);
    event.waitUntil(refresh);
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || refresh.then((r) => r || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }

  // 3) Any other request on OUR OWN origin (e.g. version.json, icons, manifest): network first,
  // saved copy if offline. These are static assets we control, so caching the response is safe.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {}); }   // never replace a good saved copy with an error page
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 4) Everything else is a cross-origin request we don't control and haven't explicitly
  // allow-listed above (Firestore reads/writes, Firebase installations/auth, the Gemini API,
  // the print-server bridge, etc.). These are live, dynamic, often account- or query-specific —
  // caching a response here could silently replay stale sync data, a stale AI answer, or a
  // stale auth/installation response later. So this service worker doesn't touch them at all:
  // no cache read, no cache write, straight to the network, letting the page's own code handle
  // a failure (e.g. the app's existing offline/online sync-status handling).
});
