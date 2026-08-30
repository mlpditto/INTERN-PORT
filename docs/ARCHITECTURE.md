# INTERN-PORT — Architecture

A LINE **LIFF** learning-management app for medical/pharmacy interns (Thai, EN-toggle).
Frontend = two large hand-written HTML files with inline vanilla JS. Backend = Firebase
(Firestore + Cloud Functions + Storage). Notifications go out through **LINE**.

> Generated 2026-08-30 from the codebase + `.claude/.../memory/`. Diagrams drift —
> re-check against source before trusting a detail. GitHub renders the ```mermaid fences.

---

## 1. System context

```mermaid
flowchart TB
    subgraph client["Client (GitHub Pages · serves /public)"]
        intern["public/index.html<br/><b>Intern portal</b> (V96.x)<br/>Mission · DD Codex · Case · Product Listing · Work"]
        admin["public/admin.html<br/><b>Admin console</b> (V98.x)<br/>Dashboard/Kanban · User Hub · Quiz mgr · Assignments · Codex · Digest · AI tools"]
        lt["lang-toggle.js<br/>EN-default, wraps Thai in .lang-th"]
    end

    subgraph fb["Firebase — project intern-port-edfa7"]
        fs[("Firestore<br/>region asia-southeast3 (Bangkok)")]
        fn["Cloud Functions<br/>region us-central1 · Gen2 · nodejs22<br/>(cross-region reads; NO Eventarc)"]
        st["Storage<br/>patho-visuals/ · pk-visuals/ (SHA-256 addressed)"]
        auth["Firebase Auth<br/>Google (admin) · anonymous (intern)<br/>named app to avoid session clobber"]
    end

    subgraph line["LINE"]
        liff["LIFF 2008959998-yjcNpaGt (intern portal)<br/>LIFF 2008959998-4ty7kBq2 (exam)<br/>provider MLP-INTERN-PORT"]
        oaNoti["OA 'MLP INTERN PORT Noti' (ch 2009943963)<br/>digest + notify bot · 300 push/month free cap"]
        oaMLP["OA '@MedlifePlus' (ch 1657147730)<br/>marketing · separate provider"]
    end

    subgraph ai["AI providers (via callAIProxy)"]
        vertex["Google Vertex — Gemini"]
        aistudio["AI Studio — GEMINI_API_KEY (image gen)"]
        openai["OpenAI — gpt-5.4 / gpt-5.4-mini"]
        typhoon["Typhoon — Thai + vision (non-admin default)"]
        openrouter["OpenRouter — Case Card images"]
    end

    intern & admin --> lt
    intern -->|LIFF SDK| liff
    intern & admin -->|Firestore SDK v8 compat| fs
    intern & admin -->|Bearer idToken| fn
    admin -->|content-addressed put| st
    fn --> fs
    fn -->|push / reply| oaNoti
    fn --> st
    fn --> vertex & openai & typhoon & openrouter
    admin --> aistudio
    intern & admin --> auth

    gh["GitHub mlpditto/INTERN-PORT<br/>trunk = production"] -->|".github/workflows/deploy.yml on push"| client
    dev["firebase CLI (manual)"] -->|"rules · indexes · functions · storage"| fb
```

**Deploy split — remember this:**

| What | How | Trigger |
|---|---|---|
| `public/` (the two HTML files + assets) | GitHub Pages via `deploy.yml` | push to `production` (~20s) |
| Firestore **rules / indexes** | `firebase deploy --only firestore:rules,firestore:indexes` | **manual, after merge** |
| Cloud **Functions** | `FUNCTIONS_DISCOVERY_TIMEOUT=120 firebase deploy --only functions:…` | **manual** (run from the non-OneDrive clone) |
| **Storage** rules | `firebase deploy --only storage` | **manual** |

The version badge in each page auto-derives from `<title>` (`Nika V98.xx` / `Internship Portfolio (V96.xx)`). Bump it on every `public/` change; serial PRs collide on that line.

---

## 2. Firestore collections (by domain)

```mermaid
flowchart LR
    subgraph identity["Identity"]
        users[("users<br/>score · beri · group · profile<br/>startDate/endDate")]
        prereg[("pre_users")]
        authlink[("user_auth_links<br/>authUid ↔ effectiveUserId")]
    end

    subgraph quiz["Quiz"]
        quizzes[("quizzes<br/>questions · deadline · totalPoints<br/>earlyBirdBeriFirst · deadlineBeriMax<br/>materials · translations")]
        attempts[("quiz_attempts<br/>id = quizId_userId<br/>status started→pending→approved")]
        qfeedback[("quiz_feedback")]
        qdisc[("quiz_discussions/{id}/comments")]
        polls[("poll_responses")]
        exam[("exam_sessions")]
    end

    subgraph work["Work / Quest / Case / Product"]
        works[("works")]
        quests[("quests · quest_submissions")]
        sidequests[("side_quests<br/>Kanban cards")]
        cases[("cases  (Alabasta)")]
        products[("product_listings  (LINE MAN)")]
        submissions[("submissions<br/>unified feed mirror")]
    end

    subgraph score["Score ledger (score-denominated)"]
        checkin[("checkin_logs<br/>quiz · work · manual_adjust<br/>daily_checkin · daily_decay")]
        reflog[("reflective_logs")]
        lpentries[("learning_path_entries · learning_paths")]
    end

    subgraph beri["Beri currency (separate from score)"]
        ledger[("beri_ledger  ← unified (B1)<br/>id = source__refId<br/>explore_link · review_approved<br/>manual_adjust · shop_redeem/refund<br/>quiz_early_bird · quiz_deadline_buffer")]
        beriadj[("beri_adjustments  (manual audit)")]
        beridaily[("beri_daily  (per-day cap counter)")]
        berirewards[("beri_rewards · beri_redemptions<br/>'A Shop for Killers'")]
    end

    subgraph explore["Gourmet World (Explore links)"]
        rlinks[("review_links")]
        rclicks[("review_link_clicks  (+Beri, 1×/link)")]
        rreviews[("review_link_reviews  (approved → +1 Beri)")]
        rsugg[("review_link_suggestions")]
    end

    subgraph codex["Codex"]
        drug[("drug_codex · drug_codex_drafts")]
        disease[("disease_codex · disease_codex_drafts")]
    end

    subgraph config["Config / ops"]
        taxonomy[("taxonomy/*  · divisions-config · group-settings")]
        lineusage[("line_usage/{YYYY-MM}  push quota")]
        aiusage[("ai_usage/{YYYY-MM-DD}")]
        digestruns[("digest_runs  · admin_notifications")]
    end
```

**Two ledgers, deliberately separate.** `checkin_logs` is score-denominated (feeds
leaderboards, cert, `recalculateUserScore`). `beri_ledger` + `beri_adjustments` are
Beri and are kept **out** of `checkin_logs` so a Beri delta can never corrupt a score total.

---

## 3. Quiz lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor I as Intern (index.html)
    participant FS as Firestore
    actor A as Admin (admin.html)
    participant FN as Cloud Functions
    participant L as LINE (Noti OA)

    I->>FS: start quiz → quiz_attempts/{quizId_userId} status:'started'
    I->>FS: submit → status:'pending' + correctCount + timestamp
    opt quiz.notifyGroup
        FS-->>FN: (client calls) notifyQuizSubmitted
        FN->>L: push submit notice + score (group)
    end
    A->>FS: reviewQuiz → approveQuizAttempt / …Actual / approveQuiz
    Note over A,FS: batch = status:'approved' + users.score += pts<br/>+ checkin_logs {type:'quiz'}
    A->>FN: awardQuizSpeedBeri(quizId, userId)  (best-effort, post-commit)
    FN->>FS: rank by submit time → beri_ledger quiz_early_bird / quiz_deadline_buffer<br/>+ users.beri increment  (deterministic id → re-approve safe)
    Note over I: 16:00 cron digest later reports "done today"
```

`applyCheckinDecay` (daily cron) writes `checkin_logs {type:'daily_decay'}` + decrements
`users.score` for interns who didn't check in — the "No check-in on <date>" rows.

---

## 4. Beri flow

```mermaid
flowchart TB
    subgraph writes["users.beri write sites → each also writes a beri_ledger row"]
        a["index.html explOpenLink<br/>(open a Gourmet World link)"] -->|+reward| L
        b["index.html redeemBeriReward<br/>(shop)"] -->|-cost| L
        c["admin.html approveExploreReview"] -->|+1| L
        d["admin.html denyBeriRedemption<br/>(refund)"] -->|+cost| L
        e["admin.html adjBeriCore<br/>(manual / Give Beri)"] -->|±| L
        f["admin.html awardQuizSpeedBeri<br/>(early-bird + beat-deadline)"] -->|+n| L
    end
    L[("beri_ledger<br/>id = source__refId (idempotent)")]
    L --> bal[("users.beri  (running balance)")]
    L --> hist["Hub drill-down → History tab<br/>🪙 Beri filter (B3) — never counted in score"]

    B2["one-time backfill<br/>scratchpad/beri-ledger-backfill.js<br/>reads beri_adjustments + review_link_clicks<br/>+ review_link_reviews approved + beri_redemptions"] -. same id scheme .-> L
```

---

## 5. LINE digest / notify

```mermaid
flowchart TB
    cron["notifyQuizDigest<br/>schedule 16:00 Asia/Bangkok"] --> run
    manualP["admin: Preview digest → previewQuizDigest"] --> run
    manualS["admin: Send this now → sendQuizDigestNow"] --> run
    run["runQuizDigest(kind)"]
    run -->|read| src[("users · quiz_attempts · works<br/>product_listings")]
    run --> targets["resolveLineTargets('notifyQuizDigest')<br/>.filter(!withScores)  → intern GROUP only"]
    targets -->|Flex push| grp["LINE intern group (Noti OA)"]
    grp --> rec["recordLinePush → line_usage/{YYYY-MM}<br/>(counts SUCCESSFUL pushes; 300/mo cap)"]
    run --> copy["admin: 'Copy text' → digestTargetsToText()<br/>flatten Flex → clipboard → paste manually = 0 pushes"]

    other["notifyQuizSubmitted · notifyQuizReminder<br/>notifyAdminOnNewCase · notifyAdminOnNewProduct<br/>notifyOnReviewMessage · notifyOnAdminEdit"] -->|push| grp
```

Other LINE cost cuts already in place: digest is group-only (V98.09), `notifyQuizGraded`
removed, empty-day digests skipped (`nothing-to-report`), digest bubble day-grained.

---

## 6. AI proxy

```mermaid
flowchart LR
    caller["admin.html / index.html<br/>callUniversalAI / qtTranslateText / AI panels"]
    caller -->|"POST + Bearer Firebase idToken"| proxy["callAIProxy (onRequest, us-central1)<br/>secrets: OPENAI/OPENROUTER/GEMINI/TYPHOON/… keys<br/>timeout 300s"]
    proxy -->|admin| any["any provider"]
    proxy -->|non-admin| typh["Typhoon only"]
    any --> vertex["Vertex — Gemini"]
    any --> openai["OpenAI — gpt-5.4 / -mini"]
    any --> or["OpenRouter"]
    any --> typh
    proxy --> rec["recordAiUsage → ai_usage/{YYYY-MM-DD}"]

    imgcaller["Case Card / PK Visual / Patho Visual"] -->|provider:'gemini-aistudio'| aistudio["AI Studio Generative Language API<br/>GEMINI_API_KEY"]
    aistudio --> storage["Storage patho-visuals/ · pk-visuals/<br/>SHA-256 path — probe getDownloadURL first"]

    ndi["admin: 'ค้น อย.' → ndiBrandLookup (onRequest)"] --> proxy
```

Timeout chain: order the clocks **240 < 280 < 300** and never retry your own abort.
Vertex lags AI Studio for new Gemini models; `callAIProxy` uses Vertex, the admin.html
SDK path uses AI Studio.

---

## 7. Working copies & known traps

- **Two clones on the dev machine.** Edit `D:\20_Code\INTERN-PORT` (real `.git`, outside OneDrive). `D:\20250728OD\OneDrive\…\INTERN-PORT` is a stale mirror — never edit it (catch it by the `<title>` version).
- **OneDrive vs `.git`** — dehydration → `fatal: mmap failed`; hostname-suffixed `.git/` artifacts; stale refs faking a dirty tree. `.git` is relocated to `D:\git-repos\INTERN-PORT.git`.
- **`git checkout` inside `| tail` in an `&&` chain** hides a failure (pipe exit code is `tail`'s). Run branch switches bare.
- **`lang-toggle.js` hides Thai by default** — pure-Thai text needs `lang-no-toggle` or it vanishes under the EN body (recurred ~7×).
- **Global `button { width:100%; min-height:48px }`** (index.html:341) — any compact/icon button needs `width:auto; min-height:0` or it stretches full-width.
- **`admin.html` module vs classic scope** — a `<script type="module">` helper is invisible to classic `<script>`; `const` at classic top level is visible by bare name but not on `window`.
- Firestore is in Bangkok → **no Eventarc / no `onDocument*` triggers**; everything is HTTP/callable + `onSchedule` with caller-side invocation.
