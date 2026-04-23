# FEAT-2026-04-23 - Alabasta x Poneglyph x Laboon Bridge

## Goal
- Turn `Alabasta` from a passive case inbox into an action hub.
- Let admins move from case review to knowledge capture and AI-assisted coaching without copying data manually.

## Product Roles
- `Alabasta`: source of truth for submitted case records and admin review state.
- `Poneglyph`: source of truth for reusable knowledge notes, summaries, and structured learning artifacts.
- `Laboon`: AI workspace for summarization, coaching drafts, voice script generation, and case teaching support.

## User Flow
1. User submits a case into `cases`.
2. Admin opens the case in `Alabasta`.
3. Admin reviews, edits note, scores, and marks status.
4. Admin can choose one of two bridge actions:
   - `Ask Laboon`
     - Generate a structured AI brief from the current case.
     - Optionally send the brief into Laboon studio for script or voice workflow.
   - `Promote to Poneglyph`
     - Convert the reviewed case into a reusable knowledge note draft.
     - Save the draft to `poneglyph_notes`.
5. Admin can continue editing the generated note in `Poneglyph`.

## Current Prototype Flow
### Ask Laboon
- Entry point: `Alabasta` action button.
- Input: one `cases` document.
- Output: ephemeral AI brief shown in modal.
- Optional next step: push generated brief into Laboon transcript area (`tts-input`) and switch to `AI Digital Lab > Laboon`.

### Promote to Poneglyph
- Entry point: `Alabasta` action button.
- Input: one `cases` document.
- Output: prefilled draft modal with:
  - title
  - tags
  - markdown content
- Save target: `poneglyph_notes`
- Owner model: save under current admin user as note owner.

## Data Flow
### Existing collections
- `cases`
  - primary operational record
  - fields already used in bridge:
    - `id`
    - `caseId`
    - `userId`
    - `displayName`
    - `disease`
    - `customer`
    - `note`
    - `status`
    - `adminBonus`
    - `adminReviewedBy`
    - `adminUpdatedAt`
    - `timestamp`

- `poneglyph_notes`
  - persistent knowledge output
  - current prototype saves:
    - `ownerId`
    - `title`
    - `contentMarkdown`
    - `tags`
    - `pinned`
    - `version`
    - `versionHistory`
    - `checklistStats`
    - `lastEditMeta`
    - `updatedAt`
    - `createdAt`
  - bridge metadata recommended:
    - `sourceType: "alabasta_case"`
    - `sourceCaseId`
    - `sourceCaseRef`
    - `sourceDisease`
    - `sourceUserId`

### Runtime-only bridge
- `Laboon` currently works as an interaction workspace, not a dedicated Firestore collection.
- For prototype:
  - generated case brief stays in modal memory
  - when admin clicks `Send to Laboon`, content is written into `tts-input`
  - no extra persistence is required

## Recommended Future Collections
### Optional: `laboon_case_sessions`
- Purpose: persist AI summaries and teaching drafts generated from cases
- Suggested fields:
  - `caseId`
  - `sourceType`
  - `promptPreset`
  - `model`
  - `output`
  - `createdBy`
  - `createdAt`

### Optional: `alabasta_links`
- Purpose: explicit cross-system traceability
- Suggested fields:
  - `caseId`
  - `poneglyphNoteId`
  - `laboonSessionId`
  - `linkType`
  - `createdBy`
  - `createdAt`

## Source of Truth Rules
- Case truth stays in `cases`.
- Knowledge truth stays in `poneglyph_notes`.
- Laboon output is draft/support material unless persisted intentionally.
- Do not overwrite original case notes when generating Poneglyph drafts or Laboon briefs.

## UX Recommendations
- Keep bridge actions inside `Alabasta` row actions.
- Use small dedicated modals:
  - `Ask Laboon` for AI brief and send-to-studio
  - `Promote to Poneglyph` for editable draft review before save
- Show source lineage in generated artifacts so admins know where they came from.

## Rollout Plan
1. Add UI prototype inside `admin.html`.
2. Validate admin-only workflow on live page.
3. Observe whether admins actually use:
   - AI brief generation
   - knowledge promotion
4. If adoption is strong, add persistence for Laboon sessions and backlinks between systems.
