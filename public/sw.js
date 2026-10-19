// Offline shell. Pages: network first, fall back to cache. Assets and photos: cache first, refresh behind.
const V = "obv-2";
const BASE = new URL(self.registration.scope).pathname;
const CORE = [BASE, `${BASE}cart/`, `${BASE}saved/`, `${BASE}rent/`, `${BASE}catalog.json`, `${BASE}offline/`];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  const sameApp = url.origin === location.origin && url.pathname.startsWith(BASE) && !url.pathname.startsWith(`${BASE}admin`);
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameApp && !fonts) return;

  if (req.mode === "navigate" || url.pathname.endsWith("catalog.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); return res; })
        .catch(async () => (await caches.match(req, { ignoreSearch: true })) || caches.match(`${BASE}offline/`)),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(V).then((c) => c.put(req, copy)); }
        return res;
      });
      return hit || net;
    }),
  );
});
