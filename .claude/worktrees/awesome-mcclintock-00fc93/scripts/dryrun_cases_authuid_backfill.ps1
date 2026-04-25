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

Write-Host "== Cases authUid dry-run backfill =="
Write-Host "Repo: $repoRoot"
Write-Host ""
Write-Host "This script will run:"
Write-Host "1. npm run backfill:cases-authuid -- --limit=50"
Write-Host "2. npm run backfill:cases-authuid"
Write-Host ""
Write-Host "Review the summary before any deploy or live backfill."
Write-Host ""

Confirm-Step "Proceed with dry-run rehearsal and full dry-run?"

Set-Location $functionsDir

Write-Host ""
Write-Host "== Dry-run rehearsal (limit 50) =="
npm run backfill:cases-authuid -- --limit=50

Write-Host ""
Write-Host "== Full dry-run =="
npm run backfill:cases-authuid

Write-Host ""
Write-Host "Dry-run sequence finished."
