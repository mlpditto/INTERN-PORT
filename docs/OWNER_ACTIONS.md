# OWNER_ACTIONS.md — what the project needs from the owner

> **One tracker** for everything only the owner (medlifeplus@gmail.com) can do: payments, decisions, tests on a real LINE account, console settings. Pattern borrowed from BKK FloodWatch ([flood2026](https://github.com/bejranonda/flood2026), MIT).
> **Check the live state any time:** `node scripts/owner-status.cjs` (read-only, never prints a secret; needs gcloud logged in). It checks the rows marked *script* for real and lists the open manual rows from §1.
> **Secrets:** never paste them in chat or commit them. Set them with `firebase functions:secrets:set NAME` and tell the agent the *name* only.
> **Updating this file:** when an item is done, change its status to ✅ with the date, and move its §2 entry to §3. Last verified **2026-09-30**.

## 1. Status now

| ID | Item | Status | Priority |
|---|---|---|---|
| **PREPAY** | AI Studio Gemini API billing: switch Postpay → Prepay before **2026-10-12** | ⬜ open — 12 d left on 2026-09-30 | 1 |
| **Q-TIMER** | Decide: should a quiz lock Next/Previous until each question's timer ends? | 🖐️ decision (7 intern reports) | 1 |
| **SMOKE-LIFF** | Try the new intern features in LINE on a phone | ⬜ open | 2 |
| **SMOKE-ADMIN** | Look at quiz feedback triage in admin | ⬜ open | 2 |
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

### Q-TIMER — Next/Previous locked until the question timer ends
**Why:** the AI feedback triage (admin V102.47) labelled **7 comments from different interns** as 🐞 bug. All seven describe one problem: Next and Previous do nothing until the per-question timer (~60 s) runs out, mostly from the **second quiz in a row** (a refresh fixes it).
**Decision needed:** is a minimum time per question **intended** for some quiz types?
- **Intended:** say so, and we show the countdown on the button instead.
- **Not intended:** it is a bug; the task "Fix quiz Next/Previous locked until timer ends" is ready to start.

### SMOKE-LIFF — new intern features, on a phone in LINE
None of these has been run on a real LINE account yet (all were verified with harnesses on the real code).
1. Tap **🌊** in the profile rail → the popup opens **under the button**, showing the training site's canal and 🛣 road stats.
2. Tap **📍** → LINE asks for location → data appears for where you are.
3. Tap **🏠 +** → confirm → 🔔 turns on (this writes `users.floodWatch`).
4. Tap the **EN** button → it cycles EN → KR → TH → K·T; the LINE message language (`preferredLanguage`) follows.
5. The check-in row under the card:
   - **Before checking in:** an orange `🔥N` pill. Tap it → it turns green.
   - **After sending a Log or Case:** that circle turns green.
6. Do two quizzes in a row and note whether Next works on the second one (see Q-TIMER).

### SMOKE-ADMIN — quiz feedback triage
Admin → Laugh Tale → **🧠 Quiz**. Check that:
- The button shows a red **7**, and a **🐞❌ 7** filter appears.
- Every card has a category chip.
- **✓** on one of them lowers every count by one.

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
| FLOOD | Flood watch live: intern V101.27–V101.30, `floodPointCheck` + `checkFloodAlerts`, Floodboard roads | 2026-09-30 |
| TRIAGE | Quiz feedback triage live: admin V102.47, `triageQuizFeedback`, 62/62 labelled | 2026-09-30 |
