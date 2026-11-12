# Drug & Disease Codex (admin)

The admin Codex forms (lean heads, emoji-first drug form), published list, Incomplete view, AI auto-draft, batch draft, files, seeds, paediatric dosing.

## How to get to it (user POV)

Admin: Dashboard ▸ Drug Codex / Disease Codex.

## Scripts that drive it

- `drug-form-head-qa` — drug form one-row header (drug-toolbar.js)
- `drug-form-ui-qa` — emoji-first drug form: tab pill colour = % filled
- `disease-form-head-qa` — disease form header as lean as the drug form
- `drug-list-ui-qa` — published list least-complete-first, three fixed tiers
- `drug-codex-incomplete-view-qa` — Incomplete view: < 90 % only, chip rail narrows
- `drug-autodraft-chip-qa` — 🤖 AI Auto-Draft panel as one line
- `drug-codex-batch-qa` — multi-select AI draft never writes; a throwing fake Firestore
- `drug-codex-review-sheet-qa` — V102.640 owner pick 2 (mockup-codex-batch-review): after 🤖 batch drafts, 📋 Review n opens one sheet — ⚡ Short fields (ATC / Class / Brands for drugs that had them empty, ticked, bad ATC shape unticked + amber, editable, one batch write) and 🩺 Clinical (🔍 AI Review on another provider + Jev per drug, 2 at a time; clean = no safety / factual / consistency finding + Jev ok, ticked; ⚠ n opens the full form); only empty fields are written, aiDrafted kept; "One by one" keeps the old path
- `admet-visual-lean-qa` — V102.641 / intern V101.311 owner pick A + B (mockup-admet-visual-lean): 🎨 ADMET Visual is one header row (model ▾ — Nano Banana or GPT Image 2.6 via the Image API), one chip row (📊 🫀 🔀 · +MoA +Class +Ind · 🔤 · 🇹🇭/EN · ✏️), A D M E T dots with "n empty · 🤖 Fill", Generate in the picture, 🔁 ⬇ 💾 after; 🔤 (default) asks for a picture with no text and lays the PK words over it (quick words, then AI ≤55 chars), tap to edit, saved as `pkVisual.labels` + `labelLang`, reopened with them; the intern drug page draws them in the same slots
- `drug-codex-files-qa` — 📎 download files on both sides
- `bronchodilator-seed-qa` — inhaled bronchodilators → pending drafts, names only
- `peds-dosing-qa` — peds-dosing.js data, calculator, intern markup, admin import
- `drug-codex-lean-b-qa` — V102.637 owner pick B (mockup-codex-lean): one line per drug (name + thin % bar · ATC / Cls / Brd dots — ○ = add at that field · 🤖 ✏️ ⋯ with who / when / 📰 inside), column heads filter in Incomplete first (ATC / Class / Brands chips gone), no avg line, 👶 / 🫁 imports under 📥, drafts grouped by source (note once, % per row, ✓ Approve amber + "⚠️ Only n% filled" under 80 %, no "new entry")
- `drug-verify-gate-check-qa` — V102.638 owner pick AI Review + Jev: the "tabs unverified" gate's 🔍 Check — AI Review (another model than the drafter) gives the reason, Jev (jevCheckDrug) flags a tab that may be about another drug and Thai ≠ English in Education; each tab ✓ / ⚠️ + one line, "✓ n clear" ticks only clear tabs; advice only
- `jev-drug-check-check` — functions/jev-drug-check.js: on_topic per known tab, same_meaning per Education field with EN + TH, cached, ok / look / bad (quiz thresholds, not calibrated on drug text), admin-only, writes nothing to the drug

## What usually lies

- Pending drafts carry `submittedBy = admin uid` so the existing rules accept them; a fixture with another uid "fails" on rules, not on the feature.
- The batch draft must never write: the fake Firestore in `drug-codex-batch-qa` throws on touch — keep it that way when extending.
