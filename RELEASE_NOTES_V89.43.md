# Release Notes (V89.43) - Merging Utility Fixes

## 🛠 Fixes & Improvements
- **Merge Button Visibility Fix:** Resolved an issue where the "Merge" button (`🔗`) inside the Users table was invoking the popup using a raw DOM display manipulation (`style.display = 'flex'`).
- **Modal Lifecycle Update:** The User Merger popup (`mergeModal`) has been fully integrated into the global `forceShowModal()` and `forceHideModal()` lifecycle, preventing it from being blocked or disappearing when other elements overwrite the display states.
- **Global Version Sync:** Bumped `admin.html`, `index.html`, `SYSTEM_OVERVIEW.md`, and `VERSION_SYNC_POLICY.md` to version **V89.43**.
- **Cross-origin Opaque Block Notes:** The terminal errors related to `OpaqueResponseBlocking` correctly identified as third-party LINE avatar image constraints (benign and expected).

## 🗃 Git & Deployment
- Committed and pushed to `main` branch.
- Committed and pushed to `production` branch.
