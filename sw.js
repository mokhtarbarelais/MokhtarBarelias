/* ═══════════════════════════════════════════════════════════════
   Service Worker — مكتب المختار للصيرفة
   • network-first عالـ HTML  → دايماً آخر نسخة لما في نت، والكاش بس أوفلاين
   • auto-update             → النسخة الجديدة بتسيطر فوراً وبتعمل reload ناعم
   • 🔒 بيتجاهل Firestore وكل APIs فايربيز تماماً → المزامنة ما بتتأثّر أبداً
   ─────────────────────────────────────────────────────────────────
   ⚠️ مهم: بدّل رقم CACHE_VERSION بكل deploy جديد (مع APP_BUILD).
   ═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'makhtar-v84';          // ← بدّل الرقم بكل deploy
const CORE = ['./', './index.html'];

// المضيفات الوحيدة المسموح تخزينها — أي شي غيرها (Firestore، APIs) ما منلمسو نهائياً
const CACHE_HOSTS = [
  self.location.host,        // ملفات التطبيق نفسه
  'fonts.googleapis.com',    // خط Cairo (CSS)
  'fonts.gstatic.com',       // ملفات الخط
  'www.gstatic.com',         // Firebase SDK (سكربتات فقط — مش APIs)
  'cdnjs.cloudflare.com'     // LZString
];

// التثبيت: خزّن النواة + فعّل النسخة الجديدة فوراً (ما تنتظر بالطابور)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(CORE)).catch(() => {})
  );
});

// التفعيل: امسح كل الكاشات القديمة + سيطر على كل التبويبات المفتوحة فوراً
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // أي كتابة/POST — ما منلمسها

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // 🔒 أي مضيف مش بالقائمة (متل firestore.googleapis.com) → ما منتدخّل خالص
  //    هيدا يلي بيخلّي المزامنة تشتغل بدون ما الـ SW يعترضها.
  if (CACHE_HOSTS.indexOf(url.host) === -1) return;

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  // ── الصفحة (HTML) → network-first ──
  // لما في نت: ياخد آخر نسخة من السيرفر دايماً (= ما في نسخة قديمة عالقة)
  // أوفلاين: بيرجع للنسخة المخزّنة
  if (isHTML && url.host === self.location.host) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const c = await caches.open(CACHE_VERSION);
        c.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(req)) ||
               (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               Response.error();
      }
    })());
    return;
  }

  // ── باقي الموارد المسموحة (خط/SDK/مكتبة) → stale-while-revalidate ──
  // سريع من الكاش، ويحدّث بالخلفية
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const fetching = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        caches.open(CACHE_VERSION).then((c) => { try { c.put(req, res.clone()); } catch (_) {} });
      }
      return res;
    }).catch(() => cached);
    return cached || fetching;
  })());
});

// تفعيل فوري عند طلب الصفحة (احتياطي)
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
