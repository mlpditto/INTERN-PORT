# [WIP] Detailed Plan: Podcast Integration in LIFF

Date: 2026-04-16  
Status: Planning only (no user-facing LIFF podcast rollout in this task)

## 1) Goal

Prepare a safe, phased integration plan to surface Podcast capabilities in LIFF user flow, while keeping current production behavior unchanged until rollout gates are approved.

## 2) Scope & Non-Goals

### In Scope
- Define UX entry points in `index.html` (LIFF user app).
- Define required Firestore fields and read/write rules impact.
- Define episode lifecycle in LIFF (list, detail, playback, progress, completion).
- Define staged rollout and rollback strategy.
- Define test/verification checklist before enabling for all users.

### Out of Scope (for this WIP)
- No immediate activation of Podcast UI in LIFF.
- No forced migration of old podcast records.
- No backend rewrite unless gaps are found during implementation.

## 3) Current-State Assumptions

- Podcast authoring/publishing already exists in admin flow.
- LIFF currently does not expose Podcast UI to end users by default.
- Firebase (Firestore + Storage) remains the source of truth.

## 4) Proposed LIFF Architecture

1. **Feature Flag Gate**
   - Add a runtime flag (Remote Config or Firestore config doc) such as `features.liffPodcastEnabled`.
   - LIFF reads the flag at startup; if false, hide all Podcast UI.

2. **Data Access Layer**
   - Read podcast episode index collection (published only).
   - Read optional user progress document keyed by LIFF user id + episode id.
   - Keep reads paginated and sorted by `publishedAt desc`.

3. **UI Layer (LIFF)**
   - New collapsible section: `🎧 Podcasts` (hidden by flag).
   - Components:
     - Episode list cards (title, duration, date, status badge)
     - Episode detail sheet (summary, transcript link if allowed)
     - Audio player controls (play/pause/seek/speed)
     - Progress indicator + “continue listening”

4. **Telemetry/Observability**
   - Track events: list_view, play_start, 25/50/75/100 progress, complete.
   - Log only non-sensitive metadata.

## 5) Data Model Plan

### `podcastEpisodes` (existing/extended)
- `title`, `description`, `audioUrl`, `durationSec`, `publishedAt`, `isPublished`
- `transcriptPreview` (optional, truncated)
- `coverImageUrl` (optional)

### `podcastProgress/{userId}/episodes/{episodeId}` (new)
- `userId`
- `episodeId`
- `positionSec`
- `lastPlayedAt`
- `isCompleted`
- `completedAt` (nullable)

## 6) Security & Permissions

- Firestore rules:
  - Allow LIFF users to read only `isPublished == true` episodes.
  - Allow users to read/write only their own `podcastProgress` docs.
  - Deny writes to episode master docs from LIFF.
- Validate URL usage to prevent untrusted source playback injection.
- Keep transcripts optional and access-controlled if sensitive.

## 7) Implementation Phases

### Phase 0 — Preparation
- Finalize schema/rules diff.
- Confirm admin publish payload includes all LIFF-required fields.
- Add feature flag default = `false`.

### Phase 1 — Hidden Integration
- Implement LIFF components behind flag.
- Add loading/empty/error states.
- Add progress save throttling (e.g., every 10–15 seconds).

### Phase 2 — Internal Pilot
- Enable for limited cohort (test users/group).
- Verify playback reliability across iOS/Android LIFF webview.
- Measure read/write costs and event quality.

### Phase 3 — Gradual Rollout
- Ramp from small cohort to full audience.
- Monitor errors, playback drop-offs, and rule denials.
- Keep immediate rollback via feature flag.

## 8) Test Plan

- **Functional**
  - Episode list shows only published episodes.
  - Playback controls work after app background/foreground.
  - Resume starts from saved position.
- **Security**
  - User cannot write progress for another user.
  - Unpublished episode cannot be fetched in LIFF.
- **Resilience**
  - Graceful fallback on slow network/timeouts.
  - UI remains usable when audio source fails.
- **Regression**
  - Existing LIFF sections unaffected when podcast flag is off.

## 9) Acceptance Criteria

- Detailed design approved by product/engineering.
- Firestore rule changes reviewed and tested.
- Pilot metrics available and no critical security issues.
- Feature can be enabled/disabled instantly without redeploy.

## 10) Open Questions

- Should transcript be full, preview-only, or role-based?
- Should episode completion grant points/badges?
- Should offline caching be supported in LIFF webview constraints?
- What is the maximum transcript length allowed for mobile rendering?
