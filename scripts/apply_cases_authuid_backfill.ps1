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

Write-Host "== Cases authUid live backfill =="
Write-Host "Repo: $repoRoot"
Write-Host ""
Write-Host "This script will run the LIVE backfill:"
Write-Host "npm run backfill:cases-authuid -- --apply"
Write-Host ""
Write-Host "Run this only after:"
Write-Host "1. dry-run output has been reviewed"
Write-Host "2. Firestore rules are deployed"
Write-Host "3. LIFF production QA has passed"
Write-Host ""

Confirm-Step "Proceed with LIVE cases authUid backfill?"

Set-Location $functionsDir
npm run backfill:cases-authuid -- --apply

Write-Host ""
Write-Host "Live backfill finished."
