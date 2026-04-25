---
type: runbook
status: active
owner: intern-port-team
updated: 2026-04-23
---

# Runbook: Cases authUid Migration

## Goal

Migrate legacy `cases` documents that only contain `userId` so the runtime can safely move to owner-based reads using Firebase Auth `auth.uid`.

## Background

- New `cases` documents now write both:
  - `userId`: effective app user id
  - `authUid`: Firebase Auth uid
- LIFF runtime now upserts `user_auth_links/{authUid}` with:
  - `authUid`
  - `effectiveUserId`
  - `rawLiffUserId`
  - `displayName`
  - `pictureUrl`
  - `providerId`
  - `lastSeenAt`
- During migration, LIFF uses dual-read for `cases`:
  - new path: `where("authUid", "==", auth.uid)`
  - legacy path: `where("userId", "==", effectiveUserId)`

## Preconditions

1. Deploy the LIFF runtime that writes `user_auth_links`.
2. Deploy Firestore rules that allow signed-in users to write only `user_auth_links/{authUid}` for their own auth uid.
3. Confirm new case submissions create `authUid` correctly.

## Safe Rollout

1. Deploy runtime and rules together.
2. Let active users open LIFF naturally for several days.
3. Monitor growth of `user_auth_links`.
4. Do not remove dual-read yet.

## Backfill Strategy

Only backfill records when there is a clear mapping from legacy `cases.userId` to exactly one known auth uid.

### Mapping source

Use `user_auth_links` as the source of truth for migration.

### Matching logic

1. Read all `user_auth_links`.
2. Build a lookup by `effectiveUserId`.
3. For each `cases` document with missing `authUid`:
   - Find link rows where `effectiveUserId == cases.userId`
   - If exactly one auth uid exists, set `cases.authUid` to that value
   - If none exist, skip
   - If multiple auth uids exist for the same `effectiveUserId`, skip and flag for manual review

## Manual Review Queue

Keep a review list for:

- `cases` with no matching `user_auth_links`
- `cases` with more than one candidate auth uid
- suspicious old records where `userId` looks malformed or generic

Recommended review fields:

- case doc id
- legacy `userId`
- `displayName`
- `caseId`
- `timestamp`
- candidate auth uids

## Admin Script Requirements

The one-off migration script should:

1. Run with Admin SDK
2. Update only docs where `authUid` is missing
3. Write a dry-run summary first
4. Log:
   - total legacy docs scanned
   - docs updated
   - docs skipped: no mapping
   - docs skipped: ambiguous mapping
5. Support rerun safely

## One-off Script

Location:

- `functions/scripts/backfill_cases_auth_uid.js`

Command:

```bash
cd functions
npm run backfill:cases-authuid
```

Live apply:

```bash
cd functions
npm run backfill:cases-authuid -- --apply
```

Useful options:

- `--limit=50` limits scan size for a small rehearsal
- `--verbose` prints each updated doc during live run

Script behavior:

- updates only `cases` docs with missing `authUid`
- uses `user_auth_links` as the only backfill source
- writes:
  - `authUid`
  - `authUidBackfilledAt`
  - `authUidBackfillSource: "user_auth_links"`
- prints a JSON summary for audit trail

## Validation Checklist

After dry-run:

- Sample at least 10 proposed updates manually
- Verify each sampled `cases.userId` matches `user_auth_links.effectiveUserId`
- Confirm no sampled update would overwrite an existing `authUid`

After live run:

- Open LIFF as a migrated user and confirm old cases still appear
- Confirm new case submissions still appear
- Confirm admin dashboard can still read all cases
- Count remaining `cases` without `authUid`

## Pre-deploy QA Checklist

Before deploy:

- Confirm source/public runtime files were updated together
- Confirm Firestore rules include `user_auth_links` and legacy `cases` read bridge
- Run dry-run backfill and review summary counts
- Verify dry-run sample updates look correct
- Verify dry-run skipped ambiguous list is not unexpectedly large

After deploy:

- Open LIFF as an existing user with legacy cases and confirm old cases still appear
- Submit a new case and confirm it appears immediately
- Confirm the new case doc contains `authUid`
- Confirm `user_auth_links/{authUid}` is created or updated after LIFF login
- Confirm admin dashboard can still read and review cases
- Confirm discussion comments still load and post for authenticated users
- Confirm certificate/analytics notification flows still create `admin_notifications`

## Exit Criteria

Dual-read can be removed only when:

1. New writes have been stable in production
2. Remaining `cases` without `authUid` are either zero or explicitly accepted as admin-only archive
3. Manual review queue is resolved or documented

## Rollback

If migration causes user-visible regressions:

1. Keep rules as-is for new writes
2. Restore LIFF legacy read path by `userId`
3. Stop live backfill
4. Review migration logs before retrying

## Do Not

- Do not backfill by `displayName` alone
- Do not backfill by `pictureUrl` alone
- Do not assume anonymous auth uid is stable across reinstalls or cleared storage
- Do not remove dual-read before mapping coverage is proven
