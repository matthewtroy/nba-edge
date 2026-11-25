const CACHE = "nba-edge-shell-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/nba-edge/", "/nba-edge/index.html"]).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isShellDocument(url) {
  return (
    url.pathname === "/nba-edge/" ||
    url.pathname === "/nba-edge/index.html" ||
    url.pathname.endsWith("/index.html")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith("/nba-edge/")) return;
  if (event.request.method !== "GET") return;

  if (url.pathname.includes("/data/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isShellDocument(url)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.open(CACHE).then((cache) => cache.match(event.request)).then((c) => c ?? Response.error())
        )
    );
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