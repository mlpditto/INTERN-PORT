# RELEASE NOTES V90.41

Date: 2026-04-16
Branch: production

## Summary
Podcast Studio now supports optional backup to Google Drive while keeping Firebase Storage as the primary source.

## Changes
- Added **optional Google Drive backup toggle** in Podcast Recorder modal.
- Added **Google Drive Folder ID** input for backup destination (optional).
- Extended Google OAuth scope to support file write for backup flow:
  - `https://www.googleapis.com/auth/drive.file`
- Added token utility flow for write operations without interfering with existing Drive Picker behavior.
- On publish:
  - Uploads episode audio to Firebase Storage (primary)
  - Optionally uploads the same audio blob to Google Drive (backup)
  - Stores backup metadata and status in Firestore (`ok`, `pending`, `failed`, `disabled`)
- Added backup status indicator in podcast episode list UI.
- On episode delete:
  - Deletes Firebase Storage file
  - Attempts to delete associated Google Drive backup file

## Data Notes
- Firestore `podcasts` document now may include:
  - `backupEnabled`
  - `gdriveBackupStatus`
  - `gdriveBackupFileId`
  - `gdriveBackupFileName`
  - `gdriveBackupWebViewLink`
  - `gdriveBackupFolderId`
  - `gdriveBackupError`
- Existing episodes remain compatible; backup fields are optional.

## Scope
- Implemented in `admin.html`.
- Existing Firebase-first publish behavior remains unchanged when backup is disabled.

## Deployment Artifact
- Commit: `b6bc080`
- Message: `V90.41: Add optional Google Drive backup for Podcast episodes`
- Remote: `origin/production`

## Notes
- Google Drive backup depends on valid Drive OAuth/API config.
- If Drive backup fails, publish still succeeds via Firebase Storage and status is marked as failed.
