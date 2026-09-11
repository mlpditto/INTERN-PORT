# Phase 3 — AI evaluation pilot

Date: 2026-09-11. Baseline: production a3a3191 (V99.39). No production defaults or runtime code changed.

## Decision

Keep Gemini 3.8 Flash as the current default pending broader evaluation. This pilot supports testing Luna as an economical audit/translation option and Astra for question generation requiring complete standalone stems. Terra remains an audit alternative. Do not promote Sonnet to the default: two of three generation calls returned output rejected by the adapter. Fable passed semantic audit checks but did not demonstrate an advantage sufficient to justify its higher observed cost in this sample.

These are workload-specific candidates, not proof of general or clinical superiority.

## Method

Six selectable registry models × three tasks × three rounds = 54 calls, with two concurrent requests, rotated model order, low reasoning/effort, 8,192 output-token limit and no retries. GPT and Claude used the Phase 2 adapter; Gemini used its generateContent configuration. This tests API output, not the complete browser/LIFF workflow. Opus remains excluded following Phase 2 failures.

Frozen prompts and synthetic fixtures are beside this report. Audit has six MCQs and seven semantic checks per round: defend clean keys, reject deliberately wrong or duplicate keys, and detect absurd distractors. Translation tests one notice with numbers, URL, dates, negations and optional/required actions. Generation requests three arithmetic/storage MCQs. Repeated fixtures measure consistency, not dataset diversity.

## Results

| Model | Valid JSON / 9 | Audit semantic / 21 | Translation checks / 39 | Generation schema + answer / 21 | Estimated USD, 9 calls |
|---|---:|---:|---:|---:|---:|
| Gemini 3.8 Flash | 9 | 18 | 39 | 21 | 0.020616 |
| GPT-5.6 Terra | 9 | 21 | 39 | 21 | 0.077208 |
| GPT-6 Astra | 9 | 21 | 39 | 21 | 0.296990 |
| GPT-5.6 Luna | 9 | 21 | 39 | 21 | 0.008033 |
| Claude Sonnet 5 | 7 | 15 | 39 | 7 | 0.070908, incomplete* |
| Claude Fable 5.1 | 9 | 21 | 39 | 21 | 0.458910 |

*Sonnet usage is absent for the two rejected generation responses. The displayed amount covers seven responses only; missing cost is not zero. Failure reason is incomplete/invalid output with end_turn; the adapter did not retain raw rejected text, so the exact formatting cause is unconfirmed.

Audit schema passed all 18 calls. Reported arithmetic means matched the scorer in Astra/Luna 3/3, Terra 2/3, Gemini/Sonnet/Fable 0/3. These checks are separate from semantic detection because the application recalculates scores. The machine summary includes schema and means (27 audit checks), while the table above deliberately reports only the 21 semantic checks.

Gemini missed the duplicate-correct-key threshold in all three rounds. Sonnet missed that threshold and the deliberately wrong percentage key in all three rounds. These are rubric-score failures; they should not be described as proof the models never mentioned the issue in prose.

| Model | Median audit seconds | Median translation seconds | Median generation seconds |
|---|---:|---:|---:|
| Gemini 3.8 Flash | 3.64 | 1.69 | 2.34 |
| GPT-5.6 Terra | 15.28 | 2.35 | 3.38 |
| GPT-6 Astra | 20.18 | 3.55 | 6.22 |
| GPT-5.6 Luna | 15.72 | 3.49 | 3.38 |
| Claude Sonnet 5 | 13.08 | 6.19 | 9.24 |
| Claude Fable 5.1 | 26.75 | 9.47 | 14.76 |

Timing is client-observed wall time and includes network/provider variation. Sonnet generation timing includes failed calls. Three observations per cell do not support statistical significance claims.

## Manual output review

All translations preserved the core constraints in this notice. Luna and Sonnet sometimes omitted the introductory training-notice heading. Passing regex checks is not a complete translation-quality evaluation.

Numerically correct generated answers were not always usable standalone questions:

- Astra included the necessary facts in all nine question stems, without inventing the product type.
- Gemini omitted necessary source facts from the stems across all rounds; correct explanations contained those facts.
- Terra similarly omitted source facts; rounds 1 and 2 also introduced gloves, a product type absent from the source.
- Luna included the stock inputs in round 1, but other stems and rounds omitted necessary facts.
- Sonnet's one valid generation response supplied complete stems; two calls were unusable.
- Fable supplied complete stems but introduced gloves in every round.

The frozen generation prompt did not explicitly demand standalone stems. These are qualitative observations about suitability for this app, not retroactively added scoring criteria. The next prompt should explicitly require complete stems and prohibit invented source details, followed by a new evaluation on unseen fixtures.

## Cost basis

Standard short-context input/output USD per million tokens: Gemini 0.75/3.75, Terra 2/12, Astra 10/50, Luna 0.2/1.2, Sonnet 2/10, Fable 10/50. Sources checked 2026-09-11: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing).

Gemini pricing used here expires after 2026-12-31. Estimates use returned tokens, include Gemini thinking tokens, and do not apply cache discounts. They are not invoices or projections for long-context, image/PDF, batch or production workloads. See pricing.json for assumptions.

## Phase 4 proposal

1. Keep existing defaults initially; label exact model IDs from the central registry across remaining pickers.
2. Improve generation prompts with explicit standalone-stem and source-fidelity requirements. Compare Astra, Gemini and Luna on new fixtures before choosing a generation default.
3. Offer Luna and Terra for audit comparison; retain Gemini for speed, but surface the need to inspect ambiguous keys.
4. Diagnose Sonnet invalid JSON using a synthetic reproduction and sanitized diagnostics before promotion. Keep Opus excluded until its earlier failure is resolved.
5. Test real workload shapes (long text, images/PDF, bilingual content), then browser and LIFF regression checks before a production-default rollout. This nonclinical pilot does not validate medical accuracy.

## Reproduction and evidence

Run from the repository root:

```powershell
node scripts/evaluate-ai-phase3.cjs
python -X utf8 scripts/summarize-ai-phase3.py
```

The first command performs paid provider calls using existing project secrets and overwrites results.json; archive results before another run. The second is offline and regenerates scored-results.json and summary.json. protocol.json, frozen prompts, audit-fixtures.json, results.json and pricing.json retain the inputs and observed outputs. No real user notes or identifiers were submitted.
