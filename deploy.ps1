param (
    [string]$message = "Sync and Deploy"
)

# 1. Update Git
Write-Host "Updating Git..."
git add .
git commit -m $message
git push origin production

# 2. Deploy to Firebase
Write-Host "Deploying to Firebase (Hosting & Functions)..."
firebase deploy --only "hosting,functions"

Write-Host "Done! URL: https://mlp-int.work/admin.html"
