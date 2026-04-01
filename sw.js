const CACHE_NAME = 'k-media-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/share/index.html'
];

// 安装时缓存静态 UI
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活时清理旧版本缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 策略：网络优先（保证数据实时），失效时回退到缓存
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return; // 接口不缓存

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
