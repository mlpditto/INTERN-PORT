# Grand Line Clips — short vertical teaching clips from the Miss Goldenweek pane

Plan only (2026-10-18). Nothing in this document is built. Baseline: `origin/production` 580c00a = admin V102.286.

Inspiration: a Thai article by a CNC instructor who made 10 vertical 9:16 teaching clips in ~2 hours — a text model plans 10 episodes, converts them to video prompts, a video API renders EP01–EP10, CapCut adds overlays, the text model writes 10 captions, an agent uploads them. **In scope here:** plan → prompts → clip → gallery → captions export, the owner reviewing every clip. **Out of scope:** posting to Facebook / YouTube / TikTok from the app, CapCut-style editing, intern-facing pages.

---

## 1. What the pane does today (read from the code)

| Piece | Where | Behaviour |
|---|---|---|
| Deck header + 3 modes | `public/admin.html` L8474–8491, `switchHubMode` L9230 | Miss Goldenweek / Research Log / Laboon; design mode auto-loads the Codex Gallery |
| Visual Style Collection | L8537–8566, `selectDesignStyle` L20601 | 6 cards → hidden `#selected-design-style` |
| Prompt + Enhancer rail | `#design-prompt` L8612, rail L8618–8625 → hidden `#ai-model-design-enhancer` | Enhancer = a text model (`window.TEXT_AI_MODELS`) |
| Engine rail | L8627–8634 → hidden `#design-engine`, `selectDesignEngine` L20617 | 2 chips: `as/gemini-3.1-flash-image` (Nano Banana 2, default) · `or/openai/gpt-5.4-image-2`; preference in localStorage; Bulk Paste illustrations read the same input (L30713) |
| Create Masterpiece | `generateAIDesign` L20692–20775 | step 1 Enhancer rewrites Thai → English (`feature:'design_enhance'`); step 2 modal `#aiDesignPromptModal` (L5287) lets the owner edit; step 3 `callUniversalAI(engine, prompt, …, {feature:'design_image'})` → `<img id="generated-image">` |
| After an image | `#design-actions` L8653–8661 | Download · Copy Base64 only — **a Goldenweek image is not saved anywhere** |
| Codex Gallery | L8676–8690, `mgwLoadCodexGallery` L49140 | read-only view of `disease_codex.pathoVisual.downloadUrl` + `drug_codex.pkVisual.downloadUrl` (saved by the PK / patho modals into Storage `pk-visuals/` · `patho-visuals/`, rules `storage.rules` L34–45 admin-only) |

Proxy path (`functions/index.js`): `callAIProxy` L812 (onRequest, 540 s, secrets ANTHROPIC / OPENAI / OPENROUTER / **GEMINI** / TYPHOON / THAILLM / JEV; Firebase ID token; non-admin → Typhoon only). Client routing in `callUniversalAI` L17152: `as/` → provider `gemini-aistudio`, `or/` → `openrouter`; image models are proxy-only. AI Studio image branch L1186–1256 calls `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `responseModalities:["IMAGE","TEXT"]` and returns `{imageDataUrl, text, tokens, model}`. Every success is counted by `recordAiUsage` L451 → `ai_usage/{day}`; the client wrapper at L17806 records latency per model + feature.

**There is no video code anywhere in the repo** (grep `veo|video` over functions/, admin.html, the model registry: zero hits).

## 2. Video generation the current providers can offer (checked 2026-10-18 against vendor docs)

| Option | Key already on the proxy? | Call shape | 9:16 | Length | Price (with audio) | Risk |
|---|---|---|---|---|---|---|
| **Gemini Omni Flash** `gemini-omni-1.1-flash` (Google AI Studio) | yes, `GEMINI_API_KEY` | `POST /v1beta/interactions`, `response_format:{type:"video", aspect_ratio:"9:16", resolution:"720p", delivery}`; MP4 base64 inline when < 4 MB, else `delivery:"uri"` + Files API poll | yes | base length **not stated in the docs**; extendable in steps up to 40 s | ≈ **$0.10 / s** at 720p (5,792 tokens/s × $17.50 per 1M) → 8 s ≈ $0.80, 10 episodes ≈ $8 | GA 2026-08-27, no shutdown date. Audio on by default; Thai narration "untested" per Google |
| Veo 3.1 Lite / Fast / Standard (AI Studio) | yes | `models/{id}:predictLongRunning` → poll operation → download `video.uri` (kept 2 days) | yes | 4 / 6 / 8 s | $0.05 / $0.10 / $0.40 per s | **all three preview ids: earliest shutdown 2026-10-22**, replacement = Omni. Do not build on them |
| OpenRouter video API (live since April 2026) | yes, `OPENROUTER_API_KEY` | `POST /api/v1/videos {model, prompt, duration, resolution, aspect_ratio}` → `GET /videos/{id}` → `GET /videos/{id}/content` | yes (per model) | `kwaivgi/kling-v3.0-std` 3–15 s · `bytedance/seedance-2.0-fast` 4–15 s · `google/veo-3.1-lite` 4/6/8 s | Kling $0.084/s ($0.126 with audio) · Seedance ≈ $0.04/s · Veo Lite $0.05/s | second engine later; Veo-via-OpenRouter shares the 10-22 shutdown; Omni not listed there today |
| OpenAI Sora 2 | — | — | — | — | — | **shut down 2026-09-24**, no replacement |

Not verified: Omni's base clip length, how Thai speech sounds, real latency through the proxy, whether an 8 s 720p MP4 stays under the 4 MB inline limit (plan for `delivery:"uri"`).

## 3. Proposal — the smallest addition that fits the pane (see mockup pins 1–7)

Mockup: `output/grand-line-clips-before-after.html` (built from the real pane markup, static; sent to the owner 2026-10-18).

1. **🎬 Clip 9:16** — a third chip in the existing Engine rail, value `as/gemini-omni-1.1-flash`; tooltip carries the price. Choosing it puts the prompt card in Clip mode: same textarea, same Master Formula line, placeholder asks for a series topic.
2. **Plan 10 episodes** — the same `#btn-generate-design` button, relabelled in Clip mode. Step 1 is the Enhancer (text model, `isJson` object schema `{episodes:[…]}`) producing 10 rows of `title · objective · key fact · narration line · visual prompt`. Nothing is rendered or paid yet.
3. **📋 Episodes card** — one new card between the prompt card and the preview: 10 compact rows (EP pill · title EN + Thai · 4 chips 🎯 💡 🗣 🎨 with the full text in `title` · status dot ⚪ planned / 🟡 rendering / 🟢 done / 🔴 failed · ✏️ edit · ▶ render one). Rows are editable in place before rendering.
4. **Cost before the click** — pill `8 s · ≈ $0.80 / clip · $8.00 all`; `▶ Render all · N` renders the planned rows one after another after a single in-dialog confirm with the total (never a native `confirm()` after awaits — see the V102.285 lesson). The owner pays only for clips that come back.
5. **9:16 preview** — the "Your Artwork Awaits" card shows a `<video controls playsinline>` portrait player; the action pill becomes `MP4 · 💾 Save · 🗑️`. Save uploads to Storage `teach-clips/{seriesId}/EP01.mp4` and writes the row into Firestore `clip_series/{seriesId}`.
6. **Gallery** — the Codex Gallery header gets a 🖼️ Codex · 🎬 Clips chip pair; Codex mode is unchanged (the Disease / Drug select stays), Clips mode lists saved series as portrait cards.
7. **📝 Captions · ⬇ zip** — two icon buttons in Clips mode: the Enhancer writes 10 Thai captions + hashtags from the plan into one `.txt` download; zip of the rendered MP4s. No posting from the app.

House-style notes: EN-first labels with Thai in the planner rows; icons + `title` instead of words; chips not dropdowns for the new controls; no new tab or pane.

### Data

- Firestore `clip_series/{autoId}`: `{ topic, styleKey, model, createdAt, updatedAt, episodes: [ { n, title, titleTh, objective, fact, narration, visual, status, clipUrl, storagePath, seconds, costUsd, caption, renderedAt } ] }` — one doc per series, 10 rows inside (no sub-collection; the whole series is edited together).
- Storage `teach-clips/{seriesId}/EP{nn}.mp4` — admin read + write, same shape as `pk-visuals/`.
- Usage: the proxy's `recordAiUsage` gets `tokens = usageMetadata.totalTokenCount` from Omni (video is token-billed), so the AI usage dashboard sees the spend without a new table.

## 4. What needs a hand deploy vs front-end only

| Part | Front-end only (ships with Pages CI) | Needs the owner to deploy by hand |
|---|---|---|
| Clip chip, Clip mode, planner card, in-place edit, cost pill, preview player, gallery chip pair, captions export | ✅ all in `public/admin.html` | — |
| Planner + captions text calls | ✅ existing text path (`callUniversalAI`, `isJson`) | — |
| Clip rendering | — | **`callAIProxy`**: new branch `provider:"gemini-video"` (model `gemini-omni-1.1-flash`) → Interactions API with `response_format` video 9:16 720p, `delivery:"uri"`, returns `{videoUrl or videoDataUrl, seconds, tokens, model}`; plus a `state:"poll"` sub-call for the Files API when the first call returns before the file is ACTIVE. Same `GEMINI_API_KEY` secret — **no new secret**. `firebase deploy --only functions:callAIProxy` |
| Save clip | — | `storage.rules`: `match /teach-clips/{seriesId}/{fileName} { allow read, write: if isAdmin(); }` → `firebase deploy --only storage` |
| Series doc | — | `firestore.rules`: `match /clip_series/{id} { allow read, write: if isAdmin(); }` (no rule = closed) → `firebase deploy --only firestore:rules` |
| Second engine (Kling / Seedance via OpenRouter) | chip only | `callAIProxy` OpenRouter video branch (`/api/v1/videos` + poll) — later, not slice 1 |

Timeout note: `callAIProxy` is capped at 540 s and `postWithRetry` at 500 s per attempt. Veo docs quote up to 6 min at peak, so slice 1 is designed as **submit → poll** from the client (two short proxy calls), never one long request.

## 5. Slices

- **Slice 1 (first PR, after the owner picks):** chip + Clip mode + planner (10 rows, editable) + render ONE episode end to end (proxy branch, preview player, Save to Storage + `clip_series`) + `scripts/grand-line-clips-qa.cjs` on the real markup and the real proxy branch (stubbed Omni response). Owner deploys `callAIProxy` + both rule files first; the first real render is one 8 s clip ≈ $0.80 with the owner's explicit OK.
- **Slice 2:** Render all with the single confirm + progress dots, Clips gallery, 📝 captions, ⬇ zip.
- **Slice 3 (optional):** second engine via OpenRouter; "extend to 16 s" for an episode; style presets for clips (the 6 Visual Style cards already feed the visual prompt).

## 6. Open questions for the owner

1. Omni only for slice 1, or Kling via OpenRouter as the second chip from the start?
2. Narration language in the clip itself: English audio with Thai captions (safest per Google's "Thai untested"), or try Thai audio on EP01 and judge?
3. Clip length default 8 s (≈ $0.80) — fine, or shorter (4–6 s) to halve the cost of a 10-episode run?
4. Should saved clips be visible to interns later (would need an intern-facing surface and a Storage download-token model like `pk-visuals`) — out of scope now, but it decides the Storage path layout.
