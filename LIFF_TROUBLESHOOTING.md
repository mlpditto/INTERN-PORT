# 🚀 LIFF Initialization & Troubleshooting Guide

This document outlines the architecture of the LINE Front-end Framework (LIFF) integration in the **INTERN-PORT** project and provides a checklist for resolving common initialization failures.

## 🏗️ Architecture Overview

The application follows a staged boot process to ensure the LIFF SDK is fully loaded before any application logic executes.

### 1. SDK Loading
The SDK is imported via a CDN script tag in the `<head>` of `index.html`:
```html
<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
```

### 2. Bootstrap Watchdog (`bootstrapMain`)
Located at the very end of the main `<script>` block. It acts as a watchdog to ensure `window.liff` is available.
- **Trigger**: Runs on `document.readyState === 'complete'` or `interactive`.
- **Validation**: Checks if `window.liff` exists.
- **Failover**: If missing, it updates the status to `❌ SDK Failed to Load` and triggers a full page reload after 15 seconds.

### 3. Main Execution (`main`)
The primary entry point for the app logic.
- **Timeout Protection**: Includes a 15-second timeout via `Promise.race([liff.init(), timeoutPromise])`.
- **Identity Check**: Verifies if the user is logged in (`liff.isLoggedIn()`).
- **Authorization**: Fetches the profile and redirects to the appropriate portal.

---

## 🛠️ Troubleshooting Checklist

If the app hangs at "Starting...", follow these steps:

### 1. Check for Syntax Errors
In large monolithic files like `index.html`, a single syntax error anywhere in the script block will prevent the entire script from executing.
- **Diagnosis**: Run `node --check index.html` (after extracting the script part) or check the Browser Console (`F12`).
- **Common culprit**: Unclosed backticks (`` ` ``) or template literals in the UI rendering functions.

### 2. Verify LIFF ID
Ensure the LIFF IDs are consistent across all environments:
- **Project ID**: `2008959998-yjcNpaGt`
- **Location**: `const USER_LIFF_ID` in `index.html`.

### 3. Network & CDN Issues
- If the loading status shows `❌ SDK Failed to Load`, the LIFF CDN may be blocked or unreachable.
- Test by opening [https://static.line-scdn.net/liff/edge/2/sdk.js](https://static.line-scdn.net/liff/edge/2/sdk.js) directly.

### 4. Browser Cache
- On mobile, the LINE internal browser often caches old versions of the script.
- **Fix**: Use "Open in Browser" from the LINE menu to bypass the cache.

---

## 📝 Best Practices for Future Updates
- **Keep `bootstrapMain` at the bottom**: This ensures all functions used within it (like `main()`) are already parsed and hoisted.
- **Use `try-catch`**: Always wrap the initialization calls in `try-catch` blocks to provide visual feedback to the user if something fails.
- **Update Version Strings**: Keep version numbers (e.g., `V89.81`) in the `updateStatus` calls synchronized with your release to verify which code is actually running.

*(Created: 2026-04-12 - LIFF Stability Patch)*
