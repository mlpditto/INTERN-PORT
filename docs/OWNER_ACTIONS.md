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
| **SMOKE-ADMIN** | Try admin V102.46 → V102.48 (language button, feedback labels, issues) and check the ❌ quiz | ⬜ open | 2 |
| **HOURS** | Internship hours from the time clock (admin V102.49): grant read access, deploy 2 functions, set goals | ⬜ open | 2 |
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

### SMOKE-LIFF — new intern features, on a phone in LINE (intern V101.27 → V101.34)
None of these has been run on a real LINE account yet (all were verified with harnesses on the real code). Open the app fresh (V101.34 in the footer).

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
11. **👤 Info** has a **🔑 Match** chip next to the title; it opens the Enrollment Key screen above Info (× returns to Info).
12. Do two quizzes in a row: Next and Previous should work on the second one (regression check for V94.62, see Q-TIMER in §4).

### SMOKE-ADMIN — admin V102.46 → V102.48, signed in as the owner
None of this has been clicked in a real admin session yet (all verified with harnesses on the real code). Open admin fresh (V102.48 in the tab title).

**V102.46 · one language button**
1. The header has **one** language button, not KR + TH. Tapping it cycles **EN → KR → TH → K·T → EN**, and the labels switch with it.

**V102.47 · feedback labels** (the hourly `triageQuizFeedback` labels every quiz comment)
2. **Laugh Tale → 🧠 Quiz:** every feedback card has a small category chip (🐞 bug · ❌ question · 🧗 hard · 💡 request · 👍 praise · · noise); hover shows its name.
3. **Quiz Engine:** open a quiz's ⭐ rating badge → the per-quiz feedback panel shows the same chip on each card. The **🐞❌ Fix** filter chip appears only when that quiz has an open fresh issue (none today).

**V102.48 · issues** (reports about one problem grouped; closed once)
Both issues were **closed on 2026-09-30** at the owner's request (by Claude Code, via a guarded Firestore write):
- **🐞** "กดข้อต่อไปไม่ได้ก่อนครบเวลา", 7 reports → **Fixed in V94.62 · 15 May** (the Q-TIMER fix, §4).
- **❌** "มีข้อสอบบางข้อที่คล้ายกันเกินไป", 1 report on quiz ผู้ป่วยโรคไตเรื้อรังระยะสุดท้าย → **Today**. The quiz itself was *not* checked or edited.

4. **🧠 Quiz** shows **no red count**; quiz-row rating badges show `⭐ x (n)` with no 🐞.
5. **⚑ Issues** shows `Open 0` and **✅ 2**: two green cards, "✅ Fixed in V94.62 · 15 May" and "✅ Fixed in update · 30 Sep". Tapping a card lists its reports.
6. **❌ quiz:** look at ผู้ป่วยโรคไตเรื้อรังระยะสุดท้าย for the near-duplicate questions. If they are still there, press **↺** on the card to reopen the issue, fix the quiz, and close it again with **Today**.
7. **"Fixed in V…" flow** (never clicked live): reopen one issue with **↺**, then press **Fixed in V…**.
   - The version chips load from GitHub, and the suggested one has a green ring.
   - The preview says "Closes N/N".
   - **Close issue** moves it back under ✅.
   - **⏸** marks an issue "Not a problem".
8. **Later, on its own:** the next 🐞/❌ comment is grouped within the hour. The red count comes back only for issues with a report in the last 60 days, and for fixed issues that get a new report (🔁 Back again).

### HOURS — internship hours from the time clock (admin V102.49)
**What it does:** every night at 00:15 (and right after an admin saves a goal) `syncInternHours` reads clock-in/out from the time clock's Firebase project `in-out-dashboard` and writes each intern's total to `users.internHours`. Only interns with a goal (`internHoursTarget` > 0) are read. Hours = real time from clock-in to clock-out, paired per day exactly like the time dashboard; only days inside the intern's period count.
**Why a name, not a LINE id:** the two LINE channels (`2008951813` time clock, `2008959998` INTERN-PORT) sit under different LINE providers, so the same person has different LINE ids. The link is the name: the one typed in ⏱, or `fullName` when it already matches the time clock's name.
**Steps (owner only, once):**
1. Give this project's functions read access to the time clock — Google Cloud console, project **in-out-dashboard** → IAM → **Grant access** → principal `367076866368-compute@developer.gserviceaccount.com` → role **Cloud Datastore Viewer** (read only). Or: `gcloud projects add-iam-policy-binding in-out-dashboard --member=serviceAccount:367076866368-compute@developer.gserviceaccount.com --role=roles/datastore.viewer`
2. `firebase deploy --only functions:syncInternHours,functions:syncInternHoursNow`
3. Admin → User Hub → ⋯ on an intern → **⏱ Internship hours…** → type the goal (e.g. 280), then check the name matches the time clock. A toast shows the hours found.
**Verify:** Bua's bar shows about the same total as the time dashboard's "ปีนี้" figure for her period. ⚠ on the bar = name not found or shared by two people; tap it to fix the name.

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
