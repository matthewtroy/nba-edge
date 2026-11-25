const CACHE = "nba-edge-shell-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/nba-edge/", "/nba-edge/index.html"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith("/nba-edge/")) return;
  if (event.request.method !== "GET") return;

  if (url.pathname.includes("/data/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res.ok && url.pathname.endsWith(".html")) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch {
        return cached ?? Response.error();
      }
    })
  );
});