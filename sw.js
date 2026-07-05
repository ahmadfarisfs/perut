/* Perut Tracker service worker.
   VERSION is stamped with the commit SHA by the deploy workflow, so every
   deploy produces a byte-different worker — that is what triggers the
   in-app "new version" toast. Locally it stays as the placeholder. */
const VERSION = "__VERSION__";
const CACHE = "perut-" + VERSION;

const SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./vendor/chart.umd.js",
  "./vendor/chartjs-adapter-date-fns.bundle.min.js",
  "./vendor/supabase.js",
  "./assets/mark.svg",
  "./assets/favicon.svg",
  "./assets/site.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

/* The page posts this when the user taps "Update" in the toast. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* Daily check-in reminders arrive here (sent by the reminders workflow). */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data.json(); } catch { /* fall back to defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title || "Perut Tracker", {
      body: data.body || "Waktunya check-in.",
      icon: "./assets/icon-192.png",
      badge: "./assets/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) if ("focus" in win) return win.focus();
      return self.clients.openWindow("./");
    })
  );
});

/* App shell: cache-first (the whole shell is versioned atomically per deploy).
   Anything cross-origin — the Supabase API — is never intercepted, so data
   is always live. */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      return cached || fetch(event.request);
    })()
  );
});
