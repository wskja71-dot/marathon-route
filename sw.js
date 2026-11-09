/* 종교교회 길찾기 - 설치형 웹앱 서비스 워커
   - 페이지(index.html)는 항상 최신 것을 먼저 받아 오고, 인터넷이 안 될 때만 저장본을 씁니다.
   - 지도 라이브러리·아이콘·로고처럼 잘 안 바뀌는 파일은 저장본을 씁니다.
   - 배경 지도 타일, 도로 데이터, 길안내 앱 연결은 건드리지 않습니다. */
const CACHE = 'jg-route-v2';
const CORE = [
  './',
  './index.html',
  './events.json',
  './manifest.webmanifest',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/maplibre/maplibre-gl.css',
  './vendor/maplibre/maplibre-gl.js',
  './vendor/maplibre/leaflet-maplibre-gl.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 외부(지도·도로 데이터)는 그대로

  if(url.pathname === new URL('./events.json', self.registration.scope).pathname){
    e.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const res=await fetch(req,{cache:'no-cache'});
        if(!res.ok || !Array.isArray((await res.clone().json()).events)) throw Error('events');
        await cache.put(req,res.clone());
        return res;
      }catch{
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if (isPage) {
    // 최신 우선
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // 그 밖의 같은 사이트 파일: 저장본 우선, 없으면 받아서 저장
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }))
  );
});
