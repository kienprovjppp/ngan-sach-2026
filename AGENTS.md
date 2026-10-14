# AGENTS.md — Giữ Lửa Ví Tiền

Personal budget PWA in Vietnamese, plain HTML/CSS/JS, no build step, no dependencies. Hosted on GitHub Pages from `main` (push = deploy). The owner is non-technical: reply in Vietnamese, keep changes small, explain what changed in plain words.

## Files

| File | What it holds |
|---|---|
| `index.html` | All markup and all CSS (design tokens on `:root`, dark theme under `prefers-color-scheme` and `[data-theme="dark"]`). Layout: left sidebar ≥900px, bottom tab bar on phones. |
| `app.js` | All app logic in one IIFE: state + localStorage, Firebase sync (`mergeStates`), budget periods ("kỳ"), rendering per tab, events. |
| `data.js` | Fixed content only: default categories, `STICKERS` (side images per tab), menu, shopping lists, free-food sources. Edit content here, not in app.js. |
| `intro.js` | Welcome animation. Every style is computed from time in `seek(t)`; geometry is measured once in `measure()`. Fires `intro:done`; app.js waits for it before loading Firebase and the service worker. |
| `sw.js` | Service worker, stale-while-revalidate. After a deploy the first load shows the old version, the second shows the new one. Bump `CACHE` only to purge old caches. |
| `img/` | Images used by `STICKERS`. |
| `firestore.rules` | Firestore security rules (pasted into the Firebase console by hand). |
| `tests/merge.test.cjs` | Sync-merge checks. Run `node tests/merge.test.cjs` after touching `normalize`/`mergeStates` or the state shape. |

## Rules

- Tabs and sub-tabs are defined in `SUBS` in app.js; sections in index.html use `id="v-<tab>"` and `data-sub="<sub>"`.
- State lives in `S`; always call `save()` after mutating it, then `renderAll()`. Settings-type changes (categories, periods, cap) also call `touchSettings()` so they win when syncing.
- Never rename or remove existing state fields: other devices sync old data. Add migrations in `normalize()`.
- Category colors are palette slots `c0`–`c8` (CSS vars), never raw hex.
- Inputs must stay ≥16px font (iPhone zoom). Keep touch targets ≥40px.
- Before finishing: run `node --check <file>` on each of app.js, data.js, intro.js, sw.js (one file per command), then `node tests/merge.test.cjs`. Preview locally with `python -m http.server 8765`.
- Commit messages in Vietnamese, short. Only push when the owner asks.
