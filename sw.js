const CACHE = "masar-education-2-3-0";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./masar-core.js",
  "./masar-storage.js",
  "./masar-print-engine.js",
  "./masar-dashboard.js",
  "./masar-document-core.js",
  "./masar-lectures.js",
  "./masar-students.js",
  "./masar-exams.js",
  "./masar-grades-attendance.js",
  "./masar-engagement.js",
  "./masar-app-shell.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  "./favicon.png",
  "./fonts/Tajawal-Regular.woff",
  "./fonts/Tajawal-Medium.woff",
  "./fonts/Tajawal-Bold.woff",
  "./katex/katex.min.css",
  "./katex/katex.min.js",
  "./katex/fonts/KaTeX_AMS-Regular.woff2",
  "./katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "./katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "./katex/fonts/KaTeX_Main-Bold.woff2",
  "./katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "./katex/fonts/KaTeX_Main-Italic.woff2",
  "./katex/fonts/KaTeX_Main-Regular.woff2",
  "./katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "./katex/fonts/KaTeX_Math-Italic.woff2",
  "./katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "./katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "./katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "./katex/fonts/KaTeX_Script-Regular.woff2",
  "./katex/fonts/KaTeX_Size1-Regular.woff2",
  "./katex/fonts/KaTeX_Size2-Regular.woff2",
  "./katex/fonts/KaTeX_Size3-Regular.woff2",
  "./katex/fonts/KaTeX_Size4-Regular.woff2",
  "./katex/fonts/KaTeX_Typewriter-Regular.woff2"
];

self.addEventListener("install", (e) => {
  // نستخدم {cache:"reload"} صراحة عشان نتجاوز ذاكرة تخزين HTTP بالمتصفح نفسه (طبقة منفصلة تماماً عن ذاكرة الـ Service Worker) —
  // بدونها، قد نخزّن بصمت نسخة قديمة من ملف تغيّر محتواه لكن بقي اسمه كما هو
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // Promise.allSettled بدل Promise.all: لو ملف واحد فشل (مثلاً غير موجود)، البقية تتخزن بنجاح بدل ما يفشل التثبيت كله
    const results=await Promise.allSettled(ASSETS.map(async url=>{
      const res=await fetch(url,{cache:"reload"});
      if(!res.ok)throw new Error(url+":"+res.status);
      await c.put(url,res);
    }));
    const failed=results.filter(x=>x.status==="rejected");
    if(failed.length)console.warn("مسار التعليم: تعذّر تخزين بعض الملفات مسبقًا",failed);
  })());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return; // ما نتدخل بطلبات مواقع أخرى (مثل Supabase)
  if(e.request.mode==="navigate"){
    // شبكة أولاً لصفحة التطبيق نفسها: تضمن أحدث نسخة كل ما توفر اتصال، وتسقط لنسخة مخزّنة عند انقطاع الإنترنت
    e.respondWith(
      fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",clone));return res})
        .catch(()=>caches.match("./index.html"))
    );
    return;
  }
  // لبقية الملفات: نعرض النسخة المخزّنة فورًا (سرعة)، وبنفس الوقت نجيب نسخة جديدة بالخلفية ونحدّث الكاش تلقائيًا للمرة الجاية
  // (بدل الاعتماد فقط على ضغط زر "تحديث" يدويًا)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res.ok) { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, clone)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
