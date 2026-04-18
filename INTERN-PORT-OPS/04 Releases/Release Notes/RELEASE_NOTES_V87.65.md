# RELEASE NOTES - V87.65

## Gemini 3.1 Series Upgrade (April 2026)
Successfully upgraded the AI backbone to support the latest Gemini 3.1 flagship models, released in early 2026.

### 1. New Model Support
* **Gemini 3.1 Pro**: Integrated for complex reasoning, multi-step analysis, and advanced coding.
* **Gemini 3.1 Flash**: Now the default for high-speed, cost-efficient tasks like summaries and quick lookups.
* **Gemini 3.1 Deep Think**: Added as an experimental option for highly Logical/Research tasks.

### 2. Dynamic Server-Side Routing
* Updated the `callAIProxy` Firebase Function to dynamically route Gemini requests.
* Removed hardcoded dependencies on Gemini 1.5, allowing the system to seamlessly support current and future Gemini iterations via simple model strings.

### 3. UI Alignment
* Updated the **AI Digital Hub** and **AI Analyzer** dropdowns to offer these new flagship choices by default.
* Refined model descriptions to guide users on the strengths of the 3.1 series.

---
*MedLifePlus Internship Admin Portal Development | 2026 Stable Build*
