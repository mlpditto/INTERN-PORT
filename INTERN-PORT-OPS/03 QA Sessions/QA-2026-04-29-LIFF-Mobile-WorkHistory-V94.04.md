---
type: qa
status: draft
qa_result: pending
owner:
date: 2026-04-29
branch: production
commit: 6a2c120
version: V94.04
liff_accounts_tested: 0
updated: 2026-04-29
---

# QA-20260429-LIFF-Mobile-WorkHistory

## Scope

- **Feature/Issue:** Work History Phases 1–5 (V91.62–V91.66) + Quiz Editor Markdown (PR #21) on real LIFF mobile environment
- **Environment:** LINE in-app browser (LIFF), iPhone or Android — primary; Chrome DevTools mobile emulator — pre-flight only
- **Why this session:** All 5 work-history phases shipped Apr 28; markdown editor shipped Apr 27. Untested on real device. Browser desktop testing passed; LIFF webview engine differs from Chrome/Safari.

## Pre-Flight: Phase 2 — Browser Mobile Emulator Dry-Run

> **Run this BEFORE going to real device.** Catches layout / scroll / breakpoint issues that don't need LIFF. ~15 min.

### Setup

- [ ] `cd public && python -m http.server 8000`
- [ ] Open `http://localhost:8000/` in Chrome
- [ ] DevTools → `Ctrl+Shift+M` → device: **iPhone 14 Pro** (390×844)
- [ ] DevTools → Network → throttling: **Slow 3G** (catches loading-state bugs)
- [ ] Hard refresh: `Ctrl+Shift+R`

### Visual checks (no LIFF auth, expect skeleton/empty states)

- [ ] No horizontal scroll at 390px width
- [ ] All text readable (≥0.7em with sufficient contrast)
- [ ] No element overlap or clipped buttons
- [ ] Footer renders correctly: `V94.04 — Last feature: V91.66 (...)` (auto-sync from PR #30)
- [ ] DevTools console: no red errors on initial load

### What this CAN'T catch (must do on real device)

- LIFF auth flow + user profile load
- Real touch vs mouse — tap accuracy, double-tap zoom hijack
- LINE webview engine quirks (it's not Safari WebView)
- LocalStorage persistence in in-app browser

---

## Phase 3 — LIFF Auth Smoke Test (gate)

> **If any item fails → STOP.** Phase 4+ depends on auth. ~10 min.

### LIFF URL

```
https://liff.line.me/2008959998-yjcNpaGt
```

Send this link to yourself in LINE (Keep Memo, or 1:1 chat with your own account), then tap from the device under test.

LIFF ID source: `public/index.html:3747` (`USER_LIFF_ID = "2008959998-yjcNpaGt"`).

### Pre-requisites

- [ ] LINE app installed on device
- [ ] Logged into LINE on this device
- [ ] Stable internet (does not need to be fast — Slow 3G works for smoke)
- [ ] (optional, Android) USB debugging on, device connected to PC, Chrome `chrome://inspect/#devices` open — gives you a live remote console for the LINE webview

### Checks

- [ ] **Tap LIFF link → app opens inside LINE**
  - Pass: in-app browser opens; LINE channel/LIFF name shown at top of the webview
  - Fail signs: opens in Safari/Chrome instead → LIFF ID disabled in LINE Console; "This page isn't available" → LIFF endpoint URL doesn't match Firebase deploy

- [ ] **Loading screen does not hang > 10 sec**
  - Code: `liff.init` has a 10s timeout at `public/index.html:4163`
  - Pass: status text transitions "Initializing LIFF..." → "Checking Login Status..." → "Getting User Profile..." within 10s
  - Fail signs: stuck on "Initializing..." > 10s → LIFF SDK can't load (LINE CDN issue or network); manual-login button appears → init flow incomplete

- [ ] **`displayName` shows correctly**
  - Pass: profile card at top of home shows your real LINE name
  - Fail signs: "undefined" → `liff.getProfile()` returned wrong shape; default "ผู้ใช้งาน" → Firestore mapping ran but profile sync produced empty string

- [ ] **`pictureUrl` renders (no broken image)**
  - Pass: clear round profile picture in the profile card
  - Fail signs: broken-image icon → LINE CDN URL expired or CORS; empty gray circle → CSS issue or `pictureUrl` is null

- [ ] **No "Allow Access" loop**
  - Pass: tap "Allow" once → enter app, no further permission prompts when navigating between sections
  - Fail signs: prompt repeats every reload → permissions don't persist (LIFF endpoint URL mismatch); tap Allow bounces back to chat → callback URL wrong

- [ ] **No fatal JS error in console**
  - Verify via remote console (Android: USB debug + `chrome://inspect`)
  - iOS: native Safari Web Inspector cannot attach to LINE webview — fall back to inline `alert()` patches in a dev branch only if a bug is suspected, or rely on visible status text
  - Pass: no red errors during initial load
  - Fail signs: `LIFF Init Timeout` / `LIFF SDK not found on window` / Firestore `permission-denied`

- **Notes:**

### Troubleshooting matrix

| Symptom | Likely cause | Fix location |
|---|---|---|
| LIFF link opens in browser, not LINE | LIFF ID disabled | LINE Developers > Channel > LIFF tab |
| Stuck on "Initializing LIFF..." | SDK URL or network | retry; try a different network |
| "Allow Access" loop | Endpoint URL mismatch | LINE Console > LIFF > Endpoint URL must match the Firebase Hosting URL (`https://intern-port-edfa7.web.app/...`) |
| `displayName` "undefined" | Missing scope | LINE Console > Channel > Scopes — must include `profile` |
| Firestore `permission-denied` | Security rules block this user | Firestore > Rules — verify the rule that gates `request.auth.uid` |
| Broken profile picture | LINE CDN URL expired (rare) | refresh — `liff.getProfile()` re-runs and gets a fresh URL |

### After Phase 3

- **All 6 pass:** mark all 6 checkboxes above, fill `Notes:` with device + LINE account label, then proceed to Phase 4.
- **Any fail:** fill `Notes:` with the failing item + symptom; if it's a real bug, copy the Bug Report Template at the bottom of this file into `02 Bugs/BUG-2026-04-XX-LIFF-Auth-*.md`. **Do NOT proceed to Phase 4** — feature tests are meaningless without auth.

---

## Phase 4 — Work History Deep Test

### WH-1 (V91.62): filter fix + 5 type pills + status + pagination

- [ ] All 5 type pills render: tap each → list filters correctly
- [ ] Status filter (pending/approved/rejected) works
- [ ] Pagination: scroll to bottom → "load more" or page-N buttons appear
- [ ] Filter + pagination combine correctly (no double-counted items)

### WH-2 (V91.63): stats card + search + group by date

- [ ] Stats card renders at top of Work History
- [ ] Search input: tap → keyboard opens → type → list filters live
- [ ] Group-by-date: items group under date headers (yesterday / last week / etc.)

### WH-3 (V91.64): tap-to-expand + per-type rich detail

- [ ] Tap a card → expands smoothly (no janky animation)
- [ ] **No double-tap zoom hijack** (most common LIFF bug — `<meta viewport user-scalable=no>` or `touch-action: manipulation`)
- [ ] Each type (case/work/quiz/reflective/quest) shows its own rich detail layout

### WH-4 (V91.65): streak + recent badge + pending reminder + sparkline

- [ ] Streak number displays correctly
- [ ] "Recent" badge appears on items < 7 days old
- [ ] Pending reminder banner shows when there are pending items
- [ ] Sparkline chart renders (SVG should not be cut off on small viewport)

### WH-5 (V91.66): skeleton + accent border + empty states + ARIA

- [ ] Skeleton loader appears during initial load (1-3 sec window)
- [ ] Accent border on active filter pill is visible
- [ ] Empty state shows correct message per filter (not generic "no data")
- [ ] ARIA: with VoiceOver (iOS) or TalkBack (Android), can navigate items by tap

---

## Phase 5 — AI Magic / Quiz Editor Markdown (admin)

> **Admin-only — needs admin LIFF account.** ~15 min.

- [ ] Open Quiz Editor for an existing quiz
- [ ] Markdown input: bold (`**x**`), italic (`*x*`), list (`- x`), inline code (`` `x` ``) all render in preview pane
- [ ] Preview updates live as you type
- [ ] Mobile keyboard input works for special chars: `*`, `_`, `` ` ``, `#`
- [ ] Preview pane scrolls independently from editor on small viewport
- [ ] Save → reopen → markdown persists correctly

---

## Phase 6 — Edge Cases

- [ ] Slow 3G via DevTools (already in Phase 2; recheck on device if possible)
- [ ] **Backgrounding:** swipe LINE app away → reopen → state preserved (filters, scroll position, pagination)
- [ ] **Rotation:** portrait → landscape → portrait → no layout break
- [ ] **Deep-link from chat:** receive LIFF URL in 1:1 chat → tap → opens correctly (not browser fallback)
- [ ] **LIFF SDK init race:** hard-refresh 5x rapidly → first paint never shows broken state

---

## Bug Report Template (copy into `02 Bugs/BUG-2026-04-XX-*.md` if needed)

```markdown
---
type: bug
severity: low|medium|high|critical
date: 2026-04-XX
reporter:
device:
liff_version:
app_version: V94.04
---

## Title
<one-line summary>

## Steps to reproduce
1.
2.
3.

## Expected
<what should happen>

## Actual
<what actually happened>

## Screenshot/Video
<attach or link>

## Hypothesis
<your guess at root cause, optional>
```

---

## Mirror Rule

- [ ] Source and public files both contain the tested UI sections (post-cleanup, only `public/` exists; this is auto-true on production tip)

## Result

- **qa_result:** pending
- **Evidence:**
  - HEAD verified at `6a2c120` (production tip, includes Footer auto-sync PR #30)
  - All Work History phases (V91.62–V91.66) shipped on production
  - Footer auto-sync verified via PR #30 description
- **Blockers:**
  - Real LIFF auth + 5-phase work-history test not yet performed
  - AI Magic Quiz Editor markdown not yet tested on mobile keyboard

## Next Actions

- Run Phase 2 (browser dry-run) to catch obvious layout issues — no device needed
- When mobile available: run Phase 3 (auth smoke) → Phase 4 (work history) → Phase 5 (AI Magic) → Phase 6 (edge cases)
- For each ❌, decide: fix now / file BUG-* / accept as known-limitation
- Update `qa_result` from `pending` → `pass` when all critical sections pass
- Update [project_pending_optional.md](../../.claude/projects/.../memory/project_pending_optional.md) to close LIFF mobile test item once `qa_result: pass`
