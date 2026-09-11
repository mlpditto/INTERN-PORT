# Phase 4 — controlled model selection and generation prompts

2026-09-11, V99.40. Defaults are unchanged. This release exposes manually selected, verified model IDs in the Quiz Editor AI/PDF/Expand and Translate menus and the four default-model preferences. Other specialized studios and provider-specific image/audio routes remain outside this rollout.

## Changes

- The two Quiz Editor chip rails become compact, keyboard-accessible selects populated from the central registry. Exact model names replace ambiguous GPT/Pro labels for the new choices. Existing routes and saved IDs remain selectable without silent remapping.
- Preferences add registry models without changing saved/default values. The hidden reflective-review select also accepts them. Opus remains excluded. Sonnet choices carry a trial notice because Phase 3 observed JSON failures.
- Shared question-generation requirements are applied at the actual callUniversalAI boundary for case_to_quiz, kb_to_quiz, quiz_suggestion, quiz_regen_suggestion and quiz_image_generate. They require self-contained stems, source fidelity and one defensible answer. Audit, translation, authentication and backend routing are unchanged. Missing rules fail before a paid generation call.
- Audit controls remind reviewers to inspect duplicate or ambiguous keys. Luna and Terra remain available through the existing registry-backed audit menu.

## Held-out-number pilot

Four models × three repetitions, low effort, no retries, concurrency two. New numeric inputs: 24 cartons × 12 units, issue four cartons, fictional ZETA at 4–10 °C. The same task pattern as Phase 3 was retained, so this is a changed-input regression, not a broad unseen-domain benchmark. The runner imports the production rules file.

| Model | Valid JSON | Correct answers | Stems containing required premises | Median seconds |
|---|---:|---:|---:|---:|
| Gemini 3.8 Flash | 3/3 | 9/9 | 9/9 | 2.29 |
| GPT-6 Astra | 3/3 | 9/9 | 9/9 | 7.05 |
| GPT-5.6 Luna | 3/3 | 9/9 | 9/9 | 4.49 |
| Claude Sonnet 5 | 3/3 | 9/9 | 7/9 | 8.61 |

Manual review confirms that Sonnet omitted the required temperature range in rounds 2 and 3. Gemini, Astra and Luna now include the arithmetic inputs and storage range. All answers in this small synthetic sample were numerically correct. This does not establish clinical accuracy or a causal effect of the prompt alone, because input values also changed.

Sonnet was additionally run three times on the exact Phase 3 generation prompt without the new rules. All three returned valid JSON. Sanitized diagnostics found no surrounding code fences. The previous failure could not be reproduced; no speculative parser relaxation was added. Sonnet remains a trial option, not a default.

## Verification

- `node scripts/modern-ai-qa.cjs`: modern model IDs, vision request shape, JSON/truncation rejection, authentication gates and no reasoning disclosure.
- `node scripts/gemini-38-qa.cjs`: actual frontend call boundary applies rules to all five intended features, leaves audit prompt unchanged, preserves routing/auth/legacy selection behavior.
- `node scripts/profile-card-qa.cjs`: both page scripts parse and existing user/admin activity behaviors pass.
- `node scripts/ai-model-ui-qa.cjs` (Playwright): actual admin markup, modern choices update hidden routing values, legacy restore, unchanged default, excluded Opus, repeat initialization, 390px fit and keyboard focus.
- `node scripts/build-ai-model-registry.cjs --check` and `git diff --check`.

The browser test isolates real selector markup; it does not authenticate to Firebase or exercise LINE LIFF. Production-default promotion remains gated on authenticated browser/LIFF tests and broader long-text, image/PDF and bilingual workload evaluation. No claim is made that those gates passed in this phase, and no default promotion is included.

## Evidence and rerun

`generation.txt`, `results.json`, `summary.json`, `sonnet-repro.json` retain synthetic inputs and outputs. Run `node scripts/evaluate-ai-phase4.cjs` for the changed-input pilot or add `--sonnet-repro` for the original-prompt reproduction. These commands make paid calls and overwrite their respective results; archive evidence first. The Phase 3 report and data are included in this branch as the decision baseline.

API migration reference: [official OpenAI guidance](https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol). This release uses the already verified Phase 2 adapters and exact IDs rather than introducing another API migration.
