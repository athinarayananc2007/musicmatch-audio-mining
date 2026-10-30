/**
 * MusicMatch PWA Service Worker
 * ================================
 * Implements a Cache-First strategy for static assets and
 * a Network-First strategy for API calls so the app works offline.
 *
 * Cache strategy:
 *   Static assets (HTML, CSS, JS, fonts) → Cache-First
 *   /api/* requests                       → Network-First (fallback to cache)
 *   Everything else                        → Network-First
 */

const CACHE_NAME    = "musicmatch-v8";
const OFFLINE_PAGE  = "/offline.html";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/features.html",
  "/how-it-works.html",
  "/about.html",
  "/contact.html",
  "/demo.html",
  "/css/style.css",
  "/js/main.js",
  "/js/scene.js",
  "/js/auth.js",
  "/js/demo.js",
  "/manifest.json",
  "/offline.html",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"
];

// ─── Install: Pre-cache all static assets ─────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache each asset individually — don't let one 404 break everything
      await Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn(`[SW] Could not cache: ${url}`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── Activate: Remove old caches ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log("[SW] Deleting old cache:", key);
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: Route requests ────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  // HTML navigation & scripts & API requests → Network-First
  // Ensures fresh HTML and JS logic on every navigation, falling back to cache offline
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/") ||
    url.pathname === "" ||
    url.pathname.includes("/js/") ||
    url.pathname.startsWith("/api/") ||
    url.hostname === "api.spotify.com"
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (CSS, images, fonts, vendor libs) → Cache-First
  event.respondWith(cacheFirst(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  let cached = await caches.match(request);
  if (!cached && new URL(request.url).pathname === "/") {
    cached = await caches.match("/index.html");
  }
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline fallback for navigations
    if (request.mode === "navigate") {
      return caches.match(OFFLINE_PAGE) || new Response("<h1>Offline</h1>", {
        headers: { "Content-Type": "text/html" }
      });
    }
    throw _;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    let cached = await caches.match(request);
    if (!cached && (request.mode === "navigate" || new URL(request.url).pathname === "/")) {
      cached = await caches.match("/index.html");
    }
    if (cached) return cached;

    if (request.mode === "navigate") {
      return caches.match(OFFLINE_PAGE) || new Response("<h1>Offline</h1>", {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response(JSON.stringify({
      status: "error",
      error: "You are offline. Please reconnect to use the MusicMatch API."
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}
