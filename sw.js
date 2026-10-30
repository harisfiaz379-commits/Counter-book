// Counter Book offline cache. Bump CACHE_NAME (e.g. v42, v43...) any time index.html is updated
// on GitHub, so returning devices pick up the new version.
const CACHE_NAME = "counter-book-v176";
// Every cache this service worker ever creates is named with this prefix. The activate handler
// below only ever deletes caches that start with it — if this origin ever hosts another app or
// another service worker (e.g. a different project under the same GitHub Pages username), its
// caches share the same per-origin CacheStorage but never match this prefix, so they're left
// alone instead of being wiped out on every Counter Book update.
const CACHE_PREFIX = "counter-book-";
// The big library files (Firebase, OCR, barcode) live in their OWN cache whose name never changes, so an app
// update (a new CACHE_NAME above) no longer deletes them. Without this, the first launch after every update
// had to download them again — and if that launch was offline, sync and scanning could not start.
const LIB_CACHE = "counter-book-libs";
const APP_FILES = ["./", "./index.html"];
// Big, versioned library files (Firebase SDK, OCR/barcode readers). They never change for a given
// URL, so after the first download they are served from the phone instead of the network.
const LIBRARY_HOSTS = ["www.gstatic.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"];
const isLibraryUrl = (u) => { try { return LIBRARY_HOSTS.includes(new URL(u).hostname); } catch (e) { return false; } };

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
    caches.keys().then(async (names) => {
      // Only ever touch OUR OWN caches (counter-book-...), never one without our prefix — CacheStorage is shared
      // per-origin, so an unprefixed name could belong to something else hosted on the same origin.
      const ours = names.filter((n) => n.startsWith(CACHE_PREFIX));
      const old = ours.filter((n) => n !== CACHE_NAME && n !== LIB_CACHE);
      // One-time rescue: library files already downloaded into an older versioned cache are copied into the
      // permanent library cache before that old cache is deleted, so this very update doesn't lose them.
      try {
        const libs = await caches.open(LIB_CACHE);
        for (const n of old) {
          const c = await caches.open(n);
          for (const r of await c.keys()) {
            if (!isLibraryUrl(r.url)) continue;
            if (await libs.match(r)) continue;
            const res = await c.match(r);
            if (res) await libs.put(r, res);
          }
        }
      } catch (e) { /* rescue is best-effort; a missing library is simply downloaded again */ }
      await Promise.all(old.map((n) => caches.delete(n)));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 1) Library scripts: cache-first from the permanent library cache (instant after the first visit).
  // The first download asks for a readable (CORS) copy so a 404/error page is never saved as if it were the
  // library; if that isn't possible the old behaviour (save whatever came back) is the fallback.
  if (LIBRARY_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(LIB_CACHE).then((lib) =>
        lib.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req.url, { mode: "cors", credentials: "omit" })
            .then((res) => {
              if (res && res.ok) lib.put(req, res.clone()).catch(() => {});
              return res;                                  // an error response is passed on, never saved
            })
            .catch(() =>
              fetch(req).then((res) => {
                if (res && (res.ok || res.type === "opaque")) lib.put(req, res.clone()).catch(() => {});
                return res;
              })
            );
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
