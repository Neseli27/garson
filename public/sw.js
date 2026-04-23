// ══════════════════════════════════════════════════════════
// Sanal Garson v4 — Service Worker (Adım 4: PWA güçlendirme)
// ══════════════════════════════════════════════════════════
//
// Strateji:
// - Her deploy'da CACHE_VERSION'u artır (ya da build hash'i otomatik koy)
// - Eski versiyon cache'leri activate'te temizlenir
// - API istekleri SW'den geçmez (her zaman network)
// - HTML (navigate): network-first + cache fallback (çevrimiçiyken tazelik, offline iken uygulama açılır)
// - Static assets (JS/CSS/font/img): cache-first + background refresh
// - Sessiz güncelleme: skipWaiting() + clients.claim() — kullanıcıya soru sormadan yeni SW devralır
//   Bir sonraki sayfa açılışında yeni versiyon aktif olur (mevcut tab'de mid-session güncelleme olmaz, doğru davranış)

const CACHE_VERSION = 'v5-2026-04-23';
const CACHE_STATIC  = `sg-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `sg-runtime-${CACHE_VERSION}`;

// Uygulamanın ilk açılışta hemen cache'lenecek çekirdek dosyaları
// (Vite build çıktısında hash'li olacağı için runtime cache'e güveniyoruz; buraya sadece kök shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ══════════════════════════════════════════════════════════
// INSTALL — precache + beklemeden aktif ol
// ══════════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {
        // Bir dosya cache'lenmezse install'ı bozma, sessizce devam
      }))
      .then(() => self.skipWaiting())
  );
});

// ══════════════════════════════════════════════════════════
// ACTIVATE — eski cache'leri sil
// NOT: clients.claim() BİLEREK kullanılmıyor — mevcut açık tab'ler eski SW ile devam etsin.
// Yeni SW sadece yeni açılan sekmeleri/sayfa yenilemelerini devralır.
// Bu, mid-session yarım kalmış işlemleri korur (sipariş verirken güncelleme olsa bile kesinti olmaz).
// ══════════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('sg-') && k !== CACHE_STATIC && k !== CACHE_RUNTIME)
          .map(k => caches.delete(k))
      )
    )
  );
});

// ══════════════════════════════════════════════════════════
// FETCH — strateji dispatcher
// ══════════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Sadece GET istekleri cache'lenir
  if (req.method !== 'GET') return;

  // API ve PHP istekleri: SW'den geçmesin — her zaman taze veri
  if (url.pathname.includes('/garson-api/') || url.pathname.endsWith('.php')) return;

  // QR kod generator (external) ve cross-origin istekler: bypass
  if (url.origin !== self.location.origin) return;

  // HTML navigate istekleri: network-first (çevrimiçiyken tazelik, offline iken app shell)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Statik asset'ler (JS, CSS, font, img): cache-first + arka planda tazele
  event.respondWith(cacheFirstWithRefresh(req));
});

// ── Network-first: önce network dene, başarısız olursa cache'ten ver ──
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(CACHE_RUNTIME).then(c => c.put(req, clone)).catch(() => {});
    }
    return res;
  } catch (err) {
    // Offline — cache'ten shell döndür
    const cached = await caches.match(req);
    if (cached) return cached;
    // Cache'te de yoksa kök shell'e düş (SPA için güvenli)
    const fallback = await caches.match('/index.html') || await caches.match('/');
    if (fallback) return fallback;
    // Son çare — basit offline sayfası
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Sanal Garson</title>' +
      '<style>body{font-family:sans-serif;background:#0b0704;color:#f0ddc4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}</style>' +
      '<div><div style="font-size:48px;margin-bottom:16px">📡</div>' +
      '<div style="font-size:20px;margin-bottom:8px">Bağlantı yok</div>' +
      '<div style="color:#7a6448;font-size:14px">İnternetinizi kontrol edin ve sayfayı yenileyin.</div></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── Cache-first + arka planda tazele ──
async function cacheFirstWithRefresh(req) {
  const cached = await caches.match(req);
  const networkPromise = fetch(req).then(res => {
    if (res && res.ok) {
      const clone = res.clone();
      caches.open(CACHE_RUNTIME).then(c => c.put(req, clone)).catch(() => {});
    }
    return res;
  }).catch(() => null);

  // Cache'te varsa hemen ver, arka planda tazeleme devam etsin
  if (cached) return cached;

  // Cache'te yoksa network'i bekle
  const networkRes = await networkPromise;
  if (networkRes) return networkRes;

  // Hiçbir şey yoksa 504
  return new Response('Offline', { status: 504, statusText: 'Gateway Timeout' });
}
