importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.6.1/workbox-sw.js');

workbox.googleAnalytics.initialize();

workbox.routing.registerRoute(
  /\/$/,
  workbox.strategies.networkFirst({
    cacheName: 'index',
  }),
);

workbox.routing.registerRoute(
  /\.(?:js|css)$/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: 'static-resources',
  }),
);

workbox.routing.registerRoute(
  /\.(?:png|gif|jpg|jpeg|svg)$/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
      new workbox.cacheableResponse.Plugin({
        statuses: [0, 200]
      }),
    ],
  }),
);

workbox.routing.registerRoute(
  /.*api\.mapbox\.com\/fonts/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: 'mapbox-fonts',
    plugins: [
      new workbox.cacheableResponse.Plugin({
        statuses: [0, 200]
      }),
    ],
  }),
);

workbox.routing.registerRoute(
  /.*(?:tiles\.mapbox|api\.mapbox)\.com.*$/,
  workbox.strategies.staleWhileRevalidate({
    cacheName: 'mapbox',
    plugins: [
      new workbox.expiration.Plugin({
        maxEntries: 50,
      }),
      new workbox.cacheableResponse.Plugin({
        statuses: [0, 200]
      }),
    ],
  }),
);