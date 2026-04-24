Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = "d:\20250728OD\OneDrive\Apps\WEBAPP\INTERN-PORT"
$functionsDir = Join-Path $repoRoot "functions"

function Confirm-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $answer = Read-Host "$Message [y/N]"
    if ($answer -notin @("y", "Y", "yes", "YES", "Yes")) {
        throw "Stopped by user."
    }
}

Write-Host "== Cases authUid migration rollout =="
Write-Host "Repo: $repoRoot"

Set-Location $repoRoot

Write-Host ""
Write-Host "== Git status =="
git status --short

Write-Host ""
Write-Host "== Dry-run rehearsal (limit 50) =="
Set-Location $functionsDir
npm run backfill:cases-authuid -- --limit=50

Write-Host ""
Write-Host "== Full dry-run =="
npm run backfill:cases-authuid

Set-Location $repoRoot

Write-Host ""
Write-Host "== Deploy Firestore rules =="
Confirm-Step "Proceed with firebase deploy --only firestore:rules?"
firebase deploy --only firestore:rules

Write-Host ""
Write-Host "== Stage rollout files =="
git add -- firestore.rules index.html public/index.html functions/package.json functions/scripts/backfill_cases_auth_uid.js "INTERN-PORT-OPS/06 Runbooks/Runbook-Cases-AuthUid-Migration.md" "INTERN-PORT-OPS/06 Runbooks/Runbook-Cases-AuthUid-Deploy-Sequence.md" "scripts/deploy_cases_authuid_migration.ps1"

Write-Host ""
Write-Host "== Commit rollout =="
Confirm-Step "Proceed with git commit?"
git commit -m "feat: add cases authUid migration bridge and backfill tooling"

Write-Host ""
Write-Host "== Push production =="
Confirm-Step "Proceed with git push origin production?"
git push origin production

Write-Host ""
Write-Host "Rollout sequence completed."
Write-Host "QA should be completed before any live backfill."
Confirm-Step "Do you want to print the live backfill command now?"
Write-Host "Run the live backfill only after reviewing dry-run output and production QA:"
Write-Host "cd /d `"$functionsDir`""
Write-Host "npm run backfill:cases-authuid -- --apply"
