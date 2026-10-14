// Cho trang mở được khi mất mạng: trả bản đã lưu ngay, đồng thời tải bản mới về cho lần mở sau.
// Đổi số phiên bản khi muốn xóa sạch bộ nhớ đệm cũ.
const CACHE = "giu-lua-v2";
const SHELL = ["./", "index.html", "app.js", "data.js", "intro.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];
// Ảnh trong img/ không cần liệt kê: lần đầu xem tới là được lưu lại để dùng khi mất mạng.

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  const own = u.origin === location.origin;
  // Thư viện Firebase (đường dẫn có số phiên bản, không đổi) và font chữ cũng lưu lại để dùng khi offline
  const lib = u.href.startsWith("https://www.gstatic.com/firebasejs/") || u.host === "fonts.googleapis.com" || u.host === "fonts.gstatic.com";
  if (!own && !lib) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: own });
    const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
