// Kiểm tra phần gộp dữ liệu giữa các máy. Chạy: node tests/merge.test.cjs
const fs = require("fs"), vm = require("vm"), path = require("path").join(__dirname, "..");
const app = fs.readFileSync(path + "/app.js", "utf8"), data = fs.readFileSync(path + "/data.js", "utf8");
const head = app.slice(app.indexOf("const $ ="), app.indexOf("function loadScript"));
const ctx = { console, Object, Math, JSON, Date, Map, Set, String, Array, Number, navigator: {} };
vm.createContext(ctx);
vm.runInContext(data + "\n" + head.replace(/function schedulePush[\s\S]*?\n}/, "") + "\nfunction schedulePush(){}\nthis.T = { mergeStates, normalize, freshState, canon };", ctx);
const { mergeStates, normalize, canon } = ctx.T, assert = require("assert");
// 1. dữ liệu bản cũ chuyển sang kỳ, giữ ngân sách đã sửa
const old = { v: 1, total: 1200, cap: 10, cats: [{ id: "eatout", name: "Ăn ngoài", budget: 95, kind: "flex" }], expenses: [], settingsAt: 3 };
const n = normalize(old);
assert.equal(n.periods[0].amount, 1200); assert.equal(n.periods[0].budgets.eatout, 95); assert.equal(n.cats[0].color, "c2"); assert.equal(n.total, undefined);
// 2. sửa trên máy B thắng bản cũ trên máy A, bất kể ai gộp
const A = normalize({ v: 1, expenses: [{ id: "x", date: "2026-10-20", amount: 10, cat: "eatout", t: 100 }] });
const B = normalize({ v: 1, expenses: [{ id: "x", date: "2026-10-20", amount: 25, cat: "eatout", t: 100, u: 200 }] });
assert.equal(mergeStates(A, B).expenses[0].amount, 25); assert.equal(mergeStates(B, A).expenses[0].amount, 25);
// 3. xóa sau lần sửa thì mất; sửa sau khi xóa (khôi phục từ file) thì quay lại
const D = normalize({ v: 1, expenses: [], deleted: { x: 300 } });
assert.equal(mergeStates(B, D).expenses.length, 0);
const R = normalize({ v: 1, expenses: [{ id: "x", date: "2026-10-20", amount: 30, cat: "eatout", t: 100, u: 400 }] });
assert.equal(mergeStates(D, R).expenses[0].amount, 30);
// 4. kỳ mới (cài đặt mới hơn) thắng; gộp hai lần cho cùng kết quả
const P = normalize({ ...B, settingsAt: 500, periods: [...B.periods, { id: "p2", name: "K2", start: "2027-01-01", end: "2027-06-30", amount: 3000, carry: true, budgets: {} }] });
assert.equal(mergeStates(B, P).periods.length, 2);
assert.equal(canon(mergeStates(B, P)), canon(mergeStates(mergeStates(B, P), P)));
// 5. đổi món: bản sau cùng thắng
const M1 = normalize({ v: 1, meals: { "2026-10-20": { i: 3, t: 10 } } }), M2 = normalize({ v: 1, meals: { "2026-10-20": { i: -1, t: 20 } } });
assert.equal(mergeStates(M1, M2).meals["2026-10-20"].i, -1); assert.equal(mergeStates(M2, M1).meals["2026-10-20"].i, -1);
console.log("merge checks OK");
