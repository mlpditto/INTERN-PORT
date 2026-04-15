# Release Notes: V90.33 (Timing Telemetry and Config Profiles)
**Date:** April 15, 2026
**Focus:** Strengthen quiz anti-cheat analytics with per-question behavior telemetry, active-time normalization, and profile-based threshold configuration.

## Key Updates

### 1. Enhanced Quiz Timing Telemetry
- Added per-question telemetry capture in runtime:
  - `durations` (raw seconds per question)
  - `durationsActive` (seconds excluding inactive/hidden/blur periods)
  - `answerChangeCounts` (interaction count per question)
  - `firstAnswerLatencySec` (time to first interaction per question)
- Added inactive-session tracking hooks (tab hidden, blur/focus) to reduce false positives from background time.
- Ensured telemetry state is initialized/reset safely across quiz start/submit/close flows.

### 2. Admin Review Telemetry UI
- Added per-question telemetry badges in review modal for faster examiner interpretation.
- Added timing summary panel with anomaly indicators:
  - active/raw ratio
  - suspiciously short first-answer latency
  - high answer-change intensity
- Added risk-level presentation to make manual review consistent.

### 3. Profile-Based Timing Configuration
- Added persistent timing config with profile model:
  - `practice`
  - `exam`
  - `final`
- Added active-profile selection and profile-aware summary evaluation.
- Added modal-based config editor with save/reset actions.
- Added helper tooltips for each configuration field.
- Added Firestore-backed config persistence with local fallback cache.

## Deployment Surface Sync
The release is synchronized across all required runtime targets:
- `admin.html`
- `index.html`
- `public/admin.html`
- `public/index.html`
- `netlify-deploy/admin.html`
- `netlify-deploy/index.html`

## Documentation Sync
- Updated `SYSTEM_OVERVIEW.md` to latest version reference (V90.33).

## Compatibility Notes
- Non-breaking telemetry extensions: new fields are additive on attempt payloads.
- Legacy attempts remain readable in admin (summary logic normalizes missing fields).
- No backend migration required.

## Validation
- Version markers updated to a single shared release version (`V90.33`) in required targets.
- Runtime/admin changes previously validated in editor diagnostics during implementation.

---
Created by GitHub Copilot for production release tracking.
