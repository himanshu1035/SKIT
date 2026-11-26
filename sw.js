var CACHE_NAME = "skit-shop-v11";
var FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/css/theme.css",
  "/js/supabase.min.js",
  "/js/app.js",
  "/pages/login.html",
  "/pages/signup.html",
  "/pages/home.html",
  "/pages/inventory.html",
  "/pages/add.html",
  "/pages/history.html",
  "/pages/profile.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  // Only handle same-origin requests; let external CDNs & Supabase bypass SW
  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Always fetch config fresh from network
  if (
    requestUrl.pathname.indexOf(".env.local") !== -1 ||
    requestUrl.pathname.indexOf("env.json") !== -1
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(function () {
      return caches.match(event.request).then(function (cached) {
        return cached || Response.error();
      });
    })
  );
});
