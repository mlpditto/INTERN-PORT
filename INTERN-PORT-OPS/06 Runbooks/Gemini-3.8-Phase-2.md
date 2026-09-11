# Gemini 3.8 Flash — Phase 2 implementation

2026-09-11 · V99.24 · base production c644321

Status: implemented and locally tested; authenticated browser/proxy release gate remains open.

## Behavior

Open Quiz Review → Scorecard → Gemini 3.8 · Trial. This explicitly runs a fresh audit and replaces the saved scorecard, following existing Audit save behavior. Ordinary Regenerate still uses the shared model selection. Shared chips, defaults, stored preferences and LIFF authentication are unchanged.

The trial uses one authenticated call to the existing server AI Studio provider. There is no browser-key fallback or duplicate endpoint retry in this frontend path. The existing server transport retry policy still applies. A bare gemini-3.8-flash request to the Gemini provider also routes to AI Studio; other Vertex routes retain the existing guard.

Text generation supports JSON MIME type and output limits (default 8192, cap 32768; Audit requests 32768). Gemini 3.8 uses fixed low thinking. Image generation configuration remains unchanged. Text parts are joined excluding thought parts. Missing output, non-STOP finish reasons and invalid requested JSON return an error, without returning generated text in error payloads.

The scorecard saves and displays actual model, input/output/thinking tokens, server generation latency, finish reason and JSON validity. Missing usage counts remain null. No prompt is added to telemetry. Latency includes server provider retries, excludes browser/network overhead, and is not a benchmark.

Configuration reference: https://ai.google.dev/gemini-api/docs/generate-content/thinking

## Validation

- `node scripts/gemini-38-qa.cjs`: mocked real handler and frontend function; auth/admin denial, both routes, JSON/config/cap, multiple parts, thought exclusion, truncation, invalid/missing output, absent usage, image regression, HTTP/network failures without local fallback, Audit isolation.
- `node scripts/profile-card-qa.cjs`: both page script parsing and existing profile checks.
- `node --check functions/index.js` and `git diff --check`.
- Not yet verified: authenticated deployed proxy, actual UI rendering and LINE/mobile testing, real quiz quality/cost comparison.

## Release gate

1. Deploy the updated callAIProxy before releasing the frontend. GitHub Pages does not deploy Cloud Functions.
2. With a normal admin Firebase session, run a synthetic quiz through the trial, confirm valid scorecard and usage, reload and reopen the saved result. No auth bypass tokens.
3. Verify ordinary Audit/Regenerate, shared preference reload, image generation and mobile Scorecard header.
4. Release frontend after these checks; retain existing default models. Phase 3 quality/cost comparison is separate.

The trial rejects responses without the new metrics/JSON/finish contract, preventing use with an old backend.
