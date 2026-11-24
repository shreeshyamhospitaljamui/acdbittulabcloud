"use strict";

const CACHE_NAME = "acd-bittu-lab-shell-v2";

const CORE_FILES = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./subscription.html",
  "./print-report.js",
  "./print-report.css",
  "./platform-mode.js",
  "./offline-db.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const file of CORE_FILES) {
        try {
          await cache.add(file);
        } catch (err) {
          console.warn("SW precache skip:", file, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("acd-bittu-lab-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase API, Edge Functions, and Auth responses are never cached.
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/functions/v1/")
  ) {
    return;
  }

  // Cache external JS, CSS, fonts and images after online loading.
  if (
    url.origin !== self.location.origin &&
    ["script", "style", "font", "image"].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // App files: network first, cache fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          if (request.mode === "navigate") {
            return caches.match(
              new URL("./index.html", self.registration.scope).href
            );
          }

          return new Response("Offline: File is not available.", {
            status: 503,
            headers: { "Content-Type": "text/plain" }
          });
        })
    );
  }
});
