# Release Notes: V89.99 (AI Model Stabilization)
**Date:** April 13, 2026
**Focus:** Resolving AI Proxy 404s and Consolidating System Versioning.

## 🚀 Key Changes

### 1. AI Infrastructure Refactoring
*   **Resolved 404 Errors:** Replaced deprecated/placeholder model names (`gemini-3-flash`, `gpt-5.4`) with stable, production-ready identifiers.
*   **Unified Model Selection:**
    *   **Laugh Tale / AI Hub:** Switched to `gemini-1.5-flash-latest` and `gpt-4o-mini`.
    *   **AI Tagging:** Standardized on `gemini-1.5-flash-latest` for speed.
    *   **AI Quiz Analyzer:** Upgraded default reasoning to `gemini-1.5-pro-latest`.
    *   **AI Translation:** Now uses `gemini-1.5-flash-latest` for efficient multi-lingual processing.
*   **JS Fallback Resilience:** Hardcoded fallback values in analysis and brainstorming functions have been updated to prevent "undefined" or "model not found" errors when UI components are bypassed.

### 2. Branding & Version Sync
*   **Global Version Alignment:** Synchronized version strings across all core files to **V89.99**.
*   **UI Polish:** Updated version badges in the Admin Dashboard and AI analysis reports.
*   **Documentation:** Updated `SYSTEM_OVERVIEW.md` with the latest session logs and development rules.

## 🛠 Fixes & Improvements
*   Updated Storyteller modal to use consistent `latest` suffix for Gemini models.
*   Resolved inconsistent model naming in the `descriptions` mapping for the AI Help box.
*   Fixed a baseline discrepancy where analysis popups displayed outdated version metadata.

## ⚠️ Important Notes
*   **AI Proxy Dependency:** All AI calls route through `mlp-int.work/api/ai`. Ensure the server is white-listed for outgoing requests.
*   **Cache Clear:** Administrators are advised to perform a hard refresh (`Ctrl + F5`) to ensure the new model mappings are loaded correctly.

---
*Created by Antigravity AI - Intern Port Ops.*
