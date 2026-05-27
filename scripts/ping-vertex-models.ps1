# ping-vertex-models.ps1
#
# Keep-alive smoke test for Gemini models restricted by Google's 90-day rule
# (effective 2026-06-15 for new/inactive projects). A project is considered
# "active" per-model when it has issued at least one Vertex generateContent
# call to that model in the last 90 days. None of these three models are
# wired into any chip in this codebase today — this script exists so we can
# manually preserve access in case we want to use them later.
#
# Project: intern-port-edfa7   Region: us-central1
#
# Prereqs (one-time):
#   gcloud auth login
#   gcloud config set project intern-port-edfa7
#
# Usage:
#   .\scripts\ping-vertex-models.ps1
#
# Note: the recurring keep-alive is handled by the `pingRestrictedGeminiModels`
# Cloud Function (every 60 days). This script is the manual fallback.

$ErrorActionPreference = 'Stop'

$PROJECT = 'intern-port-edfa7'
$REGION  = 'us-central1'

try {
    $TOKEN = gcloud auth print-access-token 2>$null
    if (-not $TOKEN) { throw 'empty token' }
} catch {
    Write-Host 'gcloud auth print-access-token failed. Run `gcloud auth login` first.' -ForegroundColor Red
    exit 1
}

$MODELS = @(
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3-flash-preview'
)

$body = @{
    contents         = @(@{ role = 'user'; parts = @(@{ text = 'ping' }) })
    generationConfig = @{ maxOutputTokens = 8 }
} | ConvertTo-Json -Depth 10 -Compress

$failed = 0
foreach ($m in $MODELS) {
    $uri = "https://$REGION-aiplatform.googleapis.com/v1/projects/$PROJECT/locations/$REGION/publishers/google/models/${m}:generateContent"
    Write-Host ("Pinging {0,-32} ... " -f $m) -NoNewline
    try {
        $null = Invoke-RestMethod -Method Post -Uri $uri `
            -Headers @{ Authorization = "Bearer $TOKEN"; 'Content-Type' = 'application/json' } `
            -Body $body -ErrorAction Stop
        Write-Host 'OK' -ForegroundColor Green
    } catch {
        $failed++
        $status = $null
        try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
        $statusLabel = if ($status) { $status } else { 'no-response' }
        Write-Host ("FAIL ({0}) — {1}" -f $statusLabel, $_.Exception.Message) -ForegroundColor Red
    }
}

if ($failed -gt 0) {
    Write-Host "`n$failed of $($MODELS.Count) ping(s) failed." -ForegroundColor Yellow
    exit 1
}
Write-Host "`nAll $($MODELS.Count) models pinged successfully — 90-day window reset." -ForegroundColor Green
