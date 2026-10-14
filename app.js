/* Giữ Lửa Ví Tiền: toàn bộ logic. Dữ liệu cố định (thực đơn, đi chợ, nguồn free) nằm trong data.js. */
(() => {
"use strict";

/* ================= Tiện ích ngày & tiền ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r2 = (n) => Math.round(n * 100) / 100;
const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0);
const fmt = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const today = () => iso(new Date());
const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const diff = (a, b) => Math.round((utc(b) - utc(a)) / 864e5);
const addDays = (s, n) => { const d = new Date(utc(s) + n * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
const addMonths = (s, n) => {
  const [y, m, d] = s.split("-").map(Number), x = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  return x.getUTCFullYear() + "-" + pad(x.getUTCMonth() + 1) + "-" + pad(Math.min(d, last));
};
const dow = (s) => new Date(utc(s)).getUTCDay(); // 0 = CN
const mondayOf = (s) => addDays(s, -((dow(s) + 6) % 7));
const ddmm = (s) => s.slice(8, 10) + "/" + s.slice(5, 7);
const dmy = (s) => ddmm(s) + "/" + s.slice(0, 4);
const DOW_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DOW_LONG = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const MONTH_VI = ["", "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const BASE_MONDAY = "2026-10-12";
const weekIdxOf = (s) => Math.floor(diff(BASE_MONDAY, mondayOf(s)) / 7);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const SWATCHES = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c0"];
const cssColor = (c) => `var(--${(c && c.color) || "c0"})`;
const FLEXIBLE = (kind) => kind === "plan" || kind === "flex"; // tính vào "còn lại tuần/tháng"
const LOCKED = (c) => c.kind === "fixed" && !c.unlocked; // mục cố định mặc định bị khóa, mở khóa mới sửa được số tiền
const lockSwitch = (c, label) => `<label class="switch-l"><input type="checkbox" role="switch" class="switch" data-lock="${esc(c.id)}" ${LOCKED(c) ? "checked" : ""} aria-label="Khóa số tiền mục ${esc(c.name)}"><span>${label}</span></label>`;

/* ================= Lưu trữ ================= */
const KEY = "giu-lua-vi-tien:v1";
const FIRST = { id: "p1", name: "Thu 2026", start: "2026-10-13", end: "2026-12-31" };
const firstBudgets = (cats) => Object.fromEntries(cats.map((c) => [c.id, c.budget || 0]));
function firstPeriod() {
  const t = today();
  if (t <= FIRST.end) return { ...FIRST, amount: 1000, carry: false, budgets: firstBudgets(DEFAULT_CATS) };
  return { id: "p1", name: "Kỳ đầu tiên", start: t, end: addDays(addMonths(t, 6), -1), amount: 0, carry: false, budgets: {} };
}
function freshState() {
  return { v: 1, cap: 10, trackStart: today(), cats: DEFAULT_CATS.map(({ budget, ...c }) => ({ ...c })), periods: [firstPeriod()],
    expenses: [], checkins: {}, free: [], shop: {}, meals: {}, seenMilestone: 0, settingsAt: 0, deleted: {}, resetAt: 0 };
}
function canon(o) {
  if (Array.isArray(o)) return "[" + o.map(canon).join(",") + "]";
  if (o && typeof o === "object") return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
  return JSON.stringify(o === undefined ? null : o);
}
function normalize(o) {
  const x = Object.assign(freshState(), o);
  if (!Array.isArray(o.periods) || !o.periods.length) {
    // Dữ liệu bản cũ: chỉ một kỳ, tổng quỹ ở o.total và ngân sách nằm trong từng mục
    x.periods = [{ ...FIRST, amount: typeof o.total === "number" ? o.total : 1000, carry: false, budgets: firstBudgets(o.cats || DEFAULT_CATS) }];
  }
  delete x.total;
  x.cats = x.cats.map((c, i) => ({ id: c.id, kind: c.kind || "flex", note: c.note || "",
    name: c.id === "utilities" && c.name === "Wifi + nước" ? "Wifi + điện" : c.name, // tiền nước free, tiền điện thì có
    color: c.color || (DEFAULT_CATS.find((d) => d.id === c.id) || {}).color || SWATCHES[Math.min(i, 8)],
    ...(c.unlocked ? { unlocked: true } : {}) }));
  x.periods = x.periods.map((p) => ({ ...p, budgets: { ...(p.budgets || {}) } })).sort((a, b) => (a.start < b.start ? -1 : 1));
  for (const k of ["deleted", "checkins", "shop", "meals"]) if (!x[k] || typeof x[k] !== "object") x[k] = {};
  for (const k of Object.keys(x.checkins)) if (typeof x.checkins[k] !== "number") x.checkins[k] = 1;
  x.settingsAt = x.settingsAt || 0;
  return x;
}
let S;
let storageOK = true;
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) return normalize(o); } }
  catch (e) { storageOK = false; }
  return freshState();
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; }
  catch (e) { storageOK = false; }
}
function save() { saveLocal(); schedulePush(); }
const touchSettings = () => { S.settingsAt = Date.now(); };
S = load();
if (S.trackStart < S.periods[0].start) S.trackStart = S.periods[0].start;
saveLocal();
if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(() => {}); }

/* ================= Đồng bộ (Firebase) ================= */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2u7U90oSA4QwzvHXMvk2tkMlL7YCLnmw",
  authDomain: "giu-lua.firebaseapp.com",
  projectId: "giu-lua",
  storageBucket: "giu-lua.firebasestorage.app",
  messagingSenderId: "551827768696",
  appId: "1:551827768696:web:4675b35d84d65ccb47b48d",
  measurementId: "G-3JBXD1K2PV"
};
const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const sync = { auth: null, db: null, user: null, ref: null, unsub: null, timer: null, lastRemote: null, state: "off", err: "", mode: "" };
const stamp = (e) => e.u || e.t || 0; // lần sửa cuối của một khoản
function mergeStates(a, b) {
  const deleted = {};
  for (const src of [b.deleted || {}, a.deleted || {}]) for (const [k, v] of Object.entries(src)) deleted[k] = Math.max(deleted[k] || 0, +v || 0);
  const resetAt = Math.max(a.resetAt || 0, b.resetAt || 0);
  // Gộp theo id; bản sửa sau cùng thắng; bị xóa sau lần sửa cuối thì bỏ
  const union = (x, y) => {
    const m = new Map();
    for (const e of [...(y || []), ...(x || [])]) {
      if (!e || !e.id || deleted[e.id] >= stamp(e)) continue;
      const o = m.get(e.id); if (!o || stamp(e) >= stamp(o)) m.set(e.id, e);
    }
    return [...m.values()].sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  };
  const checkins = {};
  for (const src of [b.checkins || {}, a.checkins || {}]) for (const [k, v] of Object.entries(src)) {
    const ts = typeof v === "number" ? v : 1;
    if (ts >= resetAt) checkins[k] = Math.max(checkins[k] || 0, ts);
  }
  let shop;
  if ((a.resetAt || 0) === (b.resetAt || 0)) {
    shop = Object.assign({}, b.shop);
    for (const [k, v] of Object.entries(a.shop || {})) shop[k] = (v && typeof v === "object" && shop[k] && typeof shop[k] === "object") ? Object.assign({}, shop[k], v) : v;
  } else shop = Object.assign({}, ((a.resetAt || 0) > (b.resetAt || 0) ? a : b).shop);
  for (const k of Object.keys(shop)) if (k.endsWith(":eid") && deleted[shop[k]]) { delete shop[k]; delete shop[k.slice(0, -4) + ":logged"]; }
  const meals = Object.assign({}, b.meals);
  for (const [k, v] of Object.entries(a.meals || {})) if (v && (!meals[k] || v.t >= meals[k].t)) meals[k] = v;
  const s = (a.settingsAt || 0) >= (b.settingsAt || 0) ? a : b;
  return normalize({
    v: 1, cap: s.cap, cats: s.cats, periods: s.periods, settingsAt: s.settingsAt || 0,
    trackStart: [a.trackStart, b.trackStart].filter(Boolean).sort()[0] || today(),
    expenses: union(a.expenses, b.expenses), free: union(a.free, b.free),
    checkins, shop, meals, deleted, resetAt, seenMilestone: Math.max(a.seenMilestone || 0, b.seenMilestone || 0)
  });
}
function loadScript(src) {
  return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error(src)); document.head.appendChild(el); });
}
function setSync(state, err) { sync.state = state; sync.err = err || ""; renderSync(); renderBadges(); }
async function initSync() {
  if (!FIREBASE_CONFIG) { setSync("off"); return; }
  setSync("loading");
  try {
    await loadScript(SDK + "firebase-app-compat.js");
    await Promise.all([loadScript(SDK + "firebase-auth-compat.js"), loadScript(SDK + "firebase-firestore-compat.js")]);
  } catch (e) { setSync("error", "Không tải được phần đồng bộ. Kiểm tra mạng rồi tải lại trang. Dữ liệu vẫn lưu trong máy."); return; }
  firebase.initializeApp(FIREBASE_CONFIG);
  sync.auth = firebase.auth(); sync.db = firebase.firestore();
  sync.auth.onAuthStateChanged((u) => {
    if (sync.unsub) { sync.unsub(); sync.unsub = null; }
    sync.user = u; sync.ref = null; sync.lastRemote = null;
    if (!u) { setSync("signedout"); return; }
    setSync("busy");
    sync.ref = sync.db.collection("users").doc(u.uid);
    sync.unsub = sync.ref.onSnapshot(onRemote, (err) => setSync("error", err && err.code === "permission-denied" ? "Firebase chặn quyền đọc. Kiểm tra lại Rules của Firestore." : "Mất kết nối đồng bộ. Tải lại trang để thử lại."));
  });
}
function onRemote(snap) {
  if (snap.metadata.hasPendingWrites) return;
  let remote = null;
  if (snap.exists) { try { remote = normalize(JSON.parse(snap.data().json)); } catch (e) { remote = null; } }
  sync.lastRemote = remote ? canon(remote) : "";
  const merged = remote ? mergeStates(S, remote) : mergeStates(S, S);
  const mc = canon(merged);
  if (mc !== canon(S)) { S = merged; saveLocal(); renderAll(); }
  if (mc !== sync.lastRemote) pushNow(); else setSync("ok");
}
function schedulePush() {
  if (!sync.ref) return;
  clearTimeout(sync.timer); setSync("busy");
  sync.timer = setTimeout(pushNow, 700);
}
async function pushNow() {
  if (!sync.ref) return;
  clearTimeout(sync.timer);
  const c = canon(mergeStates(S, S));
  if (c === sync.lastRemote) { setSync("ok"); return; }
  try {
    await sync.ref.set({ json: c, at: firebase.firestore.FieldValue.serverTimestamp() });
    sync.lastRemote = c; setSync("ok");
  } catch (e) {
    setSync("error", e && e.code === "permission-denied" ? "Firebase chặn quyền ghi. Kiểm tra lại Rules của Firestore." : "Chưa lưu được lên mạng. Dữ liệu vẫn nằm trong máy và sẽ đồng bộ khi có mạng.");
  }
}
function authMsg(code) {
  return ({
    "auth/invalid-credential": "Sai email hoặc mật khẩu.", "auth/wrong-password": "Sai email hoặc mật khẩu.", "auth/user-not-found": "Chưa có tài khoản với email này. Bấm Tạo tài khoản.",
    "auth/invalid-login-credentials": "Sai email hoặc mật khẩu.", "auth/email-already-in-use": "Email này đã có tài khoản. Bấm Đăng nhập.", "auth/invalid-email": "Email không hợp lệ.",
    "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.", "auth/network-request-failed": "Không có mạng. Thử lại khi có mạng.",
    "auth/too-many-requests": "Thử sai quá nhiều lần. Đợi vài phút rồi thử lại.", "auth/operation-not-allowed": "Firebase chưa bật đăng nhập Email/Password.", "auth/configuration-not-found": "Firebase chưa bật Authentication. Vào Authentication, bấm Get started, rồi bật Email/Password."
  })[code] || "Không đăng nhập được (" + (code || "lỗi lạ") + ").";
}
async function doAuth(kind) {
  const email = $("#syEmail").value.trim(), pw = $("#syPw").value, out = $("#syMsg");
  if (kind === "reset") {
    if (!email) { out.textContent = "Nhập email trước, rồi bấm Quên mật khẩu."; return; }
    try { await sync.auth.sendPasswordResetEmail(email); out.textContent = "Đã gửi email đặt lại mật khẩu."; } catch (e) { out.textContent = authMsg(e.code); }
    return;
  }
  if (!email || pw.length < 6) { out.textContent = "Nhập email và mật khẩu (ít nhất 6 ký tự)."; return; }
  out.textContent = kind === "up" ? "Đang tạo tài khoản…" : "Đang đăng nhập…";
  try {
    if (kind === "up") await sync.auth.createUserWithEmailAndPassword(email, pw);
    else await sync.auth.signInWithEmailAndPassword(email, pw);
    toast("Đã đăng nhập. Dữ liệu đang được đồng bộ.");
  } catch (e) { out.textContent = authMsg(e.code); }
}
function renderSync(force) {
  const st = sync.state;
  const map = { off: null, loading: ["busy", "Đang kết nối"], signedout: ["out", "Chưa đồng bộ"], busy: ["busy", "Đang lưu"], ok: ["ok", "Đã đồng bộ"], error: ["err", "Lỗi đồng bộ"] };
  const m = map[st];
  for (const chip of $$(".sync-chip")) { chip.hidden = !m; if (m) { chip.className = "sync-chip " + m[0]; chip.textContent = m[1]; } }
  const box = $("#syncBox");
  if (!box) return;
  const mode = st === "off" ? "off" : st === "signedout" ? "form" : st === "loading" ? "loading" : "user";
  if (mode === sync.mode && !force) {
    const s2 = $("#syState"); if (s2) s2.textContent = syncLine(); return;
  }
  if (mode === "form" && sync.mode === "form" && box.contains(document.activeElement)) return;
  sync.mode = mode;
  if (mode === "off") box.innerHTML = `<h2>Đồng bộ giữa các máy</h2><p class="small muted" style="margin:0">Chưa bật. Dữ liệu hiện chỉ nằm trong trình duyệt của máy này.</p>`;
  else if (mode === "loading") box.innerHTML = `<h2>Đồng bộ giữa các máy</h2><p class="small muted" style="margin:0">Đang kết nối…</p>`;
  else if (mode === "form") box.innerHTML = `<h2>Đăng nhập để đồng bộ</h2>
    <p class="small muted" style="margin:0">Dùng cùng một tài khoản trên điện thoại và laptop. Dữ liệu đang có trong máy này sẽ được gộp vào tài khoản, không bị ghi đè.</p>
    <form id="syForm" autocomplete="on">
      <label class="f wide">Email<input id="syEmail" type="email" autocomplete="username" inputmode="email" required></label>
      <label class="f wide">Mật khẩu (ít nhất 6 ký tự)<input id="syPw" type="password" autocomplete="current-password" minlength="6" required></label>
      <button class="btn primary" type="submit">Đăng nhập</button>
      <button class="btn" type="button" data-auth="up">Tạo tài khoản</button>
      <button class="btn quiet wide" type="button" data-auth="reset">Quên mật khẩu</button>
    </form>
    <p class="small" id="syMsg" role="status" style="margin:0"></p>`;
  else box.innerHTML = `<h2>Đồng bộ giữa các máy</h2>
    <p class="small" style="margin:0">Tài khoản: <b>${esc(sync.user ? sync.user.email : "")}</b></p>
    <p class="small muted" id="syState" style="margin:0">${esc(syncLine())}</p>
    <div class="actions"><button class="btn quiet" type="button" id="sySignOut">Đăng xuất</button></div>`;
}
function syncLine() {
  return sync.state === "ok" ? "Đã lưu lên mạng. Mở trên máy khác và đăng nhập cùng tài khoản là thấy." : sync.state === "busy" ? "Đang lưu lên mạng…" : sync.state === "error" ? sync.err : "";
}
document.addEventListener("submit", (e) => { if (e.target.id === "syForm") { e.preventDefault(); doAuth("in"); } });
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-auth]"); if (a) { doAuth(a.dataset.auth); return; }
  if (e.target.closest("#sySignOut")) { sync.auth.signOut(); toast("Đã đăng xuất. Dữ liệu vẫn nằm trong máy này."); }
});

/* ================= Kỳ ngân sách ================= */
let viewId = null; // kỳ đang xem trong mục Chi tiêu (null = kỳ hiện hành)
const inP = (p, d) => d >= p.start && d <= p.end;
const pDays = (p) => diff(p.start, p.end) + 1;
const curPeriod = () => S.periods.find((p) => inP(p, today())) || null;
// Kỳ đang chạy; nếu đang ở khoảng trống giữa hai kỳ thì lấy kỳ gần nhất đã bắt đầu
const activePeriod = () => curPeriod() || [...S.periods].reverse().find((p) => p.start <= today()) || S.periods[0];
const VP = () => S.periods.find((p) => p.id === viewId) || activePeriod();
const lastPeriod = () => S.periods[S.periods.length - 1];
const prevOf = (p) => S.periods[S.periods.findIndex((x) => x.id === p.id) - 1] || null;
const spentIn = (p) => r2(sum(S.expenses.filter((e) => inP(p, e.date)), (e) => e.amount));
function carryIn(p) { const q = p.carry && prevOf(p); return q ? Math.max(0, r2(total(q) - spentIn(q))) : 0; }
function total(p) { return r2((p.amount || 0) + carryIn(p)); }
const needNewPeriod = () => diff(today(), lastPeriod().end) <= 14;
const pStatus = (p) => (today() > p.end ? "done" : today() < p.start ? "soon" : "on");

/* ================= Tính toán ================= */
const catById = () => Object.fromEntries(S.cats.map((c) => [c.id, c]));
const kindOf = (id) => (catById()[id] || {}).kind || "flex";
function byDate(list) { const m = {}; for (const x of list) (m[x.date] = m[x.date] || []).push(x); return m; }

function dayStatus(d, exBy, frBy, t) {
  const ex = exBy[d] || [], fr = frBy[d] || [], chk = S.checkins[d];
  if (!ex.length && !fr.length && !chk) return d === t ? "pending" : "missed";
  const outPlan = ex.filter((e) => kindOf(e.cat) === "flex").reduce((a, e) => a + e.amount, 0);
  if (outPlan > S.cap + 1e-9) return "over";
  return ex.some((e) => e.amount > 0) ? "ok" : "nospend";
}
function streak() {
  const t = today(), exBy = byDate(S.expenses), frBy = byDate(S.free);
  const days = {}; let cur = 0, best = 0, shields = 0, run = 0, todaySt = "pending";
  for (let d = S.trackStart; d <= t; d = addDays(d, 1)) {
    const st = dayStatus(d, exBy, frBy, t);
    if (d === t) { todaySt = st; days[d] = st; if (st === "ok" || st === "nospend") { cur++; run++; if (run % 7 === 0 && shields < 2) shields++; } break; }
    if (st === "ok" || st === "nospend") { cur++; run++; if (run % 7 === 0 && shields < 2) shields++; days[d] = st; }
    else if (shields > 0) { shields--; days[d] = "frozen"; }
    else { cur = 0; run = 0; days[d] = st; }
    best = Math.max(best, cur);
  }
  best = Math.max(best, cur);
  return { cur, best, shields, days, todaySt, exBy, frBy };
}
function yesterdayMissed(st) {
  const y = addDays(today(), -1);
  return y >= S.trackStart && (st.days[y] === "missed" || st.days[y] === "frozen") && !(st.exBy[y] || []).length && !(st.frBy[y] || []).length && !S.checkins[y];
}
function money(p = VP()) {
  const t = today(), spentBy = {}; let spent = 0;
  for (const e of S.expenses) if (inP(p, e.date)) { spentBy[e.cat] = (spentBy[e.cat] || 0) + e.amount; spent += e.amount; }
  const daysTotal = pDays(p);
  const daysLeft = t > p.end ? 0 : diff(t < p.start ? p.start : t, p.end) + 1;
  const left = (id) => r2((p.budgets[id] || 0) - (spentBy[id] || 0));
  return { spentBy, spent: r2(spent), total: total(p), daysTotal, daysLeft, daysGone: daysTotal - daysLeft, left };
}
// Còn lại tuần này / tháng này: ngân sách các mục linh hoạt chia đều theo ngày, trừ số đã chi trong khoảng đó
function remain(kind) {
  const p = curPeriod(); if (!p) return null;
  const t = today();
  let a = kind === "week" ? mondayOf(t) : t.slice(0, 8) + "01";
  let b = kind === "week" ? addDays(a, 6) : addDays(addMonths(a, 1), -1);
  if (a < p.start) a = p.start; if (b > p.end) b = p.end;
  const share = (diff(a, b) + 1) / pDays(p);
  const rows = S.cats.filter((c) => FLEXIBLE(c.kind)).map((c) => {
    const allow = r2((p.budgets[c.id] || 0) * share);
    const spent = r2(sum(S.expenses.filter((e) => e.cat === c.id && e.date >= a && e.date <= b), (e) => e.amount));
    return { c, allow, spent, left: r2(allow - spent) };
  }).filter((x) => x.allow > 0 || x.spent > 0);
  const allow = r2(sum(rows, (x) => x.allow)), spent = r2(sum(rows, (x) => x.spent));
  return { kind, a, b, rows, allow, spent, left: r2(allow - spent) };
}

/* ================= Ngọn lửa ================= */
function tier(n) { return n >= 30 ? 5 : n >= 14 ? 4 : n >= 7 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; }
const TIER_COLORS = [["#9AA3B5", "#C9CFDB", "#E4E8EF"], ["var(--f2)", "var(--f1)", "#FFF1C2"], ["var(--f3)", "var(--f2)", "var(--f1)"], ["var(--f4)", "var(--f3)", "var(--f1)"], ["var(--f5)", "var(--f4)", "var(--f2)"], ["#3B2BD9", "var(--f5)", "#7FE7FF"]];
function flameSVG(n) {
  const [a, b, c] = TIER_COLORS[tier(n)];
  return `<svg viewBox="0 0 100 124" aria-hidden="true">
    <defs>
      <linearGradient id="fg1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".65" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
      <linearGradient id="fg2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    </defs>
    <path class="lick" fill="url(#fg1)" d="M50 4c4 18-6 28-16 39C24 54 14 66 14 84a36 36 0 0 0 72 0c0-15-7-26-14-34 1 10-4 18-10 21 3-22-2-50-12-67Z"/>
    <path class="core" fill="url(#fg2)" opacity=".95" d="M51 56c2 9-3 15-8 21-4 5-8 9-8 16a16 16 0 0 0 32 0c0-7-3-12-6-15 0 5-2 8-5 9 1-10-1-22-5-31Z"/>
  </svg>`;
}
const MILESTONES = [3, 7, 14, 30, 50, 80];

/* ================= Render: Lửa ================= */
let lastShownStreak = null;
const lockOpen = new Set(); // mục cố định nào đang mở bảng khóa ở trang Tổng quan
function renderHome(st) {
  const t = today(), p = activePeriod(), m = money(p), cur = curPeriod();
  const n = st.cur, lit = n > 0;
  const next = MILESTONES.find((x) => x > n) || null, prev = [...MILESTONES].reverse().find((x) => x <= n) || 0;
  const glow = ["transparent", "var(--f2)", "var(--f3)", "var(--f4)", "var(--f5)", "var(--f5)"][tier(n)];
  $("#fire").style.setProperty("--glow", glow);
  $("#fire").innerHTML = `
    <div class="flame ${lit ? "lit" : ""} ${lastShownStreak !== null && n > lastShownStreak ? "pop" : ""}">${flameSVG(n)}</div>
    <div>
      <div class="fire-num ${lit ? "lit" : ""}">${n}</div>
      <div class="fire-label">${n === 0 ? "Chưa có lửa" : "ngày giữ lửa"}</div>
      <div class="fire-meta">
        <span title="Kỷ lục"><svg style="color:var(--f1)"><use href="#i-trophy"/></svg>Kỷ lục ${st.best}</span>
        <span title="Khiên giữ lửa"><svg style="color:var(--shield)"><use href="#i-shield"/></svg>${st.shields} khiên</span>
      </div>
      ${next ? `<div class="milestone"><div class="row-between small"><span>Mốc ${next} ngày</span><span class="muted">còn ${next - n} ngày</span></div><div class="mbar" style="margin-top:4px"><i style="width:${(((n - prev) / (next - prev)) * 100).toFixed(0)}%"></i></div></div>` : `<div class="small" style="margin-top:10px">Đã qua mọi mốc. Giữ đến hết kỳ nhé.</div>`}
    </div>`;
  lastShownStreak = n;

  // Hôm nay
  const exToday = st.exBy[t] || [], outToday = exToday.filter((e) => kindOf(e.cat) === "flex").reduce((a, e) => a + e.amount, 0);
  const capLeft = r2(S.cap - outToday), yMissed = yesterdayMissed(st);
  let msg, sub;
  if (st.todaySt === "pending") { msg = "Hôm nay chưa ghi gì. Lửa đang chờ bạn."; sub = `Bấm "Hôm nay không tiêu" nếu cả ngày không chi đồng nào, hoặc ghi khoản chi đầu tiên.`; }
  else if (st.todaySt === "nospend") { msg = "Ngày không tiêu. Lửa cháy đậm."; sub = "Nếu lát nữa có chi, cứ ghi bình thường."; }
  else if (st.todaySt === "ok") { msg = `Đúng plan. Còn <span class="good">${fmt(capLeft)}</span> ngoài plan cho hôm nay.`; sub = `Đã chi hôm nay: ${fmt(exToday.reduce((a, e) => a + e.amount, 0))}.`; }
  else { msg = `Hôm nay vượt <span class="bad">${fmt(-capLeft)}</span> ngoài plan.`; sub = st.shields > 0 ? "Nếu cuối ngày vẫn vượt, 1 khiên sẽ được dùng để giữ lửa." : "Chưa có khiên, nên chuỗi sẽ về 0 nếu cuối ngày vẫn vượt."; }
  const endNote = !cur ? `<div class="banner"><span>Kỳ “${esc(p.name)}” đã kết thúc. Tạo kỳ mới để tiếp tục tính tiền.</span><button class="btn primary" type="button" data-new-period>Tạo kỳ mới</button></div>`
    : needNewPeriod() && lastPeriod().id === cur.id ? `<div class="banner"><span>Kỳ này còn ${m.daysLeft} ngày. Có tiền mới thì tạo sẵn kỳ tiếp theo.</span><button class="btn" type="button" data-new-period>Tạo kỳ mới</button></div>` : "";
  $("#today").innerHTML = `${endNote}
    <div><div class="msg">${msg}</div>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>
    <div class="actions">
      ${st.todaySt === "pending" ? `<button class="btn primary" type="button" data-act="nospend">Hôm nay không tiêu</button>` : ""}
      <button class="btn ${st.todaySt === "pending" ? "" : "primary"}" type="button" data-add>Ghi khoản chi</button>
      <button class="btn" type="button" data-go="free/log">Ghi bữa free</button>
      ${yMissed ? `<button class="btn quiet" type="button" data-act="nospend-y">Hôm qua tôi không tiêu</button>` : ""}
    </div>`;

  // Ví: thanh chia màu theo mục
  const left = r2(m.total - m.spent), tp = (m.daysGone / m.daysTotal) * 100;
  const base = Math.max(m.total, m.spent) || 1, cats = catById();
  const segs = Object.entries(m.spentBy).filter(([, v]) => v > 0).sort((a, b) => S.cats.findIndex((c) => c.id === a[0]) - S.cats.findIndex((c) => c.id === b[0]));
  const flexLeft = r2(sum(S.cats.filter((c) => FLEXIBLE(c.kind)), (c) => m.left(c.id)));
  $("#wallet").innerHTML = `
    <div class="row-between"><h2>Ví còn bao nhiêu</h2><span class="small muted">${esc(p.name)}${m.daysLeft ? ` · còn ${m.daysLeft} ngày` : " · đã kết thúc"}</span></div>
    <div style="margin-top:10px"><span class="big ${left < 0 ? "bad" : "good"}">${fmt(left)}</span> <span class="muted">/ ${fmt0(m.total)}</span></div>
    <div class="stackwrap"><div class="stackbar">${segs.map(([id, v]) => `<i style="--c:${cssColor(cats[id])};width:${((v / base) * 100).toFixed(2)}%" title="${esc((cats[id] || {}).name || "Mục đã xóa")}: ${fmt(v)}"></i>`).join("")}</div>
      ${m.daysLeft ? `<b style="left:${Math.min(99.5, tp).toFixed(1)}%" title="Mốc thời gian hôm nay"></b>` : ""}</div>
    <div class="row-between small muted" style="margin-top:8px"><span>Đã chi ${fmt(m.spent)} (${m.total ? ((m.spent / m.total) * 100).toFixed(0) : 0}%)</span><span>Vạch đậm: mốc thời gian hôm nay</span></div>
    <div class="stats" style="margin-top:12px">
      <div class="stat"><div class="v ${flexLeft < 0 ? "bad" : "good"}">${m.daysLeft ? fmt(Math.max(0, flexLeft) / m.daysLeft) : "—"}</div><div class="l">Mỗi ngày còn tiêu được (ăn uống, đi chợ, linh tinh…)</div></div>
      <div class="stat"><div class="v ${flexLeft < 0 ? "bad" : ""}">${fmt(flexLeft)}</div><div class="l">Tiền chi tiêu linh hoạt còn lại cả kỳ</div></div>
    </div>`;

  // Chi theo mục
  $("#byCat").innerHTML = S.cats.map((c) => {
    const sp = m.spentBy[c.id] || 0, bud = p.budgets[c.id] || 0, lf = r2(bud - sp), pct = bud ? Math.min(100, (sp / bud) * 100) : sp ? 100 : 0;
    if (!bud && !sp) return "";
    const fixed = c.kind === "fixed", locked = LOCKED(c), open = fixed && lockOpen.has(c.id), months = pDays(p) / 30.44;
    return `<div class="r" style="--c:${cssColor(c)}">
      <div class="nm"><i class="dot"></i>${esc(c.name)}<small>${KIND_LABEL[c.kind] || ""}</small>
        ${fixed ? `<button type="button" class="lockbtn ${locked ? "" : "off"}" data-lock-open="${esc(c.id)}" aria-expanded="${open}" title="${locked ? "Đang khóa. Bấm để mở khóa và sửa số tiền" : "Đang mở khóa"}" aria-label="${locked ? "Đang khóa" : "Đang mở khóa"} mục ${esc(c.name)}"><svg aria-hidden="true"><use href="#i-${locked ? "lock" : "unlock"}"/></svg></button>` : ""}</div>
      <div class="small"><span class="${lf < 0 ? "bad" : "good"}" style="font-weight:700">${lf < 0 ? "Vượt " + fmt(-lf) : "Còn " + fmt(lf)}</span></div>
      <div class="full"><div class="bar ${sp > bud ? "over" : ""}"><i style="width:${pct.toFixed(1)}%"></i></div></div>
      <div class="full small muted">Đã chi ${fmt(sp)} / ${fmt0(bud)}</div>
      ${open ? `<div class="full lockrow">${lockSwitch(c, locked ? "Đang khóa" : "Đã mở khóa")}
        ${locked ? `<span class="small muted">Gạt công tắc để mở khóa và sửa số tiền.</span>`
          : `<label class="f inl">Ngân sách cả kỳ ($)<input type="number" min="0" step="1" inputmode="decimal" data-budget-home="${esc(c.id)}" value="${bud}" ${pStatus(p) === "done" ? "disabled" : ""}></label><span class="small muted">≈ ${fmt0(bud / months)}/tháng · ${esc(p.name)}</span>`}</div>` : ""}
    </div>`;
  }).join("") || `<div class="empty">Chưa chia ngân sách cho mục nào.</div>`;

  // Tối nay nấu
  $("#tonight").innerHTML = mealCard(dishFor(t), t, true, false);

  // Mốc
  if (n > (S.seenMilestone || 0) && MILESTONES.includes(n)) { S.seenMilestone = n; save(); celebrate(n); }
  if (n < (S.seenMilestone || 0) && n === 0) { S.seenMilestone = 0; save(); }
}
const DAY_STATUS = { nospend: ["Không tiêu", "on"], ok: ["Đúng plan", "on"], over: ["Vượt giới hạn", "bad"], missed: ["Quên ghi", "bad"], frozen: ["Dùng khiên", "soon"], pending: ["Chưa ghi", ""] };
let selDay = null; // ngày đang xem trong Lịch lửa
function renderCalendar(st) {
  const t = today(), p = activePeriod();
  if (!selDay || selDay > t) selDay = t;
  let html = DOW_LONG.map((d) => `<div class="dow">${d.replace("Thứ ", "T").replace("Chủ nhật", "CN")}</div>`).join("");
  let curMonth = "", d = mondayOf(p.start), okCount = 0, nsCount = 0;
  while (d <= p.end) {
    const weekHasNewMonth = [...Array(7)].map((_, i) => addDays(d, i)).find((x) => x.slice(0, 7) !== curMonth && inP(p, x));
    if (weekHasNewMonth) { curMonth = weekHasNewMonth.slice(0, 7); html += `<div class="mlabel">${MONTH_VI[+curMonth.slice(5)]}/${curMonth.slice(0, 4)}</div>`; }
    for (let i = 0; i < 7; i++) {
      const x = addDays(d, i);
      if (!inP(p, x)) { html += `<div class="d blank"></div>`; continue; }
      let cls = "future";
      if (x < S.trackStart && x <= t) cls = "";
      else if (st.days[x]) cls = st.days[x];
      if (cls === "ok") okCount++; if (cls === "nospend") nsCount++;
      const lbl = (DAY_STATUS[cls] || [])[0];
      html += x > t ? `<div class="d ${cls}">${+x.slice(8)}</div>`
        : `<button type="button" class="d ${cls} ${x === t ? "today" : ""} ${x === selDay ? "sel" : ""}" data-day="${x}" aria-pressed="${x === selDay}" aria-label="${ddmm(x)}${lbl ? ": " + lbl : ""}">${+x.slice(8)}</button>`;
    }
    d = addDays(d, 7);
  }
  $("#cal").innerHTML = html;
  $("#calSum").textContent = `${p.name} · ${nsCount} ngày không tiêu · ${okCount} ngày đúng plan`;
  $("#capTxt").textContent = fmt0(S.cap);
  renderDay(st);
}
// Bảng bên phải lịch: chi tiêu của ngày đang chọn
function renderDay(st) {
  const d = selDay, ex = (st.exBy[d] || []).slice().sort((a, b) => (b.t || 0) - (a.t || 0)), fr = st.frBy[d] || [];
  const [lbl, cls] = DAY_STATUS[st.days[d]] || ["", ""];
  const tot = r2(sum(ex, (e) => e.amount)), out = r2(sum(ex.filter((e) => kindOf(e.cat) === "flex"), (e) => e.amount));
  const names = Object.fromEntries(FREE_SRC.map((x) => [x.id, x.name]));
  const empty = !ex.length && !fr.length;
  $("#dayInfo").innerHTML = `
    <div class="row-between"><h2>${DOW_LONG[(dow(d) + 6) % 7]}, ${dmy(d)}</h2>${lbl ? `<span class="tag ${cls}">${lbl}</span>` : ""}</div>
    <div class="stats">
      <div class="stat"><div class="v">${fmt(tot)}</div><div class="l">Đã chi cả ngày</div></div>
      <div class="stat"><div class="v ${out > S.cap + 1e-9 ? "bad" : "good"}">${fmt(out)}</div><div class="l">Ngoài plan (giới hạn ${fmt0(S.cap)})</div></div>
    </div>
    ${empty ? `<div class="empty"><strong>${S.checkins[d] ? "Ngày không tiêu" : "Không có khoản nào"}</strong>${S.checkins[d] ? "Bạn đã ghi ngày này không tiêu đồng nào." : d === today() ? "Hôm nay chưa ghi gì." : "Ngày này chưa ghi khoản chi nào."}</div>`
      : `<div class="list">${ex.map((e) => expRow(e, true)).join("")}${fr.map((f) => `<div class="li"><span class="dt"><b>Free</b></span><span class="what">${esc(f.note || names[f.src] || "Bữa free")}<small>${esc(names[f.src] || "")}</small></span><span class="money good">+${fmt(f.saved)}</span></div>`).join("")}</div>`}
    <div class="actions"><button class="btn primary" type="button" data-add-day="${d}"><svg aria-hidden="true"><use href="#i-plus"/></svg>Ghi khoản chi ngày này</button>
      ${empty && !S.checkins[d] ? `<button class="btn" type="button" data-nospend-day="${d}">Ngày này tôi không tiêu</button>` : ""}</div>`;
}
function celebrate(n) {
  $("#celebrateCard").innerHTML = `<div class="flame lit pop" style="width:96px;height:118px">${flameSVG(n)}</div><div class="big">${n} ngày</div><div>Bạn vừa chạm mốc ${n} ngày giữ lửa.</div><button class="btn primary" type="button" id="celebrateClose">Tiếp tục</button>`;
  $("#celebrate").hidden = false; $("#celebrateClose").focus();
  $("#celebrateClose").onclick = () => ($("#celebrate").hidden = true);
}

/* ================= Render: Chi tiêu ================= */
// Một dòng khoản chi, bấm để sửa. byTime: cột trái hiện giờ ghi thay cho ngày (dùng trong chi tiết một ngày)
function expRow(e, byTime) {
  const c = catById()[e.cat], at = new Date(e.t || 0);
  const left = byTime ? (e.t > 1e12 ? `<b>${pad(at.getHours())}:${pad(at.getMinutes())}</b>` : "") : `<b>${ddmm(e.date)}</b>${DOW_VI[dow(e.date)]}`;
  return `<button type="button" class="li" data-edit="${esc(e.id)}" style="--c:${cssColor(c)}">
    <span class="dt">${left}</span>
    <span class="what">${esc(e.note || (c ? c.name : "Khoản chi"))}<small><i class="dot"></i>${esc(c ? c.name : "Mục đã xóa")}</small></span>
    <span class="amt">${fmt(e.amount)}</span></button>`;
}
function renderLog() {
  const p = VP(), m = money(p), past = pStatus(p) === "done", act = activePeriod();
  const vb = $("#viewing");
  vb.hidden = p.id === act.id;
  if (!vb.hidden) vb.innerHTML = `<span>Đang xem kỳ <b>${esc(p.name)}</b> (${dmy(p.start)} – ${dmy(p.end)}).</span><button class="btn" type="button" data-viewp="">Về kỳ hiện tại</button>`;

  // Nhật ký
  const fs = $("#logFilter"), fv = fs.value || "all", cs = $("#logCat"), cv = cs.value || "all";
  const months = []; for (let d = p.start.slice(0, 7) + "-01"; d <= p.end; d = addMonths(d, 1)) months.push(d.slice(0, 7));
  fs.innerHTML = `<option value="all">Cả kỳ</option>` + months.map((x) => `<option value="${x}">${MONTH_VI[+x.slice(5)]}</option>`).join("");
  fs.value = months.includes(fv) ? fv : "all";
  cs.innerHTML = `<option value="all">Mọi mục</option>` + S.cats.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  cs.value = S.cats.some((c) => c.id === cv) ? cv : "all";
  const cats = catById();
  let list = S.expenses.filter((e) => inP(p, e.date));
  if (fs.value !== "all") list = list.filter((e) => e.date.startsWith(fs.value));
  if (cs.value !== "all") list = list.filter((e) => e.cat === cs.value);
  list.sort((a, b) => (a.date === b.date ? b.t - a.t : a.date < b.date ? 1 : -1));
  $("#log").innerHTML = list.length ? list.map((e) => expRow(e)).join("")
    + `<div class="li total"><div></div><div class="what muted small">${list.length} khoản</div><div class="money">${fmt(sum(list, (e) => e.amount))}</div></div>`
    : `<div class="empty"><strong>Chưa có khoản chi nào</strong>Bấm "Ghi khoản chi" để ghi khoản đầu tiên.</div>`;

  // Ngân sách
  $("#budgetFor").textContent = `${p.name} · tổng quỹ ${fmt0(m.total)}`;
  $("#cats").innerHTML = S.cats.map((c) => {
    const sp = m.spentBy[c.id] || 0, bud = p.budgets[c.id] || 0, lf = r2(bud - sp), pct = bud ? Math.min(100, (sp / bud) * 100) : sp ? 100 : 0;
    const used = c.id === "groceries" || S.expenses.some((e) => e.cat === c.id);
    return `<div class="cat" style="--c:${cssColor(c)}">
      <div class="cat-h">
        <button type="button" class="swatch" data-swatch="${esc(c.id)}" aria-label="Đổi màu mục ${esc(c.name)}" title="Bấm để đổi màu"></button>
        <input class="nm-in" value="${esc(c.name)}" data-name="${esc(c.id)}" maxlength="30" aria-label="Tên mục">
        <select class="kind" data-kind="${esc(c.id)}" aria-label="Loại mục ${esc(c.name)}">${Object.entries(KIND_LABEL).map(([k, l]) => `<option value="${k}" ${k === c.kind ? "selected" : ""}>${l}</option>`).join("")}</select>
        <input class="bud" type="number" min="0" step="1" inputmode="decimal" value="${bud}" data-budget="${esc(c.id)}" aria-label="Ngân sách ${esc(c.name)}" ${past || LOCKED(c) ? "disabled" : ""}>
      </div>
      <div class="bar ${sp > bud ? "over" : ""}"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="caption"><span>Đã chi ${fmt(sp)}</span>${c.kind === "fixed" ? lockSwitch(c, "Khóa") : ""}${used ? "" : `<button type="button" class="btn quiet danger" data-delcat="${esc(c.id)}">Xóa mục</button>`}<span class="${lf < 0 ? "bad" : "good"}" style="font-weight:700">${lf < 0 ? "Vượt " + fmt(-lf) : "Còn " + fmt(lf)}</span></div>
    </div>`;
  }).join("");
  const alloc = sum(S.cats, (c) => p.budgets[c.id] || 0), un = r2(m.total - alloc), ua = $("#unalloc");
  if (Math.abs(un) >= 0.01) { ua.hidden = false; ua.className = "hint" + (un < 0 ? " bad" : ""); ua.textContent = un > 0 ? `Còn ${fmt(un)} chưa chia vào mục nào.` : `Các mục đang vượt tổng quỹ ${fmt(-un)}.`; }
  else ua.hidden = true;
  if (document.activeElement !== $("#sCap")) $("#sCap").value = S.cap;

  // Các kỳ
  $("#periods").innerHTML = [...S.periods].reverse().map((q) => {
    const s = pStatus(q), sp = spentIn(q), tot = total(q), lf = r2(tot - sp), carry = carryIn(q), first = !prevOf(q);
    return `<div class="per">
      <div class="row-between"><div><b>${esc(q.name)}</b> <span class="tag ${s}">${s === "on" ? "Đang chạy" : s === "soon" ? "Sắp tới" : "Đã xong"}</span><div class="small muted">${dmy(q.start)} – ${dmy(q.end)} · ${pDays(q)} ngày</div></div>
        <button class="btn" type="button" data-viewp="${esc(q.id)}">Xem nhật ký</button></div>
      <div class="nums"><span>Tổng quỹ <b>${fmt(tot)}</b>${carry ? ` <span class="muted">(gồm ${fmt(carry)} dư kỳ trước)</span>` : ""}</span><span>Đã chi <b>${fmt(sp)}</b></span><span>${s === "done" ? "Dư" : "Còn"} <b class="${lf < 0 ? "bad" : "good"}">${fmt(lf)}</b></span></div>
      ${s === "done" ? "" : `<div class="edit">
        <label class="f">Tên kỳ<input data-pname="${esc(q.id)}" value="${esc(q.name)}" maxlength="40"></label>
        <label class="f">Tiền mới ($)<input type="number" min="0" step="1" inputmode="decimal" data-pamount="${esc(q.id)}" value="${q.amount || 0}"></label>
        ${s === "soon" ? `<label class="f">Bắt đầu<input type="date" data-pstart="${esc(q.id)}" value="${q.start}"></label>` : ""}
        <label class="f">Kết thúc<input type="date" data-pend="${esc(q.id)}" value="${q.end}"></label>
      </div>
      ${first ? "" : `<label class="check small"><input type="checkbox" data-pcarry="${esc(q.id)}" ${q.carry ? "checked" : ""}><span>Cộng tiền còn dư của kỳ trước vào kỳ này</span></label>`}
      ${s === "soon" ? `<div><button class="btn quiet danger" type="button" data-delp="${esc(q.id)}">Xóa kỳ này</button></div>` : ""}`}
    </div>`;
  }).join("");
}

/* ---------- Hộp thoại ghi / sửa khoản chi ---------- */
let editId = null, lastCat = "eatout";
const selCat = () => { const r = $("#xCats input:checked"); return r ? r.value : S.cats[0].id; };
function openExp(id, date) {
  const e = id ? S.expenses.find((x) => x.id === id) : null;
  editId = e ? e.id : null;
  $("#dxTitle").textContent = e ? "Sửa khoản chi" : "Ghi khoản chi";
  $("#xAmt").value = e ? e.amount : ""; $("#xNote").value = e ? e.note || "" : ""; $("#xDate").value = e ? e.date : date || today();
  $("#xDate").min = S.periods[0].start; $("#xDate").max = lastPeriod().end;
  const cat = e ? e.cat : S.cats.some((c) => c.id === lastCat) ? lastCat : S.cats[0].id;
  $("#xCats").innerHTML = S.cats.map((c) => `<label class="cp" style="--c:${cssColor(c)}"><input type="radio" name="xcat" value="${esc(c.id)}" ${c.id === cat ? "checked" : ""}><span>${esc(c.name)}</span></label>`).join("");
  const del = $("#xDel"); del.hidden = !e; delete del.dataset.armed; del.textContent = "Xóa khoản này";
  renderChips(); updateHint();
  $("#dlgExp").showModal();
  if (!e) $("#xAmt").focus();
}
function renderChips() {
  const v = CHIPS[selCat()] || [];
  $("#xChips").innerHTML = v.map((x) => `<button type="button" data-v="${x}">$${x}</button>`).join("");
}
function updateHint() {
  const cat = selCat(), h = $("#xHint"), d = $("#xDate").value || today();
  if (!S.periods.some((p) => inP(p, d))) { h.hidden = false; h.className = "hint wide bad"; h.textContent = "Ngày này không thuộc kỳ ngân sách nào nên sẽ không được tính vào ví."; return; }
  if (kindOf(cat) !== "flex") { h.hidden = true; return; }
  const used = S.expenses.filter((e) => e.date === d && e.id !== editId && kindOf(e.cat) === "flex").reduce((a, e) => a + e.amount, 0);
  const amt = parseFloat($("#xAmt").value) || 0, room = r2(S.cap - used);
  h.hidden = false;
  if (amt > room + 1e-9) { h.className = "hint wide bad"; h.textContent = `Khoản này vượt giới hạn ngoài plan của ngày (${fmt(Math.max(0, room))} còn lại). Lưu thì ngày này sẽ tính là vượt.`; }
  else { h.className = "hint wide"; h.textContent = `Ngày ${ddmm(d)} còn ${fmt(Math.max(0, room))} ngoài plan trước khi lửa bị ảnh hưởng.`; }
}
function delExpense(id) {
  S.deleted[id] = Date.now(); S.expenses = S.expenses.filter((x) => x.id !== id);
  for (const k of Object.keys(S.shop)) if (k.endsWith(":eid") && S.shop[k] === id) { delete S.shop[k]; delete S.shop[k.slice(0, -4) + ":logged"]; }
}

/* ---------- Hộp thoại tạo kỳ mới ---------- */
function openPeriod() {
  const q = lastPeriod(), start = addDays(q.end, 1), end = addDays(addMonths(start, 6), -1);
  $("#npStart").value = start; $("#npStart").min = start;
  $("#npEnd").value = end; $("#npName").value = `Kỳ ${start.slice(5, 7)}/${start.slice(0, 4)} – ${end.slice(5, 7)}/${end.slice(0, 4)}`;
  $("#npAmount").value = ""; $("#npCarry").checked = true;
  const lf = r2(total(q) - spentIn(q));
  $("#npCarryTxt").innerHTML = pStatus(q) === "done"
    ? `Cộng <b class="good">${fmt(Math.max(0, lf))}</b> còn dư từ kỳ “${esc(q.name)}”`
    : `Cộng tiền còn dư của kỳ “${esc(q.name)}” (hiện còn <b class="good">${fmt(Math.max(0, lf))}</b>; số cuối cùng tính khi kỳ đó kết thúc)`;
  updatePeriodHint();
  $("#dlgPeriod").showModal(); $("#npAmount").focus();
}
function updatePeriodHint() {
  const s = $("#npStart").value, e = $("#npEnd").value, q = lastPeriod();
  const amt = parseFloat($("#npAmount").value) || 0, carry = $("#npCarry").checked ? Math.max(0, r2(total(q) - spentIn(q))) : 0;
  $("#npHint").textContent = s && e && e >= s ? `${diff(s, e) + 1} ngày (~${Math.round((diff(s, e) + 1) / 30.4)} tháng) · tổng quỹ khoảng ${fmt(amt + carry)}.` : "Ngày kết thúc phải sau ngày bắt đầu.";
}

/* ================= Render: Nấu ================= */
const ALL_DISHES = MENU.flatMap((w) => w.days);
const baseDishIdx = (date) => (((weekIdxOf(date) % 4) + 4) % 4) * 7 + (dow(date) + 6) % 7;
const dishIdx = (date) => { const o = S.meals[date]; return o && o.i >= 0 && ALL_DISHES[o.i] ? o.i : baseDishIdx(date); };
const dishFor = (date) => ALL_DISHES[dishIdx(date)];
const cookStart = () => Math.max(0, weekIdxOf(S.periods[0].start));
const cookEnd = () => weekIdxOf(lastPeriod().end);
let cookWeek = weekIdxOf(today());
function mealCard(x, date, open, showDay) {
  const t = today(), cur = dishIdx(date);
  return `<details class="meal ${date === t ? "is-today" : ""}" ${open ? "open" : ""}>
    <summary>
      <div class="dayname">${showDay ? `<b>${DOW_VI[dow(date)]}</b>${ddmm(date)}` : `<b>${ddmm(date)}</b>${DOW_VI[dow(date)]}`}</div>
      <div class="dish">${esc(x.n)}<small>${esc(x.s)}</small></div>
      <div class="kc"><b>${x.p}g</b> đạm<br>~${x.k} kcal</div>
    </summary>
    <div class="body">
      <div class="tags"><span class="tag">${x.t} phút</span><span class="tag">${esc(x.tool)}</span><span class="tag">2 phần</span>${cur !== baseDishIdx(date) ? `<span class="tag soon">Đã đổi món</span>` : ""}</div>
      <ol>${x.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <label class="f swap">Đổi món ngày ${ddmm(date)}<select data-swap="${date}">${MENU.map((w, wi) => `<optgroup label="${esc(w.title)}">${w.days.map((d, di) => { const i = wi * 7 + di; return `<option value="${i}" ${i === cur ? "selected" : ""}>${esc(d.n)}${i === baseDishIdx(date) ? " (món gốc)" : ""}</option>`; }).join("")}</optgroup>`).join("")}</select></label>
    </div>
  </details>`;
}
function renderCook() {
  cookWeek = Math.max(cookStart(), Math.min(cookEnd(), cookWeek));
  const mon = addDays(BASE_MONDAY, cookWeek * 7), wk = MENU[((cookWeek % 4) + 4) % 4], t = today();
  $("#ckTitle").textContent = wk.title;
  $("#ckRange").textContent = `${ddmm(mon)} – ${ddmm(addDays(mon, 6))}${cookWeek === weekIdxOf(t) ? " · tuần này" : ""}`;
  $("#ckPrev").disabled = cookWeek <= cookStart(); $("#ckNext").disabled = cookWeek >= cookEnd();
  $("#meals").innerHTML = wk.days.map((_, i) => { const d = addDays(mon, i); return (d < S.periods[0].start || d > lastPeriod().end) ? "" : mealCard(dishFor(d), d, d === t, true); }).join("");
}

/* ================= Render: Đi chợ ================= */
let shopWeek = weekIdxOf(today());
function weekLists(w) {
  const mon = addDays(BASE_MONDAY, w * 7), sun = addDays(mon, 6), out = [];
  for (const c of COSTCO) if (c.due >= mon && c.due <= sun) out.push(["costco:" + c.id, c.label, "Đặt giao khoảng " + ddmm(c.due), c.items]);
  out.push(["cermak:" + w, "Cermak Fresh Market", "Đi 1 lần đầu tuần", CERMAK[((w % 4) + 4) % 4]]);
  if (w === 0) out.push(["pantry", "Gia vị dùng cả kỳ", "Mua 1 lần ở Cermak", PANTRY]);
  return out;
}
function shopBlock([key, title, sub, items]) {
  const done = S.shop[key] || {};
  const tot = sum(items, (it) => it[3]), got = items.filter((it) => done[it[0]]).length;
  const logged = S.shop[key + ":logged"];
  return `<div class="shop" data-key="${esc(key)}">
    <header><h3>${esc(title)}</h3><span class="small muted">${esc(sub)} · ${got}/${items.length} món · ~${fmt0(tot)}</span></header>
    ${items.map((it) => `<label class="item ${done[it[0]] ? "done" : ""}"><input type="checkbox" data-item="${esc(it[0])}" ${done[it[0]] ? "checked" : ""}><span class="iname">${esc(it[1])}${it[2] ? `<small>${esc(it[2])}</small>` : ""}</span><span class="small muted">~$${it[3]}</span></label>`).join("")}
    <footer>
      ${logged ? `<span class="small good">Đã ghi ${fmt(logged)} vào Đi chợ.</span> <button class="btn quiet" type="button" data-unlog>Sửa</button>`
        : `<input type="number" min="0" step="0.01" inputmode="decimal" placeholder="${tot.toFixed(2)}" aria-label="Số tiền thực trả" data-paid><button class="btn" type="button" data-logshop>Ghi số tiền đã trả</button>`}
    </footer>
  </div>`;
}
function renderShop() {
  shopWeek = Math.max(cookStart(), Math.min(cookEnd(), shopWeek));
  const mon = addDays(BASE_MONDAY, shopWeek * 7), sun = addDays(mon, 6);
  $("#spTitle").textContent = `Tuần ${ddmm(mon)} – ${ddmm(sun)}`;
  $("#spRange").textContent = (shopWeek === weekIdxOf(today()) ? "Tuần này · " : "") + "thực đơn: " + MENU[((shopWeek % 4) + 4) % 4].title.toLowerCase();
  $("#spPrev").disabled = shopWeek <= cookStart(); $("#spNext").disabled = shopWeek >= cookEnd();
  let html = weekLists(shopWeek).map(shopBlock).join("");
  const nextC = COSTCO.find((c) => c.due > sun);
  if (nextC) html += `<p class="small muted" style="margin:0">Đơn Costco tiếp theo: ${esc(nextC.label.toLowerCase())}, khoảng ${ddmm(nextC.due)}.</p>`;
  $("#shopLists").innerHTML = html;
}

/* ================= Render: Săn free ================= */
function renderFree() {
  const sel = $("#frSrc");
  if (!sel.options.length) sel.innerHTML = FREE_SRC.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
  $("#savedTotal").textContent = fmt(sum(S.free, (f) => f.saved));
  $("#savedCount").textContent = S.free.length ? `${S.free.length} bữa free · tính vào chuỗi lửa của ngày đó` : "Mỗi bữa free được ghi cũng giữ lửa cho ngày đó.";
  const names = Object.fromEntries(FREE_SRC.map((s) => [s.id, s.name]));
  const list = S.free.slice().sort((a, b) => (a.date === b.date ? b.t - a.t : a.date < b.date ? 1 : -1));
  $("#freeLog").innerHTML = list.length ? list.map((f) => `<div class="li"><div class="dt"><b>${ddmm(f.date)}</b>${DOW_VI[dow(f.date)]}</div><div class="what">${esc(f.note || names[f.src] || "Bữa free")}<small>${esc(names[f.src] || "")}</small></div><div class="money good">+${fmt(f.saved)}</div><button class="btn quiet" type="button" data-delfree="${esc(f.id)}">Xóa</button></div>`).join("")
    : `<div class="empty"><strong>Chưa có bữa free nào</strong>Lần tới ăn pizza ở buổi họp CLB thì ghi vào đây.</div>`;
  $("#srcFree").innerHTML = FREE_SRC.filter((s) => s.k).map((s) => `<div class="src"><h3>${esc(s.name)}</h3><div class="small">${esc(s.k)}</div><div class="k">${esc(s.how)}</div>${s.links.length ? `<div class="small">${s.links.map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(l)}</a>`).join(" · ")}</div>` : ""}</div>`).join("");
  $("#srcSale").innerHTML = SALE_SRC.map((s) => `<div class="src"><h3>${esc(s.name)}</h3><div class="small">${esc(s.k)}</div></div>`).join("");
}

/* ================= Render: Cài đặt ================= */
function renderSettings() {
  renderSync(true);
  $("#storeInfo").textContent = `${S.expenses.length} khoản chi, ${S.free.length} bữa free, ${S.periods.length} kỳ ngân sách.` + (storageOK ? "" : " Trình duyệt này đang chặn lưu dữ liệu trong máy (có thể do tab ẩn danh).");
  let th = "", intro = true; try { th = localStorage.getItem("giu-lua-theme") || ""; intro = localStorage.getItem("giu-lua-intro") !== "off"; } catch (e) {}
  $("#theme").value = th; $("#introOn").checked = intro;
}

/* ================= Thanh trên, số thông báo ================= */
function renderTop() {
  for (const b of [$("#rWeek"), $("#rMonth")]) {
    const r = remain(b.dataset.range);
    b.hidden = !r; if (!r) continue;
    b.className = "remain" + (r.left < 0 ? " neg" : r.left < r.allow * 0.2 ? " low" : "");
    b.innerHTML = `<small>${r.kind === "week" ? "Tuần này còn" : MONTH_VI[+r.a.slice(5, 7)] + " còn"}</small><b>${fmt(r.left)}</b>`;
  }
  const p = activePeriod(), m = money(p);
  $("#periodChip").innerHTML = `<span class="muted">Kỳ ngân sách</span><b>${esc(p.name)}</b>${m.daysLeft ? `còn ${m.daysLeft} ngày` : "đã kết thúc"}`;
}
function remainHTML(kind) {
  const r = remain(kind); if (!r) return "";
  return `<h3>${kind === "week" ? "Tuần này" : MONTH_VI[+r.a.slice(5, 7)]} · ${ddmm(r.a)} – ${ddmm(r.b)}</h3>
    <p class="small muted" style="margin:4px 0 8px">Ngân sách các mục trong plan và ngoài plan chia đều theo ngày, trừ số đã chi. Không tính mục cố định (wifi, cắt tóc…) và dự phòng.</p>
    ${r.rows.map((x) => `<div class="rrow" style="--c:${cssColor(x.c)}"><span class="nm"><i class="dot"></i>${esc(x.c.name)}</span><span class="small muted">${fmt(x.spent)} / ${fmt0(x.allow)}</span><b class="${x.left < 0 ? "bad" : "good"}">${fmt(x.left)}</b></div>`).join("")}
    <div class="rrow total"><span>Tổng</span><span class="small">${fmt(r.spent)} / ${fmt0(r.allow)}</span><b class="${r.left < 0 ? "bad" : "good"}">${fmt(r.left)}</b></div>`;
}
function renderBadges(st) {
  if (!S) return;
  st = st || streak();
  const b = {}, p = curPeriod();
  b.home = (st.todaySt === "pending" ? 1 : 0) + (yesterdayMissed(st) ? 1 : 0);
  b["home:overview"] = b.home;
  if (p) { const m = money(p); b["log:budget"] = S.cats.filter((c) => (m.spentBy[c.id] || 0) > (p.budgets[c.id] || 0) + 1e-9).length; }
  b["log:periods"] = needNewPeriod() ? 1 : 0;
  b.log = (b["log:budget"] || 0) + b["log:periods"];
  const w = weekIdxOf(today());
  b.shop = b["shop:list"] = sum(weekLists(w), ([key, , , items]) => items.filter((it) => !(S.shop[key] || {})[it[0]]).length);
  b.settings = b["settings:sync"] = sync.state === "error" ? 1 : 0;
  for (const el of $$("[data-badge]")) { const n = b[el.dataset.badge] || 0; el.hidden = !n; el.textContent = n; }
}

/* ================= Điều hướng ================= */
const SUBS = {
  home: [["overview", "Tổng quan"], ["calendar", "Lịch lửa"], ["rules", "Luật chơi"]],
  log: [["history", "Nhật ký"], ["budget", "Ngân sách"], ["periods", "Kỳ ngân sách"]],
  cook: [["week", "Thực đơn tuần"], ["tips", "Mẹo nấu"]],
  shop: [["list", "Danh sách"], ["tips", "Mẹo Costco"]],
  free: [["log", "Đã săn"], ["where", "Chỗ có đồ free"], ["sale", "Săn sale"]],
  settings: [["sync", "Đồng bộ"], ["data", "Sao lưu"], ["app", "Giao diện"]]
};
const TABS = Object.keys(SUBS);
const curSub = Object.fromEntries(TABS.map((t) => [t, SUBS[t][0][0]]));
function show(tab, sub, push = true) {
  if (!SUBS[tab]) tab = "home";
  if (sub && SUBS[tab].some(([k]) => k === sub)) curSub[tab] = sub;
  sub = curSub[tab];
  for (const t of TABS) $("#v-" + t).hidden = t !== tab;
  for (const el of $$("#v-" + tab + " [data-sub]")) el.hidden = el.dataset.sub !== sub;
  for (const b of $$("[data-tab]")) b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false");
  renderSticker(tab, sub);
  $("#subtabs").innerHTML = SUBS[tab].map(([k, l]) => `<button type="button" role="tab" data-sub-go="${k}" aria-selected="${k === sub}">${l}<span class="badge" data-badge="${tab}:${k}" hidden></span></button>`).join("");
  if (push) { try { history.replaceState(null, "", "#" + tab + "/" + sub); } catch (e) {} }
  renderAll(); window.scrollTo(0, 0);
}
const current = () => TABS.find((t) => !$("#v-" + t).hidden) || "home";
// Ảnh dán bên phải (chỉ màn hình rộng): lấy từ STICKERS trong data.js theo "mục/mục con" hoặc "mục".
// Tổng quan và Lịch lửa đã kín chỗ nên không dán ảnh.
function renderSticker(tab, sub) {
  const st = typeof STICKERS === "object" && !(tab === "home" && (sub === "overview" || sub === "calendar")) ? STICKERS[tab + "/" + sub] || STICKERS[tab] : null;
  const fig = $(".cheer"); fig.hidden = !st; if (!st) return;
  const img = fig.querySelector("img");
  if (img.getAttribute("src") !== st.src) img.src = st.src;
  img.alt = st.alt || "";
  fig.querySelector("figcaption").innerHTML = st.caption ? `${esc(st.caption)}${st.sub ? `<small>${esc(st.sub)}</small>` : ""}` : "";
}
function renderAll() {
  const c = current(), st = streak();
  if (c === "home") { renderHome(st); renderCalendar(st); }
  else if (c === "log") renderLog(); else if (c === "cook") renderCook(); else if (c === "shop") renderShop(); else if (c === "free") renderFree(); else renderSettings();
  renderTop(); renderBadges(st);
}
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); }
function arm(b, label, armedLabel) { // bấm 2 lần mới thực hiện, tránh xóa nhầm
  if (b.dataset.armed) return true;
  b.dataset.armed = "1"; b.textContent = armedLabel;
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = label; } }, 3500);
  return false;
}

/* ================= Sự kiện ================= */
document.addEventListener("click", (e) => {
  const tb = e.target.closest("[data-tab]"); if (tb) { show(tb.dataset.tab); return; }
  const sg = e.target.closest("[data-sub-go]"); if (sg) { show(current(), sg.dataset.subGo); return; }
  const go = e.target.closest("[data-go]"); if (go) { const [t, s] = go.dataset.go.split("/"); show(t, s); return; }
  if (e.target.closest("[data-add]")) { openExp(); return; }
  if (e.target.closest("[data-new-period]")) { openPeriod(); return; }
  const cl = e.target.closest("[data-close]"); if (cl) { cl.closest("dialog").close(); return; }
  const rm = e.target.closest(".remain"); if (rm) { $("#remainPop").innerHTML = remainHTML(rm.dataset.range); return; }
  const vp = e.target.closest("[data-viewp]"); if (vp) { viewId = vp.dataset.viewp || null; show("log", "history"); return; }
  const a = e.target.closest("[data-act]");
  if (a && a.dataset.act === "nospend") { S.checkins[today()] = Date.now(); save(); toast("Đã ghi ngày không tiêu."); renderAll(); }
  if (a && a.dataset.act === "nospend-y") { S.checkins[addDays(today(), -1)] = Date.now(); save(); toast("Đã ghi hôm qua không tiêu."); renderAll(); }
});
// Bấm ra ngoài hộp thoại để đóng
for (const d of $$("dialog")) d.addEventListener("click", (e) => {
  const r = d.getBoundingClientRect();
  if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close();
});

// Ghi / sửa khoản chi
$("#xCats").addEventListener("change", () => { renderChips(); updateHint(); });
$("#xAmt").addEventListener("input", updateHint); $("#xDate").addEventListener("change", updateHint);
$("#xChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { $("#xAmt").value = b.dataset.v; updateHint(); $("#xNote").focus(); } });
$("#fExp").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = r2(parseFloat($("#xAmt").value)), date = $("#xDate").value, cat = selCat(), note = $("#xNote").value.trim();
  if (!(amount > 0)) return toast("Số tiền phải lớn hơn 0.");
  if (!date) return toast("Chọn ngày chi.");
  const name = (catById()[cat] || {}).name || "";
  if (editId) {
    const x = S.expenses.find((y) => y.id === editId);
    if (!x) { $("#dlgExp").close(); return toast("Khoản này vừa bị xóa ở máy khác."); }
    Object.assign(x, { amount, date, cat, note, u: Date.now() });
    toast(`Đã sửa: ${fmt(amount)} · ${name}.`);
  } else {
    S.expenses.push({ id: uid(), date, amount, cat, note, t: Date.now() });
    delete S.checkins[date];
    toast(`Đã lưu ${fmt(amount)} vào ${name}.`);
  }
  lastCat = cat; save(); $("#dlgExp").close(); renderAll();
});
$("#xDel").addEventListener("click", (e) => {
  if (!arm(e.currentTarget, "Xóa khoản này", "Bấm lần nữa để xóa")) return;
  delExpense(editId); save(); $("#dlgExp").close(); toast("Đã xóa khoản chi."); renderAll();
});
// Khoản chi bấm để sửa (nhật ký, chi tiết ngày), ô ngày trong lịch, khóa mục cố định
document.addEventListener("click", (e) => {
  const ed = e.target.closest("[data-edit]"); if (ed) { openExp(ed.dataset.edit); return; }
  const dy = e.target.closest("[data-day]");
  if (dy) { selDay = dy.dataset.day; renderAll(); if (innerWidth < 1100) $("#dayInfo").scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
  const ad = e.target.closest("[data-add-day]"); if (ad) { openExp(null, ad.dataset.addDay); return; }
  const ns = e.target.closest("[data-nospend-day]");
  if (ns) { S.checkins[ns.dataset.nospendDay] = Date.now(); save(); toast(`Đã ghi ngày ${ddmm(ns.dataset.nospendDay)} không tiêu.`); renderAll(); return; }
  const lo = e.target.closest("[data-lock-open]");
  if (lo) { const id = lo.dataset.lockOpen; if (!lockOpen.delete(id)) lockOpen.add(id); renderAll(); }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.lock) {
    const c = S.cats.find((x) => x.id === el.dataset.lock); if (!c) return;
    if (el.checked) delete c.unlocked; else c.unlocked = true;
    touchSettings(); save(); toast(el.checked ? `Đã khóa mục ${c.name}.` : `Đã mở khóa ${c.name}, giờ sửa được số tiền.`); renderAll();
    if (!el.checked) { const inp = $(`[data-budget-home="${CSS.escape(c.id)}"]`); if (inp) inp.focus(); }
  }
  if (el.dataset.budgetHome) {
    const c = S.cats.find((x) => x.id === el.dataset.budgetHome); if (!c || LOCKED(c)) return;
    activePeriod().budgets[c.id] = Math.max(0, r2(parseFloat(el.value) || 0));
    touchSettings(); save(); toast(`Đã đổi ngân sách ${c.name}.`); renderAll();
  }
});
$("#logFilter").addEventListener("change", renderLog); $("#logCat").addEventListener("change", renderLog);

// Ngân sách và mục
$("#cats").addEventListener("change", (e) => {
  const el = e.target, id = el.dataset.budget || el.dataset.name || el.dataset.kind; if (!id) return;
  const c = S.cats.find((x) => x.id === id); if (!c) return;
  if (el.dataset.budget) VP().budgets[id] = Math.max(0, r2(parseFloat(el.value) || 0));
  if (el.dataset.name) c.name = el.value.trim() || c.name;
  if (el.dataset.kind) c.kind = el.value;
  touchSettings(); save(); renderAll();
});
$("#cats").addEventListener("click", (e) => {
  const sw = e.target.closest("[data-swatch]");
  if (sw) { const c = S.cats.find((x) => x.id === sw.dataset.swatch); c.color = SWATCHES[(SWATCHES.indexOf(c.color) + 1) % SWATCHES.length]; touchSettings(); save(); renderAll(); return; }
  const dc = e.target.closest("[data-delcat]");
  if (dc) { if (!arm(dc, "Xóa mục", "Bấm lần nữa")) return; S.cats = S.cats.filter((x) => x.id !== dc.dataset.delcat); touchSettings(); save(); renderAll(); }
});
$("#addCat").addEventListener("click", () => {
  const used = new Set(S.cats.map((c) => c.color));
  S.cats.push({ id: uid(), name: "Mục mới", kind: "plan", note: "", color: SWATCHES.find((s) => !used.has(s)) || "c0" });
  touchSettings(); save(); renderAll();
  const ins = $$("#cats [data-name]"); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); }
});
$("#sCap").addEventListener("change", (e) => { S.cap = Math.max(0, r2(parseFloat(e.target.value) || 0)); touchSettings(); save(); renderAll(); toast("Đã đổi giới hạn ngoài plan."); });

// Kỳ ngân sách
$("#periods").addEventListener("change", (e) => {
  const el = e.target, id = el.dataset.pname || el.dataset.pamount || el.dataset.pstart || el.dataset.pend || el.dataset.pcarry; if (!id) return;
  const i = S.periods.findIndex((x) => x.id === id), p = S.periods[i]; if (!p) return;
  if (el.dataset.pname) p.name = el.value.trim() || p.name;
  if (el.dataset.pamount) p.amount = Math.max(0, r2(parseFloat(el.value) || 0));
  if (el.dataset.pcarry) p.carry = el.checked;
  if (el.dataset.pstart || el.dataset.pend) {
    const s = el.dataset.pstart ? el.value : p.start, en = el.dataset.pend ? el.value : p.end;
    const before = S.periods[i - 1], after = S.periods[i + 1];
    if (!s || !en || en < s || (before && s <= before.end) || (after && en >= after.start)) { toast("Ngày không hợp lệ: các kỳ không được chồng lên nhau."); renderLog(); return; }
    p.start = s; p.end = en;
  }
  touchSettings(); save(); renderAll();
});
$("#periods").addEventListener("click", (e) => {
  const b = e.target.closest("[data-delp]"); if (!b) return;
  if (!arm(b, "Xóa kỳ này", "Bấm lần nữa để xóa")) return;
  S.periods = S.periods.filter((p) => p.id !== b.dataset.delp); if (viewId === b.dataset.delp) viewId = null;
  touchSettings(); save(); toast("Đã xóa kỳ sắp tới."); renderAll();
});
for (const id of ["#npStart", "#npEnd", "#npAmount", "#npCarry"]) $(id).addEventListener("input", updatePeriodHint);
$("#fPeriod").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = lastPeriod(), start = $("#npStart").value, end = $("#npEnd").value, name = $("#npName").value.trim();
  const amount = Math.max(0, r2(parseFloat($("#npAmount").value) || 0));
  if (!start || !end || end < start) return toast("Ngày kết thúc phải sau ngày bắt đầu.");
  if (start <= q.end) return toast(`Kỳ mới phải bắt đầu sau ${dmy(q.end)}.`);
  const scale = (diff(start, end) + 1) / pDays(q); // chia sẵn ngân sách theo tỉ lệ số ngày của kỳ trước
  const budgets = Object.fromEntries(S.cats.map((c) => [c.id, Math.round((q.budgets[c.id] || 0) * scale)]));
  S.periods.push({ id: uid(), name: name || "Kỳ mới", start, end, amount, carry: $("#npCarry").checked, budgets });
  touchSettings(); save(); $("#dlgPeriod").close(); viewId = null;
  toast(`Đã tạo kỳ “${name}”. Nhớ chỉnh ngân sách từng mục.`); show("log", "periods");
});

// Nấu
$("#ckPrev").addEventListener("click", () => { cookWeek--; renderCook(); });
$("#ckNext").addEventListener("click", () => { cookWeek++; renderCook(); });
document.addEventListener("change", (e) => {
  const s = e.target.closest("[data-swap]"); if (!s) return;
  const date = s.dataset.swap, i = +s.value;
  S.meals[date] = { i: i === baseDishIdx(date) ? -1 : i, t: Date.now() };
  save(); toast(i === baseDishIdx(date) ? "Đã về món gốc." : `Đã đổi sang ${ALL_DISHES[i].n}.`); renderAll();
});
// Đi chợ
$("#spPrev").addEventListener("click", () => { shopWeek--; renderShop(); });
$("#spNext").addEventListener("click", () => { shopWeek++; renderShop(); });
$("#shopLists").addEventListener("change", (e) => {
  const cb = e.target.closest("input[data-item]"); if (!cb) return;
  const key = cb.closest(".shop").dataset.key; S.shop[key] = S.shop[key] || {};
  if (cb.checked) S.shop[key][cb.dataset.item] = 1; else delete S.shop[key][cb.dataset.item];
  save(); renderAll();
});
$("#shopLists").addEventListener("click", (e) => {
  const box = e.target.closest(".shop"); if (!box) return; const key = box.dataset.key;
  if (e.target.closest("[data-logshop]")) {
    const inp = box.querySelector("[data-paid]"); const v = r2(parseFloat(inp.value || inp.placeholder));
    if (!(v > 0)) return toast("Nhập số tiền đã trả.");
    const id = uid();
    S.expenses.push({ id, date: today(), amount: v, cat: "groceries", note: box.querySelector("h3").textContent, t: Date.now() });
    S.shop[key + ":logged"] = v; S.shop[key + ":eid"] = id; save(); toast(`Đã ghi ${fmt(v)} vào Đi chợ.`); renderAll();
  }
  if (e.target.closest("[data-unlog]")) {
    const eid = S.shop[key + ":eid"]; if (eid) delExpense(eid);
    delete S.shop[key + ":logged"]; save(); toast("Đã bỏ khoản đi chợ này, bạn ghi lại số đúng nhé."); renderAll();
  }
});
// Free
$("#frSrc").addEventListener("change", () => { const s = FREE_SRC.find((x) => x.id === $("#frSrc").value); if (s) $("#frSaved").value = s.saved; });
$("#fFree").addEventListener("submit", (e) => {
  e.preventDefault();
  const saved = Math.max(0, r2(parseFloat($("#frSaved").value) || 0)), date = $("#frDate").value;
  if (!date) return toast("Chọn ngày.");
  S.free.push({ id: uid(), date, src: $("#frSrc").value, saved, note: $("#frNote").value.trim(), t: Date.now() });
  save(); $("#frNote").value = ""; toast(`Tiết kiệm thêm ${fmt(saved)}.`); renderAll();
});
$("#freeLog").addEventListener("click", (e) => {
  const b = e.target.closest("[data-delfree]"); if (!b) return;
  if (!arm(b, "Xóa", "Chắc chưa?")) return;
  S.deleted[b.dataset.delfree] = Date.now(); S.free = S.free.filter((x) => x.id !== b.dataset.delfree); save(); renderAll();
});
// Cài đặt
$("#bExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `giu-lua-sao-luu-${today()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast("Đã tải file sao lưu.");
});
$("#bImport").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  let o;
  try { o = JSON.parse(await f.text()); if (!o || o.v !== 1 || !Array.isArray(o.expenses) || !Array.isArray(o.cats)) throw new Error("bad"); }
  catch (err) { toast("File này không phải file sao lưu của trang."); return; }
  if (!confirm(`Thay toàn bộ dữ liệu hiện tại bằng file này (${o.expenses.length} khoản chi)? Các máy đang đồng bộ cũng sẽ bị thay.`)) return;
  // Ghi đè: đóng dấu thời gian mới cho mọi thứ trong file để thắng khi gộp với dữ liệu trên mạng
  const now = Date.now(), inc = normalize(o), keep = new Set([...inc.expenses, ...inc.free].map((x) => x.id));
  const del = Object.assign({}, S.deleted, inc.deleted);
  for (const x of [...S.expenses, ...S.free]) if (!keep.has(x.id)) del[x.id] = now;
  for (const x of [...inc.expenses, ...inc.free]) x.u = now + 1;
  for (const k of Object.keys(inc.checkins)) inc.checkins[k] = now;
  for (const k of Object.keys(inc.meals)) inc.meals[k].t = now;
  Object.assign(inc, { deleted: del, resetAt: now, settingsAt: now });
  S = inc; viewId = null; save(); toast("Đã khôi phục dữ liệu từ file."); renderAll();
});
$("#bReset").addEventListener("click", (e) => {
  const b = e.currentTarget;
  if (!arm(b, "Xóa toàn bộ dữ liệu", "Bấm lần nữa để xóa hết")) return;
  const del = Object.assign({}, S.deleted), now = Date.now();
  for (const x of [...S.expenses, ...S.free]) del[x.id] = now;
  S = freshState(); S.deleted = del; S.resetAt = now; S.settingsAt = now; viewId = null; save();
  delete b.dataset.armed; b.textContent = "Xóa toàn bộ dữ liệu"; toast("Đã xóa và bắt đầu lại."); renderAll();
});
// Nền sáng / tối: "" = theo máy
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (document.documentElement.dataset.theme || (darkMQ.matches ? "dark" : "light")) === "dark";
function setTheme(v) {
  try { if (v) localStorage.setItem("giu-lua-theme", v); else localStorage.removeItem("giu-lua-theme"); } catch (err) {}
  if (v) document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme;
  $("#theme").value = v; renderThemeBtn();
}
function renderThemeBtn() {
  const d = isDark(), label = d ? "Chuyển sang nền sáng" : "Chuyển sang nền tối";
  for (const b of $$("[data-theme-toggle]")) { b.innerHTML = `<svg aria-hidden="true"><use href="#i-${d ? "sun" : "moon"}"/></svg>`; b.setAttribute("aria-label", label); b.title = label; }
}
darkMQ.addEventListener("change", renderThemeBtn);
$("#theme").addEventListener("change", (e) => setTheme(e.target.value));
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme-toggle]"); if (!b) return;
  const next = isDark() ? "light" : "dark";
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { setTheme(next); return; }
  const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => setTheme(next)).ready.then(() => document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
    { duration: 520, easing: "cubic-bezier(.16, 1, .3, 1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
});
$("#introOn").addEventListener("change", (e) => { try { if (e.target.checked) localStorage.removeItem("giu-lua-intro"); else localStorage.setItem("giu-lua-intro", "off"); } catch (err) {} });
$("#celebrate").addEventListener("click", (e) => { if (e.target.id === "celebrate") $("#celebrate").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#celebrate").hidden = true; });
// Khi mở lại app (qua nửa đêm, hoặc máy khác vừa sửa)
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#dlgExp").open && !$("#dlgPeriod").open) { S = load(); renderAll(); } });
window.addEventListener("storage", (e) => { if (e.key === KEY) { S = load(); renderAll(); } });

/* ================= Khởi động ================= */
$("#frDate").value = today();
renderThemeBtn();
const [h0, h1] = location.hash.slice(1).split("/");
show(h0 || "home", h1, false);
// Lối tắt từ icon app (manifest shortcuts): ?add=1 mở ô ghi chi, ?nospend=1 ghi ngày không tiêu
const q = new URLSearchParams(location.search);
if (q.has("nospend")) { S.checkins[today()] = Date.now(); save(); toast("Đã ghi hôm nay không tiêu."); renderAll(); }
if (q.has("add")) openExp();
if (location.search) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {} }
// Việc nặng (tải Firebase, lưu bản offline) để sau khi lời chào chạy xong, cho hoạt ảnh không bị giật
function afterIntro(fn) {
  if (document.getElementById("intro") && !document.documentElement.hasAttribute("data-nointro")) addEventListener("intro:done", fn, { once: true });
  else fn();
}
afterIntro(() => {
  initSync();
  if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("sw.js").catch(() => {});
});
})();
