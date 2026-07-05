/* دليل المواطن — Service Worker (اختياري) */
/* يخلّي التطبيق يفتح حتى بدون إنترنت بعد أول زيارة. */
/* غيّر رقم النسخة لما تنشر تحديث، حتى يتحدّث الكاش عند الناس. */
const CACHE = "daleel-mukhtar-v5-3";

const SHELL = [
  "./",
  "./index.html",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Reem+Kufi:wght@500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(SHELL.map((u) => c.add(u)))
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // التنقّل (فتح الصفحة): الشبكة أولاً، وإذا ما في نت رجّع index من الكاش
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // باقي الطلبات: الكاش أولاً، وإلا الشبكة (ونخزّن نسخة)
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (req.url.startsWith("http"))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
