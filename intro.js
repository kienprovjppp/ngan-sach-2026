/* Lời chào khi mở app: "mày lại tiêu tiền đúng không ?"
   Từng chữ trượt lên. Dấu ? hóa thành ngọn lửa. Mỗi chữ còn lại bóp thành một chấm, bay tới đúng chỗ của nó trên app
   và nở ra thành icon, ô tiền hoặc nút bấm; ngọn lửa bay về logo; cuối cùng app mở ra từ logo.
   Mọi kiểu dáng được tính từ thời gian t trong seek(t), dựa trên số đo lấy một lần trước khi chạy:
   không dùng CSS animation, không đo lại bố cục trong lúc chạy (đỡ giật). */
(() => {
"use strict";
const el = document.getElementById("intro");
const done = () => dispatchEvent(new Event("intro:done")); // app.js đợi tín hiệu này mới tải phần đồng bộ
if (!el) { done(); return; }
if (getComputedStyle(el).display === "none") { el.remove(); done(); return; }

const words = [...el.querySelectorAll(".w > span")];
const qGlyph = words[words.length - 1], flame = el.querySelector(".intro-f"), skipTxt = el.querySelector(".intro-skip");
// Chữ thứ i bay về đâu: icon mục, ô tiền còn lại, nút ghi chi. Lấy cái đầu tiên đang hiện trong danh sách.
const DEST = [
  [[".nav [data-tab=home] svg"]],
  [[".nav [data-tab=log] svg"]],
  [["#rWeek", "box"], [".nav [data-tab=shop] svg"]],
  [["#rMonth", "box"], [".nav [data-tab=free] svg"]],
  [[".nav [data-tab=cook] svg"]],
  [[".add-top", "box"], [".fab", "box"]]
];

// Mốc thời gian (giây)
const IN = 0.12, GAP = 0.13;       // chữ thứ i bắt đầu trượt lên lúc IN + i × GAP
const MORPH = 1.12;                // dấu ? hóa thành ngọn lửa
const EXIT = 1.62, SQ = 0.16, STAG = 0.035; // chữ thứ i bóp thành chấm trong SQ giây, bắt đầu lúc EXIT + i × STAG
const FLAME_GO = EXIT + 0.22;      // ngọn lửa bay sau cùng
const OPEN = EXIT + 0.78, END = OPEN + 0.42; // app mở ra từ logo

// Lò xo tắt dần tới hạn: tới đích êm, không nảy. Hàm vị trí (0→1) và vận tốc (/giây).
const spring = (t, w) => (t <= 0 ? 0 : 1 - (1 + w * t) * Math.exp(-w * t));
const springV = (t, w) => (t <= 0 ? 0 : w * w * t * Math.exp(-w * t));
const expIn = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, 10 * p - 10));
const expInV = (p) => (p <= 0 || p >= 1 ? 0 : 10 * Math.LN2 * Math.pow(2, 10 * p - 10));
const expOut = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, k) => a + (b - a) * k;
const blurOf = (pxPerSec) => (pxPerSec > 300 ? `blur(${Math.min(6, pxPerSec * 0.004).toFixed(2)}px)` : "none");
function rgba(s) { // "rgb(…)", "rgba(…)", "color(srgb …)" hoặc "#rrggbb" → [r, g, b, a]
  s = String(s).trim();
  if (s[0] === "#") { const n = parseInt(s.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const m = (s.match(/[\d.]+/g) || ["0", "0", "0"]).map(Number), k = s.startsWith("color(") ? 255 : 1;
  return [m[0] * k, m[1] * k, m[2] * k, m[3] === undefined ? 1 : m[3]];
}
const mixColor = (a, b, k) => `rgba(${a.slice(0, 3).map((x, i) => Math.round(lerp(x, b[i], k))).join(",")},${lerp(a[3], b[3], k).toFixed(3)})`;

/* ---------- Đo một lần trước khi chạy ---------- */
let G;
function shown(n) {
  if (!n) return null;
  const r = n.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth ? r : null;
}
function measure() {
  const cs = getComputedStyle(el.querySelector(".intro-t")), fs = parseFloat(cs.fontSize);
  const sunk = rgba(getComputedStyle(document.documentElement).getPropertyValue("--sunk"));
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const logoR = [...document.querySelectorAll(".brand svg")].map(shown).find(Boolean) || { left: 16, top: 20, width: 22, height: 22 };
  const logo = { ...center(logoR), size: logoR.width };
  const dot = fs * 0.3;
  const toks = DEST.map((choices, i) => {
    const span = words[i], box = span.parentElement.getBoundingClientRect();
    const from = { ...center(box), w: span.offsetWidth, h: span.offsetHeight, color: rgba(getComputedStyle(span).color) };
    let to = { x: logo.x, y: logo.y, w: dot * 0.5, h: dot * 0.5, r: dot * 0.25, color: from.color };
    for (const [sel, kind] of choices) {
      const n = document.querySelector(sel), r = shown(n); if (!r) continue;
      const s = getComputedStyle(n), bg = rgba(kind === "box" ? s.backgroundColor : s.color);
      const rad = s.borderTopLeftRadius.endsWith("%") ? (Math.min(r.width, r.height) * parseFloat(s.borderTopLeftRadius)) / 100 : parseFloat(s.borderTopLeftRadius) || 0;
      to = { ...center(r), w: r.width, h: r.height, r: kind === "box" ? rad : r.width * 0.3, color: bg[3] < 0.5 ? sunk : bg,
        line: kind === "box" && parseFloat(s.borderTopWidth) > 0 ? rgba(s.borderTopColor) : null };
      break;
    }
    const node = document.createElement("i");
    node.className = "intro-tok"; el.appendChild(node);
    return { span, from, to, node };
  });
  const q = qGlyph.parentElement.getBoundingClientRect();
  const R = Math.hypot(Math.max(logo.x, innerWidth - logo.x), Math.max(logo.y, innerHeight - logo.y));
  G = { fs, dot, logo, toks, R, q: { ...center(q), size: fs * 1.15 } };
  for (const w of words) w.style.willChange = "transform, filter";
}

/* ---------- Một khung hình tại thời điểm t ---------- */
// Nhòe và kéo dãn theo tốc độ; v tính bằng % chiều cao chữ mỗi giây
function move(node, y, v, extra = "") {
  const blur = Math.min(7, Math.abs(v) * 0.009), stretch = 1 + Math.min(0.28, Math.abs(v) * 0.00035);
  node.style.transform = `translateY(${y.toFixed(2)}%) scaleY(${stretch.toFixed(3)})${extra}`;
  node.style.filter = blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : "none";
}
function seek(t) {
  // 1. Chữ trượt lên trong khung của nó
  words.forEach((w, i) => {
    const ti = t - (IN + i * GAP);
    const y = (1 - spring(ti, 15)) * 115, v = springV(ti, 15) * 115;
    if (w === qGlyph) { // dấu ? xoay và co lại, nhường chỗ cho ngọn lửa
      const pm = clamp01((t - MORPH) / 0.22);
      move(w, y, v, ` rotate(${(pm * 120).toFixed(1)}deg) scale(${(1 - expIn(pm)).toFixed(3)})`);
    }
  });

  // 2. Mỗi chữ bóp thành một chấm, rồi chấm bay tới đích và nở ra đúng hình, đúng màu của đích
  G.toks.forEach(({ span, from, to, node }, i) => {
    const ti = t - (IN + i * GAP), c0 = EXIT + i * STAG, pc = (t - c0) / SQ;
    if (pc < 1) {
      const k = expIn(pc), y = (1 - spring(ti, 15)) * 115, v = springV(ti, 15) * 115 + (115 * expInV(pc)) / SQ * 0.3;
      span.style.visibility = "visible"; node.style.visibility = "hidden";
      move(span, y, v, pc > 0 ? ` scale(${lerp(1, G.dot / from.w, k).toFixed(4)}, ${lerp(1, G.dot / from.h, k).toFixed(4)})` : "");
      return;
    }
    const ft = t - c0 - SQ, f = spring(ft, 15);
    const w = lerp(G.dot, to.w, f), h = lerp(G.dot, to.h, f), x = lerp(from.x, to.x, f), y = lerp(from.y, to.y, f);
    span.style.visibility = "hidden"; node.style.visibility = "visible";
    node.style.width = w.toFixed(1) + "px"; node.style.height = h.toFixed(1) + "px";
    node.style.borderRadius = lerp(G.dot / 2, to.r, f).toFixed(1) + "px";
    node.style.background = mixColor(from.color, to.color, f);
    node.style.boxShadow = to.line ? `inset 0 0 0 1px ${mixColor([...to.line.slice(0, 3), 0], to.line, f)}` : "none";
    node.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px)`;
    node.style.filter = blurOf(Math.hypot(to.x - from.x, to.y - from.y) * springV(ft, 15));
  });

  // 3. Ngọn lửa mọc ra đúng chỗ dấu ?, rồi bay về logo và nhỏ lại bằng logo
  const grow = spring(t - MORPH - 0.1, 17), fly = spring(t - FLAME_GO, 15), L = G.logo;
  const x = lerp(G.q.x, L.x, fly), y = lerp(G.q.y, L.y, fly), size = lerp(G.q.size, L.size, fly) * grow;
  flame.style.opacity = grow > 0.001 ? "1" : "0";
  flame.style.transform = `translate(${(x - 50).toFixed(1)}px, ${(y - 50).toFixed(1)}px) scale(${(size / 100).toFixed(4)})`;
  flame.style.filter = blurOf(Math.hypot(L.x - G.q.x, L.y - G.q.y) * springV(t - FLAME_GO, 15));
  skipTxt.style.visibility = t < EXIT ? "visible" : "hidden";

  // 4. App mở ra từ logo: một lỗ tròn loang rộng trên lớp chào, lộ ra icon và nút thật đúng chỗ các mảnh vừa đáp
  const po = (t - OPEN) / (END - OPEN);
  const m = po > 0 ? `radial-gradient(circle at ${L.x.toFixed(1)}px ${L.y.toFixed(1)}px, transparent ${(expOut(po) * G.R).toFixed(1)}px, #000 ${(expOut(po) * G.R + 1).toFixed(1)}px)` : "none";
  el.style.webkitMaskImage = m; el.style.maskImage = m;
}

/* ---------- Chạy ---------- */
let t0 = 0, finished = false;
function finish() { if (finished) return; finished = true; removeEventListener("keydown", skip); el.remove(); done(); }
function skip() { if (t0 && (performance.now() - t0) / 1000 < EXIT) t0 = performance.now() - EXIT * 1000; }
function frame(now) {
  if (finished) return;
  const t = (now - t0) / 1000;
  if (t >= END) { finish(); return; }
  seek(t); requestAnimationFrame(frame);
}
function start() {
  if (finished || t0) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Máy đặt "giảm chuyển động": hiện câu chào đứng yên rồi tắt, không có gì bay
    for (const w of words) w.style.transform = "none";
    el.addEventListener("click", finish); setTimeout(finish, 1300);
    return;
  }
  measure();
  el.addEventListener("pointerdown", skip);
  addEventListener("keydown", skip);
  requestAnimationFrame((now) => { t0 = now; frame(now); });
  setTimeout(finish, (END + 1.5) * 1000); // phòng khi trình duyệt không vẽ khung hình nào, lớp chào không che app mãi
}
// Đợi trang tải xong hẳn (ảnh, font, giao diện đã vẽ) rồi mới chạy cho mượt; mạng quá chậm thì chạy sau tối đa 2,5 giây
const loaded = new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true })));
const ready = loaded
  .then(() => document.fonts && document.fonts.ready)
  .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(start);
})();
