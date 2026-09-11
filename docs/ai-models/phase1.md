# AI model migration — Phase 1

Date: 2026-09-11. Baseline: production V99.38; exact commit in inventory.json.
Status: discovery and central registry design complete. No runtime migration, API calls, cost benchmark, or account-access verification in this phase.

## Deliverables and scope

- inventory.json: static source evidence with file/line references; 19 first-party HTML/JS files scanned, 284 model-literal occurrences, 55 distinct model strings, 66 callUniversalAI call sites, 55 feature labels.
- registry.proposed.json: canonical IDs, labels, providers, workload roles, readiness and proposed defaults. Design artifact only; all entries disabled, no production consumer.
- workload-mapping.json: every discovered feature label assigned to a migration track, with source evidence.

Counts include comments, examples and aliases; they are not counts of live models or verified requests. Dynamic model names, remote Firestore configuration, browser preferences and externally hosted services are not fully enumerable by static inspection. models.json / models_utf8.json are historical API-list snapshots (including Gemini 2.5), not the authoritative runtime registry. Do not replace these blindly.

## Confirmed current routing

| Surface | Requested/default value | Effective route / issue |
|---|---|---|
| Quality audit | Gemini 3.8 / Terra | Explicit server-only paths already exist; all other workflows still need testing |
| Intelligence GPT | gpt-5.4 | OpenAI Chat Completions |
| Translate GPT and other gpt-4* callers | gpt-4o / gpt-4o-mini | Proxy silently rewrites to gpt-5.4-mini; frontend label is not the actual model |
| Claude | claude-4-sonnet-latest and other aliases | Proxy defaults to claude-sonnet-4-6, haiku to 4-5, opus to 4-7; even new IDs can be remapped incorrectly |
| Gemini Flash / Pro labels | 3.5 Flash / 3.6 Flash | Pro label does not denote a Pro model; legacy aliases and SDK fallback also rewrite IDs |
| Gemini 3.8 | gemini-3.8-flash | Explicit AI Studio route; other Gemini routes go through Vertex/fallback logic |
| Intern translation / product AI | Typhoon | Direct proxy callers; preserve during Gemini/GPT/Claude migration |

The OpenAI Responses branch currently handles Terra only, and sends text prompt input. Do not route Astra/Luna or vision to it merely by changing a string. The Claude branch uses JSON prompting and fixed temperature; verify new model request/output requirements before enabling it. Some proxy responses omit actual model attribution. Local usage grouping currently buckets non-Gemini/non-GPT into Typhoon, so Claude attribution also needs correction.

## Central source of truth

Maintain one versioned registry with exact API ID, user-visible versioned name, provider, role, supported input/output contract, endpoint adapter, access-test state, and enabled state. Populate capability fields only after endpoint-specific verification in Phase 2. Generate frontend choices and backend allowlists from this same source when wiring it in Phase 2; do not maintain separate hand-edited copies.

Model candidates from official catalogs:
- Gemini 3.8 Flash: default general/audit candidate; stable.
- GPT-5.6 Terra: balanced candidate, preserve existing pilot path.
- GPT-6 Astra: deep-work candidate; not a universal replacement for inexpensive jobs.
- GPT-5.6 Luna: fast/cost candidate, pending evaluation.
- Claude Sonnet 5: balanced candidate; Opus 5 / Fable 5.1: deep-work candidates.

Latest catalog listing does not establish account access or production suitability. Final fast/deep defaults remain pending evaluation. Sources: https://ai.google.dev/gemini-api/docs/models ; https://developers.openai.com/api/docs/models/all ; https://platform.claude.com/docs/en/models/overview .

## Feature tracks

1. Text / structured content: Audit, Rewrites, Translate, Tags, Expand, question enhancement, feedback, comparisons, reflective review, writing analysis, drug/disease drafting and review, resume and narrative tools. Proposed general default Gemini 3.8; provider-specific balanced options Terra and Sonnet 5 after tests. Preserve each feature's JSON schema and output budget.
2. Vision / document understanding: image-to-quiz, research image, KB image indexing, product vision. Require real image-input adapter verification. PDF extraction and image generation must be distinguished.
3. Image generation/editing: design_image, quiz_illustration, casecard_image, product_photo_cleanup, pk_visual, patho_visual. Preserve specialized engines and provider prefixes; separate migration.
4. Speech/audio: retain existing TTS/voice engines. tts_polish is text preparation, not synthesis.
5. User Typhoon/device translation: preserve existing route and LIFF authorization; inventory as explicit exceptions, not missed upgrades.
6. Telemetry: ai_eval is metadata rather than a model workload; correct actual-model reporting separately.

## Preferences and history

Migrate ai_default_translate_model, ai_default_analyzer_model, ai_default_review_model, ai_default_qfp_model, ai_default_grammar_model, ai_default_2model_b and feature-specific settings only when their replacement is enabled. Preserve explicitly pinned settings until a tested migration rule exists. Inventory symbolic keys (e.g. DCA_AI_LS_KEY, DXA_AI_LS_KEY and case-card preferences) as well as literal keys. Saved lastAiAudit / lastAiAnalysis model attribution must remain historical. Do not relabel old results as the new model.

## Phase 2 acceptance criteria

- Every targeted feature resolves through an exact canonical ID; labels and actual response model agree.
- Astra/Luna and Claude 5 IDs cannot fall into legacy substring rewrites.
- Text, JSON and actual vision requests pass independently; incomplete output is rejected.
- Access failures do not silently switch providers; fallback is explicit and recorded.
- Model-list UI offers enabled, tested entries only; stale preferences resolve predictably.
- Keep cached quality results free to open; running a new audit remains explicit.
- Preserve Firebase/LIFF authorization and server-side credential handling.
- Check callUniversalAI(prompt, options) sites around the three narrative helpers: they differ from the declared model-first signature; confirm reachability before changing them.

## Handoff

Implement and test backend adapters and registry consumers first, then run a synthetic workload comparison before enabling new defaults. Rollback uses the previous registry version and adapters. Materials discoverability remains a separate UI issue; no Materials fields or saved data changed here.
