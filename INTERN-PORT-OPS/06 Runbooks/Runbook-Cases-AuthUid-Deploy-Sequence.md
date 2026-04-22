---
type: runbook
status: active
owner: intern-port-team
updated: 2026-04-23
---

# Runbook: Cases authUid Deploy Sequence

## Purpose

Copy-paste deployment and dry-run sequence for the `cases.authUid` migration rollout.

## Pre-check

Run from repo root:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
git status --short
```

## Dry-run Sequence

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT\functions"
npm run backfill:cases-authuid -- --limit=50
npm run backfill:cases-authuid
```

Or use the guarded PowerShell helper:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
powershell -ExecutionPolicy Bypass -File ".\scripts\dryrun_cases_authuid_backfill.ps1"
```

Review the dry-run summary before any deploy or live backfill.

## Deploy Sequence

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
firebase deploy --only firestore:rules
git add -- firestore.rules index.html public/index.html functions/package.json functions/scripts/backfill_cases_auth_uid.js "INTERN-PORT-OPS/06 Runbooks/Runbook-Cases-AuthUid-Migration.md" "INTERN-PORT-OPS/06 Runbooks/Runbook-Cases-AuthUid-Deploy-Sequence.md" "scripts/deploy_cases_authuid_migration.ps1"
git commit -m "feat: add cases authUid migration bridge and backfill tooling"
git push origin production
```

## Live Backfill

Only run after:

1. dry-run summary looks correct
2. rules are deployed
3. LIFF smoke checks pass

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT\functions"
npm run backfill:cases-authuid -- --apply
```

Or use the guarded PowerShell helper:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
powershell -ExecutionPolicy Bypass -File ".\scripts\apply_cases_authuid_backfill.ps1"
```

## Post-deploy QA

- Open LIFF as an existing user with legacy `cases` and confirm old cases still appear
- Submit one new case and confirm it appears immediately
- Confirm the new case doc contains `authUid`
- Confirm `user_auth_links/{authUid}` is created or updated
- Confirm admin dashboard can still read and review cases
- Confirm discussion comments still load and post
- Confirm certificate and analytics flows still create `admin_notifications`

## Notes

- Run dry-run before live backfill every time
- Do not run `--apply` until ambiguous and no-link counts are understood
- Keep dual-read in place until migration coverage is acceptable

## Recommended Operator Flow

1. Run dry-run helper:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
powershell -ExecutionPolicy Bypass -File ".\scripts\dryrun_cases_authuid_backfill.ps1"
```

2. Run deploy helper or manual deploy sequence:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
powershell -ExecutionPolicy Bypass -File ".\scripts\deploy_cases_authuid_migration.ps1"
```

3. Complete post-deploy QA in production.

4. Run live apply helper only after QA passes:

```powershell
cd /d "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
powershell -ExecutionPolicy Bypass -File ".\scripts\apply_cases_authuid_backfill.ps1"
```
