# 📝 Release Notes V87.91 - AI Stability Update

## 🚀 Overview
Version **V87.91** focuses on resolving critical AI-related errors that were preventing stable functionality in the Admin Portal. These include correct mapping for unversioned Gemini models, fixing OpenAI JSON parameter conflicts with reasoner (o1) models, and clarifying network-related security errors.

## 🛠️ Key Improvements

### 1. 🤖 Gemini API 404 Resolution
- **Fix**: The Gemini API (v1beta) now strictly requires model IDs to have a version suffix.
- **Change**: All internal calls to `gemini-1.5-flash` have been redirected to `gemini-1.5-flash-latest`.
- **Case Sensitivity**: Model mapping in `callUniversalAI` is now case-insensitive, ensuring that user selection in the UI (e.g. "Gemini") is correctly translated to the SDK-standard ID.

### 2. 🧠 OpenAI & Reasoner (o1) Parameter Fixes
- **JSON Compatibility**: Fixed the error `Invalid parameter: 'response_format' of type 'json_object'`. This was caused by sending JSON-mode parameters to reasoner models (`o1`, `gpt-5.4` placeholder) which do not support them.
- **Max Tokens Stability**: Corrected the `Invalid type for 'max_tokens'` error. The request structure now ensures either `max_tokens` or `max_completion_tokens` is sent as a precise numeric value, preventing validation failures.
- **Model Mapping**: Updated UI placeholders `gpt-5.4` and `gpt-5.4-mini` to point to stable, existing models (`gpt-4o` and `gpt-4o-mini`) until actual next-gen models are available.

### 3. 🌐 Improved Network Error Reporting
- **CORS Clarity**: Enhanced the error message for `NetworkError` to explain that browser security (CORS) is blocking direct AI requests.
- **Correction**: This directs users to ensure they are utilizing the server-side **Proxy** instead of local browser keys where possible.

### 4. 🔮 Vision Scanner Optimization
- **Clean Base64**: The server-side proxy now automatically strips data prefixes (e.g. `data:image/png;base64,`) from image data before sending to Vertex AI, ensuring stable multimodal processing.

## 📦 Files Modified
- `admin.html`: (V87.91) Core UI & Fallback logic updates.
- `functions/index.js`: Server-side proxy enhancements for stable model mapping.
- `firebase.json`: (Verified) Rewrite configuration for `/api/ai`.

---
*Created by Antigravity AI on 2026-04-02*
