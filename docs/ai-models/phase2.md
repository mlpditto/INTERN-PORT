# AI model migration — Phase 2

Date: 2026-09-11. Release: V99.39. Phase 1 documentation is included in this branch.

## Implemented

- functions/ai-model-registry.json is the runtime source of truth; scripts/build-ai-model-registry.cjs generates the browser registry. Deployment checks that the generated copy matches.
- Exact registered GPT and Claude IDs bypass legacy substring remapping. Model/provider mismatches fail before a provider call.
- OpenAI Responses adapter: Terra, Astra, Luna; text and base64 image input; JSON or text output; low reasoning; bounded output; store:false.
- Claude Messages adapter: Sonnet 5, Opus 5, Fable 5.1; text and base64 images; low effort; no fixed temperature; only text response blocks returned.
- Completed-output and JSON validation reject empty, truncated, and malformed results. Responses include requested/actual model, usage, latency and finish reason.
- Registered frontend calls use the authenticated server path without browser-key/provider fallback. Missing registry fails closed for new families.
- Quality Audit dropdown consumes selectable registry entries. Gemini 3.8 remains the default. Broader tool defaults and saved preferences remain for Phase 3/4.
- Legacy OpenAI responses now report actual model attribution; Claude usage is no longer counted as Typhoon in the local usage display.

## Live synthetic probes

Used existing project secrets only in process memory, never written to results or printed. Tested short text, exact JSON, and a generated red-square image. No learner data used.

| Model | Text | JSON | Image + JSON | Audit selector |
|---|---|---|---|---|
| Gemini 3.8 Flash | Pass | Pass | Pass | Enabled |
| GPT-5.6 Terra | Pass | Pass | Pass | Enabled |
| GPT-6 Astra | Pass | Pass | Pass | Enabled for trial |
| GPT-5.6 Luna | Pass | Pass | Pass | Enabled for trial |
| Claude Sonnet 5 | Pass | Pass | Pass | Enabled for trial |
| Claude Opus 5 | Pass | Pass | Fail, twice | Withheld |
| Claude Fable 5.1 | Pass | Pass | Pass | Enabled for trial |

20/21 initial probes passed. Opus returned end_turn but failed the adapter's text/JSON validation on image input; a targeted retry reproduced the failure. This does not establish that Opus lacks vision support. It remains callable by explicit admin API request for diagnosis but is not offered by the picker. Resolve its output contract before enabling it.

Evidence: phase2-probe-results.json and phase2-probe-retry.json. These are access/transport smoke tests, not medical accuracy, cost or latency benchmarks. They do not replace Phase 3's task-level evaluation.

## Regression checks

- modern-ai-qa: all registered GPT/Claude IDs, exact routing, both image formats at provider boundary, request limits, malformed/truncated JSON, missing credentials, reasoning-block exclusion, provider mismatch, admin and authentication gates.
- gemini-38-qa: existing Gemini/Terra behavior, image generation compatibility, all registered models fail without local fallback, scoring and preference regression checks.
- profile-card-qa: parse both page scripts and existing profile behavior.
- Generated registry consistency and git diff whitespace checks.

## Rollout and remaining work

Deploy only callAIProxy first, then frontend. Keep existing Gemini 3.8 default and all historical result attribution. Reverting this release restores the old Terra adapter and dropdown. Phase 3 evaluates full real-world task fixtures before changing defaults; Phase 4 migrates other tool pickers/preferences. Legacy model routes, Typhoon intern flows, specialized image/audio engines and Materials are unchanged.

Provider guidance used: https://developers.openai.com/api/docs/models/gpt-6-astra ; https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost ; https://ai.google.dev/gemini-api/docs/gemini-3 .
