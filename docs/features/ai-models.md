# AI proxy, providers & model rails

functions/index.js + modern-ai.js routing (Gemini, Haiku, Typhoon, Grok, Ollama), the registry-driven rails on every page, AI settings and usage.

## How to get to it (user POV)

Admin: AI API Settings (keys, usage); every ✨ button's model chip. Server: callAIProxy / callUniversalAI.

## Scripts that drive it

- `modern-ai-check` — runModernAI with a fake post: JSON tolerance, key redaction
- `modern-ai-qa` — all modern ids, vision payloads, truncation, secrets missing
- `gemini-38-qa` — Gemini 3.8 auth, routing, usage, JSON, truncation
- `gemini-api-route-check` — Gemini 3.x via the Gemini API, recorded as gemini-aistudio
- `gemini-model-routing-check` — legacy aliases, AI Studio routing, TTS / OpenRouter isolation
- `haiku-vision-qa` — Haiku forwards both image payload shapes, denies non-admin
- `typhoon-vision-check` — Typhoon OCR step + text step, error diagnostics
- `openrouter-grok-check` — Grok via OpenRouter request body + contracts
- `ollama-local-qa` — local Ollama trial module against a mock HTTP server
- `google-bill-cue-check` — data-bill="google" chips + the bill card
- `text-models-qa` — 18 task rails + native rails, Drug Codex, audit / compare / image
- `ai-settings-ui-qa` — AI API Settings lean rows; saved key rings the logo
- `ai-usage-overview-qa` — usage strip inside AI API Settings ▸ Usage & quota
- `ai-usage-mix-qa` — hourly heatmap: stacked bars per model owner
- `ai-usage-collector-qa` — usage collector keeps model aggregation vs missing breakdown apart

## What usually lies

- Registry sync normalises trial models; chip counts and default ids in these tests move with every `ai-model-registry.json` PR — update both.
- A placeholder key (`sk-...`) must be treated as "no key"; the settings test covers it, keep it when adding a provider.
- Reasoning models eat `max_tokens`; a truncation fixture must leave room or every provider "truncates".
