/* SYNAPSE service worker: makes the app work offline after the first visit.
 * - VERSION and PRECACHE are filled in at build time by scripts/inject-sw-manifest.mjs.
 * - Pyodide (the in-browser Python runtime) lives in its own cache so deploys don't re-download it.
 */
const VERSION = "__SW_VERSION__";
const PRECACHE = /*__PRECACHE__*/ [];
// true for the static (GitHub Pages) build: one app shell serves every route.
const SPA = /*__SPA__*/ false;
const PYODIDE_VERSION = "0.29.4";
// The app may live in a sub-path (e.g. /SYNAPSE.5/ on GitHub Pages), so everything is
// resolved against the service worker's own scope.
const SCOPE = new URL(self.registration.scope).pathname;
const abs = (u) => (u.startsWith("/") ? u : SCOPE + u);
const PYODIDE_FILES = [
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
].map((f) => SCOPE + "pyodide/" + f);
const STATIC_PAGES = SPA
  ? [SCOPE]
  : ["", "learn", "flash", "lab", "match", "recall", "you"].map((p) => SCOPE + p);

const STATIC_CACHE = "synapse-static-" + VERSION;
const PAGES_CACHE = "synapse-pages-" + VERSION;
const PYODIDE_CACHE = "synapse-pyodide-" + PYODIDE_VERSION;

async function putPage(cache, url) {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html"))
      await cache.put(new URL(url, self.location.origin).pathname, res);
  } catch {
    /* offline or failed: skip, it will be retried on a later visit */
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const statics = await caches.open(STATIC_CACHE);
      await statics.addAll(PRECACHE.map(abs));
      const py = await caches.open(PYODIDE_CACHE);
      for (const f of PYODIDE_FILES) {
        if (!(await py.match(f))) await py.add(f);
      }
      const pages = await caches.open(PAGES_CACHE);
      await Promise.all(STATIC_PAGES.map((u) => putPage(pages, u)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE, PYODIDE_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith("synapse-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (SPA || !data || data.type !== "precache" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES_CACHE);
      const queue = data.urls.filter((u) => typeof u === "string" && u.startsWith("/"));
      const workers = Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const url = queue.shift();
          if (!(await pages.match(url))) await putPage(pages, url);
        }
      });
      await Promise.all(workers);
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function navigate(request) {
  const cache = await caches.open(PAGES_CACHE);
  const path = new URL(request.url).pathname;
  try {
    const res = await fetch(request);
    const type = res.headers.get("content-type") || "";
    if (res.ok && type.includes("text/html")) cache.put(SPA ? SCOPE : path, res.clone());
    return res;
  } catch (err) {
    // Offline: use the cached page, or (static build) the app shell, which can render any route.
    const hit = (await cache.match(SPA ? SCOPE : path)) || (await cache.match(SCOPE));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  if (!path.startsWith(SCOPE)) return;
  if (path.startsWith(SCOPE + "pyodide/")) {
    event.respondWith(cacheFirst(request, PYODIDE_CACHE));
  } else if (path.startsWith(SCOPE + "assets/") || path === SCOPE + "favicon.svg") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  }
});
