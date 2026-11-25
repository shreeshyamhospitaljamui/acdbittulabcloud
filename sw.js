"use strict";

const CACHE_NAME = "acd-bittu-lab-offline-v8";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./subscription.html",
  "./verify.html",
  "./print-report.js",
  "./print-report.js?v=7",
  "./print-report.css",
  "./print-report.css?v=6",
  "./platform-mode.js",
  "./offline-db.js",
  "./manifest.webmanifest"
];

const CDN_ASSETS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch (e) {}
      }
      for (const cdnUrl of CDN_ASSETS) {
        try {
          const resp = await fetch(cdnUrl, { mode: "cors" });
          if (resp && resp.ok) await cache.put(cdnUrl, resp);
        } catch (e) {}
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
          .filter(k => k.startsWith("acd-bittu-lab-") && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept live Supabase API calls
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/functions/v1/")
  ) {
    return;
  }

  // Cache-First for external CDN libraries (instant offline boot)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => new Response("", { status: 504 }));
      })
    );
    return;
  }

  // Stale-While-Revalidate / Instant Cache Fallback for App Shell
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const networkFetch = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Return cached instantaneously for ultra-fast load, update in background
        return cached;
      }

      return networkFetch.then(res => {
        if (res) return res;
        if (req.mode === "navigate") {
          return caches.match("./dashboard.html") || caches.match("./index.html");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});
