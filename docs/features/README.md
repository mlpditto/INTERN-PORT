# INTERN-PORT feature map

Behaviour-level inventory of the two pages (`public/index.html` intern, `public/admin.html` admin) and the Cloud Functions, as the QA harness sees them. Agents use it to find which scripts cover a change and what evidence counts; humans use it as the regression checklist. One file per area; every `scripts/*-qa.cjs` and `*-check.cjs` is named in exactly one file.

## Harness conventions

- **Run one script:** `node scripts/<name>.cjs` from the repo root. Playwright scripts need `PLAYWRIGHT_MODULE` pointing at an installed `playwright` package (on HP: `%LOCALAPPDATA%\Temp\pwnode\node_modules\playwright`). Always `TZ=Asia/Bangkok`; CI (`.github/workflows/qa.yml`) runs every script with it pinned.
- **Four harness shapes.** (A) admin `file://public/admin.html` in Chromium with `window.firebase` as a self-returning Proxy, `window.db` / `window.auth` fakes and `callUniversalAI` stubbed, network blocked; (B) intern `file://public/index.html` on a 390×844 touch phone with the `__fake` facade, `userId='U1'`, `window.myUserDoc`; (C) "no browser": the REAL function sliced out of a page by marker strings and run in `vm`; (D) `functions/` code in `vm` with `post` / Firestore / mail stubbed. Nothing leaves the page in any of them.
- **Proof bar.** A script passes only when the real markup / function ran the user path and the observable result was read back (DOM, computed CSS, captured writes, prompt text). "It opens" is not a pass; a hidden container measuring 0 px is not a pass.
- **Known local-only failures** (pass on CI): `empty-quiz-sweep-qa` on a CRLF checkout; `quiz-chips-fit-qa`, `quiz-filters-lean-qa` load flakes; `users-rows-lean-qa` between 00:00 and 07:00 Bangkok. Anything else that fails locally: re-run it on a detached `origin/production` worktree before blaming the change.
- **Drift is fixed in the same PR** as the UI change: when a script is added, renamed or moved, update its line here.

## Full sweep

Walk the areas top to bottom for a broad regression: intern surfaces first, then shared content, then admin boards, then the quiz pipeline, then the AI layer.

- [app-shell](app-shell.md): What both pages do before any feature: script syntax, version banner, toasts, modal stacking.
- [auth-registration](auth-registration.md): LIFF sign-in, enrollment code, Request Access, pre-register, and the admin end of those requests.
- [intern-profile](intern-profile.md): The profile header, Info modal with ⚙ Settings, Personal Info persona cards, Know thyself, avatar.
- [schedule](schedule.md): The intern Schedule page (week strip, month card, agenda buckets, check-in pill, FIN), goals, holidays on both sides.
- [quiz-runner](quiz-runner.md): Quiz cards on the home Mission list, the start card, Read first page, the runner, term highlight.
- [quiz-feedback](quiz-feedback.md): The "How was this quiz?" sheet, its AI next-topic chips, the reminder popup, and the admin feedback panel with bonus / repair.
- [history](history.md): The home History accordion: header totals, rows, bucket labels by language, reflective detail, rail cards, delete menu.
- [journal-reflective](journal-reflective.md): The one-page Journal, admin Reflective Review (model rows, writing analysis, diff preview, bonus, tip), note review.
- [codex-intern](codex-intern.md): The intern DD Codex home, My Path queue, the lean Drug / Disease entry pages, and the Drug / Disease submit forms with Fill-from-image.
- [articles](articles.md): Admin 📰 Articles list / editor with AI draft, translate, Codex drafts and links; the intern daily article sheet; 📰 blocks on Codex entries.
- [cases-submit](cases-submit.md): The intern ＋ launcher (Submit New), case / product / event forms, My Cases rows, and the admin e-mail on a new case.
- [explore-shops](explore-shops.md): Explore tiles, the Open tooltip, the review sheet, and the admin Explore Links cards with logo / category tools.
- [beri-shop](beri-shop.md): The intern Beri shop and the admin Beri Reward / "A Shop for Killers" panels.
- [flood-watch](flood-watch.md): Open-Meteo / canal-gauge flood alerts: the intern popup, the profile river strip, the 10 km summary, district tables and tiers in functions.
- [content-creator](content-creator.md): The social-content division: intern post form, admin content board, separate CAFE points.
- [guides](guides.md): Markdown guides served through guide.js with chip rails, feedback boxes and built PDFs.
- [translations](translations.md): EN / TH / KO toggle, Translate Missing, stale quiz translations, the Korean gap ratchet.
- [badges](badges.md): Earned badges, the exported badge board PNG with labels / quote / options, and count parity with the intern app.
- [internship-hours](internship-hours.md): Hours from the MLP time clock: pairing, sync writes, the User Hub bar, the intern Period card goal.
- [user-hub](user-hub.md): The admin per-user modal: header, profile cards, group picker, History timeline, manual adjustments, log work, birthday, LIFF preview.
- [user-hub-documents](user-hub-documents.md): The 📎 Documents sheet with two-model AI review and history, 📄 Import CV, certificate files.
- [elite-board-users](elite-board-users.md): The admin Users / Elite Board list: toolbar, division rail, lean rows with Q·J·C chips, last seen, hidden (Camp) users.
- [divisions-groups](divisions-groups.md): The Divisions & Groups window, division colours / links / Look, memberships on both sides, the division field rule.
- [admin-dashboard](admin-dashboard.md): The Dashboard home: Review Kanban, Archive modal, LINE quota chip, the Delete requests queue.
- [quiz-engine](quiz-engine.md): The Assignments ▸ Quiz Engine page: rows, pills, pager, filters, coverage, the blank-quiz sweep.
- [quiz-editor](quiz-editor.md): The admin quiz editor: header pill, toolbar, Bulk Paste, resource rows, materials modal, covers and the Read first AI draft.
- [quiz-generation](quiz-generation.md): Everything that makes questions with AI: Curate (evidence check, history, copy), Expand quiz styles / regions, the Suggested popup, custom links, batch quota.
- [quiz-quality](quiz-quality.md): The review toolbar: Quality Audit scorecard, Rewrites, Clinical angle, the Comparison modal with Model B and Jev, duplicate cleanup.
- [quiz-review-attempts](quiz-review-attempts.md): Admin review of a quiz attempt, pending-table recounts, practice attempts, re-scoring multi-answer choices, the Participants table.
- [quiz-insight](quiz-insight.md): Learning performance rows per cluster and the tag drill-down (wrong questions) inside the User Hub.
- [quiz-tags](quiz-tags.md): The tag normaliser, hygiene panel, tagList mirror, legacy markers, and the AI Learning Path strip with tag promotion.
- [codex-admin](codex-admin.md): The admin Codex forms (lean heads, emoji-first drug form), published list, Incomplete view, AI auto-draft, batch draft, files, seeds, paediatric dosing.
- [alabasta](alabasta.md): The admin case / product review inbox: lean panes, status rail, reject chips, bulk delete, product photo tools.
- [grand-line-deck](grand-line-deck.md): The admin design / video hub: composer, deck workflow stepper, styles, image engines, clips with captions, the deck guide, Log Pose knowledge search.
- [ai-models](ai-models.md): functions/index.js + modern-ai.js routing (Gemini, Haiku, Typhoon, Grok, Ollama), the registry-driven rails on every page, AI settings and usage.
