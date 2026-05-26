---
type: feature
status: in-progress
owner: mlpditto
branch: claude/drug-codex-phase1-V93.96
commit:
version: V93.96
risk: low
created: 2026-05-26
updated: 2026-05-26
---

# FEAT-20260526-Drug-Codex-Phase1

## Goal

Evolve PONEGLYPH into an A-Z clinical drug reference ("จารึกข้อมูลยา").
Phase 1 lays down the data layer only: Firestore collections, security
rules, and composite indexes. No UI yet — Phase 2 wires the admin CRUD
modal, Phase 4 the intern read-only view, Phase 5 the intern submission +
admin moderation flow.

## Scope

Phase 1 only:

- Collection `drug_codex/{drugId}` — published, read by any signed-in
  user, write by admin only.
- Collection `drug_codex_drafts/{draftId}` — intern submissions awaiting
  admin moderation; status flow `pending` → `approved` / `rejected`.
- Composite indexes for the queries Phases 2–5 will need.

Out of scope this phase: admin modal, intern read view, AI auto-draft,
moderation queue UI, LINE Notify hooks, cross-references from
`learning_path_entries`.

## Schema

### `drug_codex/{drugId}` (published)

Field shape (loosely typed at the rules layer; client enforces):

- `genericName` (string, required) — primary identifier, used for A-Z sort.
- `brandNames` (string[]) — Thai/international trade names.
- `atcCode` (string) — WHO ATC classification (e.g. `A10BA02`).
- `class` (string) — pharmacological class (e.g. `Biguanide`).
- `indication` (string, multi-line) — clinical uses.
- `dosing` (string, multi-line) — adult/pediatric/renal adjustment notes.
- `mechanism` (string, multi-line) — mechanism of action.
- `pharmacokinetics` (string, multi-line) — ADME summary.
- `contraindication` (string, multi-line).
- `sideEffects` (string, multi-line) — common + serious.
- `interactions` (string[] or string, multi-line).
- `monitoring` (string, multi-line) — labs/clinical signs to watch.
- `patientCounseling` (string, multi-line) — Thai-language friendly notes.
- `pearls` (string, multi-line) — clinical pearls.
- `references` (string[]) — citation URLs (PubMed/MIMS/UpToDate).
- `lastReviewedAt` (timestamp).
- `reviewedBy` (string) — admin uid/email.
- `createdAt` (timestamp), `updatedAt` (timestamp).
- `aiDrafted` (bool, optional) — true if seeded by Phase 3 AI auto-draft;
  forces admin review before publish.

### `drug_codex_drafts/{draftId}` (pending moderation)

Same fields as `drug_codex` plus:

- `submittedBy` (string, required) — locked to `request.auth.uid`.
- `submittedByName` (string) — denormalized display name.
- `status` (string, required) — `pending` | `approved` | `rejected`.
- `adminNotes` (string, optional) — moderation feedback shown back to intern.
- `targetDrugId` (string, optional) — when set, this draft is an edit
  proposal for an existing `drug_codex/{targetDrugId}` rather than a new
  entry.

## Files Touched

- [x] `firestore.rules` — added rules 28 (drug_codex) + 29 (drug_codex_drafts).
- [x] `firestore.indexes.json` — added 3 composite indexes.
- [x] `INTERN-PORT-OPS/01 Features/FEAT-2026-05-26-Drug-Codex-Phase1.md`
  (this file).
- [ ] No HTML/JS changes this phase.

## Rules Summary

```
match /drug_codex/{drugId} {
  allow read:  if isSignedIn();
  allow write: if isAdmin();
}

match /drug_codex_drafts/{draftId} {
  allow read:   admin OR owner intern
  allow create: signed-in AND submittedBy=auth.uid AND status='pending'
                       AND genericName is non-empty string
  allow update: admin (any) OR owner-while-pending (status frozen)
  allow delete: admin OR owner-while-pending
}
```

Key invariants enforced server-side:

1. Intern cannot self-approve (status locked to `pending` on create + own update).
2. Intern cannot impersonate another intern (`submittedBy = auth.uid`).
3. Once admin moves a draft past `pending`, the intern loses write access
   (preserves the moderation trail).
4. Published `drug_codex` is admin-write-only; intern submissions must
   flow through drafts.

## Composite Indexes Added

| Collection | Fields | Purpose |
|---|---|---|
| `drug_codex` | `class` ASC + `genericName` ASC | Phase 2/4 filter by pharma class, sorted A-Z |
| `drug_codex_drafts` | `status` ASC + `createdAt` ASC | Phase 5 admin pending-queue (oldest first) |
| `drug_codex_drafts` | `submittedBy` ASC + `createdAt` DESC | Phase 5 intern "My drafts" view |

Single-field auto-indexes cover: A-Z list (`genericName`), recently
updated (`lastReviewedAt`), and ATC range scans (`atcCode`).

## Acceptance Criteria

- [ ] `firebase deploy --only firestore:rules` succeeds.
- [ ] `firebase deploy --only firestore:indexes` succeeds (composite
      indexes show as Building → Enabled in the console).
- [ ] Rules simulator: admin can read/write both collections; signed-in
      intern can read `drug_codex` but cannot write; intern can create a
      draft with own uid + status='pending' but is rejected if
      status='approved' or submittedBy=someoneelse.
- [ ] Existing collections unaffected (smoke test: load admin.html
      Poneglyph tab, load index.html quiz/case views).

## Deploy Commands (manual — Pages CI does not deploy rules/indexes;
ref `[[feedback_firestore_rules_deploy]]`)

```powershell
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## Risks

- **Low.** Adding two new collections with admin-write defaults cannot
  break existing functionality. Indexes are additive; old queries keep
  working.
- Rules simulator coverage is the main pre-deploy check.

## Test Plan

- [ ] Firebase Console → Firestore → Rules Playground:
  - Authenticated as `medlifeplus@gmail.com` (admin) → read+write
    `drug_codex/test` → allow.
  - Authenticated as any other uid (intern simulation) → read
    `drug_codex/test` → allow; write → deny.
  - Authenticated as intern uid → create
    `drug_codex_drafts/d1` with `{submittedBy:<uid>, status:'pending',
    genericName:'metformin'}` → allow.
  - Same intern → create with `status:'approved'` → deny.
  - Same intern → create with `submittedBy:<other-uid>` → deny.
  - Different intern → read first intern's draft → deny.
  - Admin → update first intern's draft to `status:'approved'` → allow.
  - First intern → update own draft after admin approved it → deny
    (post-approval lock).

## Rollback Plan

- Revert `firestore.rules` and `firestore.indexes.json` to
  `production` HEAD (one commit revert).
- Manually `firebase deploy --only firestore:rules,firestore:indexes`
  after revert.
- No data migration needed; collections will simply be unused.

## Related

- Parent track: PONEGLYPH evolution — Drug Codex (Phases 1–6).
- Pattern source: `[[project_taxonomy_admin_ui_plan]]` (Phase 2 CRUD
  modal will reuse the axis-tabbed pattern).
- Deploy gotcha: `[[feedback_firestore_rules_deploy]]`.
