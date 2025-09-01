const CACHE_NAME = 'arnacon-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.html',
  '/calllog.html',
  '/chat.html',
  '/dialer.html',
  '/errorwindow.html',
  '/imagepicker.html',
  '/incall.html',
  '/incomingcall.html',
  '/mainscreen.html',
  '/recentcalls.html',
  '/recentsessions.html',
  '/ringing.html',
  '/assets/fonts/fonts.css',
  '/assets/fonts/sf-pro-display.css',
  '/assets/fonts/sf-pro-text.css',
  '/assets/fonts/system-fonts.css',
  '/assets/icons/material-icons.css',
  '/assets/icons/material-symbols.css',
  '/assets/icons/MaterialIcons-Regular.woff2',
  '/assets/icons/MaterialSymbolsOutlined-Regular.woff2',
  '/manifest.json'
];

// Install event - cache all resources
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Starting to cache', urlsToCache.length, 'files');
        
        // Cache files individually to handle failures gracefully
        const cachePromises = urlsToCache.map(function(url, index) {
          return fetch(url)
            .then(function(response) {
              if (response.ok) {
                console.log('Service Worker: Caching', url, '- Status:', response.status);
                return cache.put(url, response);
              } else {
                console.error('Service Worker: Failed to fetch', url, '- Status:', response.status);
                return Promise.resolve(); // Continue with other files
              }
            })
            .catch(function(error) {
              console.error('Service Worker: Error fetching', url, '- Error:', error);
              return Promise.resolve(); // Continue with other files
            });
        });
        
        return Promise.all(cachePromises);
      })
      .then(function() {
        console.log('Service Worker: Installation complete');
      })
      .catch(function(error) {
        console.error('Service Worker: Installation failed', error);
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then(function(response) {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response as it can only be consumed once
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(function(error) {
          console.log('Service Worker: Network fetch failed', error);
          // You could return a fallback page here if needed
          throw error;
        });
      })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_CACHE_CONTENTS') {
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.keys();
    }).then(function(requests) {
      const urls = requests.map(function(request) {
        return request.url;
      });
      console.log('Service Worker: Cache contents:', urls);
      event.ports[0].postMessage({
        type: 'CACHE_CONTENTS',
        urls: urls
      });
    });
  }
});
