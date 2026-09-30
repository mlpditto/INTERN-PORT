# OWNER_ACTIONS.md — what the project needs from the owner

> **One tracker** for everything only the owner (medlifeplus@gmail.com) can do: payments, decisions, tests on a real LINE account, console settings. Pattern borrowed from BKK FloodWatch ([flood2026](https://github.com/bejranonda/flood2026), MIT).
> **Check the live state any time:** `node scripts/owner-status.cjs` (read-only, never prints a secret; needs gcloud logged in). It checks the rows marked *script* for real and lists the open manual rows from §1.
> **Secrets:** never paste them in chat or commit them. Set them with `firebase functions:secrets:set NAME` and tell the agent the *name* only.
> **Updating this file:** when an item is done, change its status to ✅ with the date, and move its §2 entry to §3. Last verified **2026-09-30**.

## 1. Status now

| ID | Item | Status | Priority |
|---|---|---|---|
| **PREPAY** | AI Studio Gemini API billing: switch Postpay → Prepay before **2026-10-12** | ⬜ open — 12 d left on 2026-09-30 | 1 |
| **SMOKE-LIFF** | Try the new intern features in LINE on a phone | ⬜ open | 2 |
| **SMOKE-ADMIN** | Check the closed feedback issues in admin and the ❌ quiz | ⬜ open | 2 |
| **CLOUD** | Finish the Claude Code on the web setup at claude.ai/code | ⬜ optional | 3 |
| FN | Every exported Cloud Function is deployed and ACTIVE | ✅ *script* (25/25 on 2026-09-30) | — |
| RULES | `firestore.rules` / `storage.rules` identical to live | ✅ *script* | — |
| SITE | Live intern/admin versions match `origin/production` | ✅ *script* | — |
| LINE | LINE pushes this month vs the 300 cap | ✅ *script* (23 on 2026-09-30) | — |
| SCHED | Scheduled jobs enabled, last runs OK | ✅ *script* (5 jobs) | — |
| TTL | Firestore TTL on `learning_path_entries.deleteAt` | ✅ *script* — active (the comment above `notifyPurgeDigest` still says "until then"; it is on) | — |

## 2. Actions in priority order

### PREPAY — AI Studio billing, Postpay → Prepay (by 2026-10-12)
**Why:** Google moves the Gemini API in AI Studio to prepaid credits. After the deadline, paid calls on the `GEMINI_API_KEY` secret stop. That key serves the `gemini-aistudio` provider in `callAIProxy`, which does the image generation.
**Steps (payment — owner only):** open https://aistudio.google.com → **Billing** → switch the project to **Prepay** → buy credits → turn on **auto-reload** so it does not run dry.
**Verify:** generate one image from an admin AI tool after switching. Then mark this row ✅ with the date; the script stops warning.

### SMOKE-LIFF — new intern features, on a phone in LINE (intern V101.27 → V101.33)
None of these has been run on a real LINE account yet (all were verified with harnesses on the real code). Open the app fresh (V101.33 in the footer).

**Profile card, before tapping anything**
1. **Top rail:** one row of five circles: 👤 · EN · 🌊 · ⚙ · ↻. There is no ⋯ menu any more.
2. **Water:** behind the card, water sits at the training site's level. After step 7 it **slopes** from your home (left) to the site (right), with **🏠 / 🏥 circles on the card edges** at each side's level, ringed orange or red when that side is at risk.
3. **Sky:** the part above the water matches the site's weather: sun glow, soft clouds, rain streaks, or a night tint.

**🌊 popup**
4. Tap **🌊** → the popup opens **under the button** with the site's canal and 🛣 road stats and a **weather row** (`☁️ 32°/38° · ☂ 52% 15:00 · 😷 74`). The credit line names Open-Meteo.
5. Tap **📍** → LINE asks for location → flood + weather data appear for where you are.
6. Close it with Esc, a tap outside, or 🌊 again.
7. Tap **🏠 +** → confirm → 🔔 turns on (this writes `users.floodWatch`) → the card water starts to slope.

**Language and the check-in row**
8. Tap **EN** → it cycles EN → KR → TH → K·T; the LINE message language (`preferredLanguage`) follows.
9. **Before checking in:** an orange `🔥N` pill. Tap it → it turns green. **After sending a Log or Case:** that circle turns green.
10. Tap **…** at the end of the row → the panel has **🏆 Leaderboard** on the "✨ Next" line (and **Request Certificate** next to 🏅 once you have enough points).

**Moved items and a regression check**
11. **👤 Info → 🔗 Social** has the **Enrollment Key** row; **Match** opens the key screen above Info.
12. Do two quizzes in a row: Next and Previous should work on the second one (regression check for V94.62, see Q-TIMER in §4).

### SMOKE-ADMIN — quiz feedback issues (admin V102.48)
Both issues were **closed on 2026-09-30** at the owner's request (by Claude Code, via a guarded Firestore write):
- **🐞** "กดข้อต่อไปไม่ได้ก่อนครบเวลา", 7 reports → **Fixed in V94.62 · 15 May** (the Q-TIMER fix, §4).
- **❌** "มีข้อสอบบางข้อที่คล้ายกันเกินไป", 1 report on quiz ผู้ป่วยโรคไตเรื้อรังระยะสุดท้าย → **Today**. The quiz itself was *not* checked or edited.

Admin → Laugh Tale → **🧠 Quiz**. Check that:
- The button shows **no red count**.
- **⚑ Issues** shows `Open 0` and **✅ 2**. Under ✅ there are two green cards: "✅ Fixed in V94.62 · 15 May" and "✅ Fixed in update · 30 Sep".
- Every feedback card still has its category chip; the two issues' reports read "fixed" on hover.

Then:
- **❌ quiz:** look at ผู้ป่วยโรคไตเรื้อรังระยะสุดท้าย for the near-duplicate questions. If they are still there, press **↺** on the card to reopen the issue, fix the quiz, and close it again with **Today**.
- **"Fixed in V…" flow:** it has not been clicked in a real browser yet. Try it on the next new issue, or reopen one with ↺ and close it again; the version chips come live from GitHub.

### CLOUD — Claude Code on the web (optional)
At claude.ai/code:
1. Install the Claude GitHub App on `INTERN-PORT` **and** `INTERN-PORT-claude-memory`, then attach the memory repo to sessions.
2. Environment → Network access → **Custom**, adding `cdn.playwright.dev`, `playwright.download.prss.microsoft.com` and `playwright.azureedge.net`.
3. Environment → Setup script = the contents of `scripts/cloud-setup.sh`.

First test: a cloud task that runs `bash scripts/run-qa.sh`.

## 3. Standing rules (no action unless the script says so)
- **Deploys after a merge.** GitHub Pages deploys only `public/`. After merging a PR that touches `functions/` or `*.rules`, deploy what the PR names:
  - Functions: `FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase deploy --only functions:<name>` from a clean `production` checkout, after `npm --prefix functions ci`.
  - Rules: `firebase deploy --only firestore:rules`.
  - The script turns 🔴 on any function or rules drift.
- **LINE quota.** The Noti OA has 300 pushes a month, shared by every notification. Only the daily digest, per-intern quiz scores and flood alerts (on a rise to High, max 1/place/day) push. The `line_usage` counter undercounts, so trust the 429s in the function logs.

## 4. Done
| ID | Item | When |
|---|---|---|
| FLOOD | Flood watch live: intern V101.27–V101.33 — `floodPointCheck` + `checkFloodAlerts`, Floodboard roads, popup under 🌊, sloped home→site water, Open-Meteo sky + weather row + PM2.5 | 2026-09-30 |
| TRIAGE | Quiz feedback triage live: admin V102.47, `triageQuizFeedback`, 62/62 labelled | 2026-09-30 |
| Q-TIMER | "Next/Previous locked until the question timer ends" — the 7 🐞 reports (2026-04-21 → 05-12) are the Quiz #2 bug **already fixed in V94.62 on 2026-05-15**: submit left the shared nav buttons `disabled`, and every quiz start now resets them too. No report since. No code change; the triage labels were right about the past, not the present | 2026-09-30 |
