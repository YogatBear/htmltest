const CACHE_NAME = 'arnacon-v2';
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
        console.log('Service Worker: Pre-caching essential files');
        // Use addAll for faster initial caching - it's atomic and faster
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('Service Worker: Pre-caching complete');
      })
      .catch(function(error) {
        console.error('Service Worker: Pre-caching failed', error);
        // Fallback to individual caching if addAll fails
        return caches.open(CACHE_NAME).then(function(cache) {
          const cachePromises = urlsToCache.map(function(url) {
            return fetch(url)
              .then(function(response) {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(function(error) {
                console.warn('Service Worker: Failed to cache', url, error);
              });
          });
          return Promise.all(cachePromises);
        });
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
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version immediately if found
        if (response) {
          return response;
        }
        
        // Try to match without query parameters for HTML files
        const url = new URL(event.request.url);
        if (url.pathname.endsWith('.html')) {
          const baseUrl = url.origin + url.pathname;
          return caches.match(baseUrl).then(function(cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If not in cache, fetch from network (but don't log excessively)
            return fetchAndCache(event.request);
          });
        }
        
        // For non-HTML files, try network
        return fetchAndCache(event.request);
      })
  );
});

// Helper function to fetch and cache
function fetchAndCache(request) {
  return fetch(request).then(function(response) {
    // Don't cache non-successful responses or non-basic responses
    if (!response || response.status !== 200 || response.type !== 'basic') {
      return response;
    }

    // Only cache certain file types to avoid bloating cache
    const url = new URL(request.url);
    const shouldCache = url.pathname.endsWith('.html') || 
                       url.pathname.endsWith('.css') || 
                       url.pathname.endsWith('.js') || 
                       url.pathname.endsWith('.woff2') || 
                       url.pathname.endsWith('.json');

    if (shouldCache) {
      // Clone the response as it can only be consumed once
      const responseToCache = response.clone();
      
      caches.open(CACHE_NAME)
        .then(function(cache) {
          cache.put(request, responseToCache);
        })
        .catch(function(error) {
          // Silently handle cache errors to avoid disrupting the response
        });
    }

    return response;
  }).catch(function(error) {
    // Return a basic error response instead of throwing
    return new Response('Network error', { 
      status: 408, 
      statusText: 'Network timeout' 
    });
  });
}

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
