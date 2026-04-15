# 🔋 Token Optimization Guide for INTERN-PORT

**Purpose:** Maximize productivity while minimizing token consumption in AI-assisted development.

**Budget:** 200,000 tokens per session
**Goal:** Extend sessions from 25-50 operations to 150-200+ operations

---

## 📊 Token Cost Reference

### Standard Operations
| Operation | Estimated Cost | Remarks |
|-----------|---------------|---------|
| Simple message | 50-200 tokens | User query or short response |
| Code response | 100-1,000 tokens | Varies by length and complexity |
| `read_file` (100 lines) | 300-500 tokens | 3-5 tokens per line |
| `read_file` (1,000 lines) | 3,000-5,000 tokens | ⚠️ Expensive! Avoid reading entire files |
| `grep_search` | 100-300 tokens | Highly efficient for locating code |
| `replace_string_in_file` | 200-500 tokens | Depends on changed line count |
| `multi_replace_string_in_file` (3 changes) | 400-600 tokens | 50% savings vs 3 individual calls |
| `get_errors` | 100-200 tokens | Fast validation without reading files |
| Tool invocation overhead | 50-100 tokens per call | Fixed cost per tool use |

### Real-World Example: Badge System Implementation
```
❌ INEFFICIENT (Estimated 15,000 tokens):
  read_file(index.html, 1-5000)                    4,000 tokens
  read_file(public/index.html, 1-5000)             4,000 tokens
  read_file(netlify-deploy/index.html, 1-5000)     4,000 tokens
  replace_string_in_file (3 separate calls)        1,500 tokens
  wait for validation feedback                      costs time
  ─────────────────────────────────────────────────────────
  Total: ~15,000 tokens + longer iteration cycle

✅ EFFICIENT (Estimated 1,500 tokens):
  grep_search("collectReflectiveMetrics")            100 tokens
  read_file(index.html, 4121-4220)                  250 tokens
  read_file(public/index.html, line range)          250 tokens
  read_file(netlify-deploy/index.html, line range)  250 tokens
  multi_replace_string_in_file (3 changes)          400 tokens
  get_errors (batch validation)                     100 tokens
  ─────────────────────────────────────────────────────────
  Total: ~1,350 tokens (90% savings!) + faster iteration
```

---

## 🎯 Three Core Strategies

### Strategy 1️⃣: Use `grep_search` Instead of Multiple `read_file` Calls

**When to use:** Looking for where code is located, finding function definitions, or identifying patterns

#### ❌ Inefficient Approach
```javascript
// Reading entire file sections blindly
read_file(index.html, 1-100)    // Maybe the function is here?
read_file(index.html, 100-200)  // Or here?
read_file(index.html, 200-300)  // Or here?
// Total: 900 tokens for uncertainty
```

#### ✅ Efficient Approach
```bash
grep_search(
  query: "collectReflectiveMetrics|syncReflectiveGamification",
  isRegexp: true,
  includePattern: "index.html"
)
// Result: Found at lines 4121-4219 (50-100 tokens)
// Now read only that specific range with confidence!
```

#### Real Example from INTERN-PORT
```javascript
// Task: Find all places where badge modal is opened
grep_search(
  query: "openReflectiveBadgeModal|reflectiveBadgeModal",
  isRegexp: true
)

// ✅ Quick result: 
//   - Line 846: Button click handler
//   - Line 1192: Modal HTML element
//   - Line 4199: Function definition

// Now read ONLY these specific ranges:
read_file(index.html, 840-855)    // 15 lines
read_file(index.html, 1190-1200)  // 10 lines
read_file(index.html, 4195-4220)  // 25 lines
// Total: 50 lines = ~150 tokens (vs 5000 lines = 5000 tokens)
```

#### Patterns to Search
```javascript
// Badge system
grep_search("reflectiveBadge|collectReflectiveMetrics|syncReflectiveGamification")

// Leaderboard system  
grep_search("renderLeaderboard|switchLeaderboardMode|reflectiveLeaderboard")

// Reflective logs
grep_search("renderReflectiveLogs|reflectiveMetrics")

// Firebase operations
grep_search("users.doc|merge:|batch.set")
```

---

### Strategy 2️⃣: Use `multi_replace_string_in_file` (Batch Changes)

**When to use:** Making changes to multiple files or multiple functions in parallel

#### ❌ Inefficient Approach (3 Sequential Calls)
```javascript
// Call 1
replace_string_in_file(
  filePath: "index.html",
  oldString: "...", 
  newString: "..."
)
// 400 tokens

// Wait for result...

// Call 2  
replace_string_in_file(
  filePath: "public/index.html",
  oldString: "...",
  newString: "..."
)
// 400 tokens

// Wait for result...

// Call 3
replace_string_in_file(
  filePath: "netlify-deploy/index.html",
  oldString: "...",
  newString: "..."
)
// 400 tokens

// Total: 1,200 tokens + 3x iteration time
```

#### ✅ Efficient Approach (1 Batch Call)
```javascript
multi_replace_string_in_file(
  explanation: "Fix collectReflectiveMetrics logic in all 3 deployment targets",
  replacements: [
    {
      filePath: "index.html",
      oldString: "...",
      newString: "..."
    },
    {
      filePath: "public/index.html",
      oldString: "...",
      newString: "..."
    },
    {
      filePath: "netlify-deploy/index.html",
      oldString: "...",
      newString: "..."
    }
  ]
)

// Total: ~600 tokens (50% savings!) + instant parallel execution
```

#### Real Example Template for INTERN-PORT
```javascript
multi_replace_string_in_file(
  explanation: "Sync reflective badge & leaderboard updates across all deployments",
  replacements: [
    // Fix 1: Badge metric calculation
    {
      filePath: "index.html",
      oldString: `    // OLD: collectReflectiveMetrics
    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... old logic
    }`,
      newString: `    // NEW: collectReflectiveMetrics with optimized streak
    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... new logic
    }`
    },
    
    // Fix 2: Same change on public deployment
    {
      filePath: "public/index.html",
      oldString: `    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... old logic
    }`,
      newString: `    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... new logic
    }`
    },
    
    // Fix 3: Same change on netlify backup
    {
      filePath: "netlify-deploy/index.html",
      oldString: `    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... old logic
    }`,
      newString: `    function collectReflectiveMetrics(logs) {
      let totalLogs = logs.length;
      // ... new logic
    }`
    }
  ]
)
```

---

### Strategy 3️⃣: Fix Specific Errors Instead of Reading Entire Files

**When to use:** Debugging issues, validating code changes, or responding to errors

#### ❌ Inefficient Approach (Blind Reading)
```javascript
// Encountered a build error but don't know where
read_file(index.html, 1-5000)         // 2,500 tokens
read_file(public/index.html, 1-5000)  // 2,500 tokens  
// Total: 5,000 tokens for vague information
```

#### ✅ Efficient Approach (Targeted Diagnosis)
```javascript
// Step 1: Get exact error locations
get_errors([index.html, public/index.html, netlify-deploy/index.html])
// Result: "Syntax error at index.html:3421 - Missing closing brace in collectReflectiveMetrics"
// Cost: 100-200 tokens

// Step 2: Read ONLY the problematic area
read_file(index.html, 3410-3440)  // 30 lines = 100 tokens
// Shows: Lines 3415-3425 contain the error

// Step 3: Fix specific issue
replace_string_in_file(
  filePath: index.html,
  oldString: `    function collectReflectiveMetrics(logs) {
      // ... 20 lines of code ...
    // MISSING: closing brace
`
  newString: `    function collectReflectiveMetrics(logs) {
      // ... 20 lines of code ...
    }  // Fixed: added closing brace
`
)
// Cost: 200 tokens

// Total: ~400 tokens (92.5% savings vs blind reading!)
```

#### Error Diagnosis Workflow
```javascript
// Phase 1: Validation
get_errors()  
→ "ReferenceError: collectReflectiveMetrics not defined (line 4350)"

// Phase 2: Surgical diagnosis
read_file(index.html, 4340-4360)
→ "Oh, the function is called before it's defined!"

// Phase 3: Targeted fix
replace_string_in_file(
  // Move function definition earlier in file
)
```

---

## 📋 Best Practice Workflow for INTERN-PORT

### Scenario 1: Adding New Feature
```javascript
// ✅ Efficient Token Usage

// 1. Locate integration points (grep is cheap!)
grep_search("renderReflectiveLogs", includePattern: "index.html")
→ 100 tokens, shows exact line numbers

// 2. Read context around integration point (focused read)
read_file(index.html, 4345-4360)
→ 50 tokens, get just 15 lines

// 3. Implement changes (single operation)
replace_string_in_file(...)
→ 300 tokens

// 4. Validate (fast error check, no full file read)
get_errors([index.html])
→ 100 tokens

// Total: 550 tokens ✅
```

### Scenario 2: Hotfix Across All 3 Deployments
```javascript
// ✅ Efficient Token Usage

// 1. Quick search to understand scope
grep_search("syncReflectiveGamification")
→ 100 tokens, confirms function exists in all 3

// 2. Read function once to understand it
read_file(index.html, 4280-4310)
→ 100 tokens

// 3. Batch fix across all files
multi_replace_string_in_file([
  { filePath: "index.html", change },
  { filePath: "public/index.html", change },
  { filePath: "netlify-deploy/index.html", change }
])
→ 400 tokens (vs 1,200 if done separately)

// 4. Validate all changes
get_errors([index.html, public/index.html, netlify-deploy/index.html])
→ 150 tokens

// Total: 750 tokens ✅ (vs ~2,000+ the slow way)
```

### Scenario 3: Debugging User Report (Leaderboard Shows Wrong Scores)
```javascript
// ✅ Efficient Token Usage

// 1. Smart search for leaderboard code
grep_search("renderLeaderboard.*reflective|leaderboardMode.*score")
→ 100 tokens, pinpoints the rendering logic

// 2. Read only the rendering function
read_file(index.html, 2118-2165)
→ 120 tokens, see exactly how both modes work

// 3. Diagnose issue (if filter is wrong)
// Check: does it filter by reflectiveTotalLogs for reflective mode?
// Result: Found the bug on line 2135

// 4. Fix specific line
replace_string_in_file(
  oldString: `if (leaderboardMode === 'reflective') {
    return allUsersData.filter(u => u.score > 0)  // WRONG!
  }`,
  newString: `if (leaderboardMode === 'reflective') {
    return allUsersData.filter(u => u.reflectiveTotalLogs > 0)  // FIXED!
  }`
)
→ 200 tokens

// Total: 520 tokens ✅
```

---

## 🗺️ INTERN-PORT Code Navigation (For Efficient Searching)

### Key File Sections (Bookmark These!)
```
index.html:
  ├─ Line 1192-1198: Reflective Badge Modal HTML
  ├─ Line 846-853: Badge collection section
  ├─ Line 1170-1179: Leaderboard mode toggle buttons
  ├─ Line 2099-2115: switchLeaderboardMode() function
  ├─ Line 2118-2165: renderLeaderboard() function (both modes)
  ├─ Line 4099-4119: reflectiveBadgeCatalog definition
  ├─ Line 4121-4219: collectReflectiveMetrics() function
  ├─ Line 4220-4257: renderReflectiveMiniLeaderboard() function
  ├─ Line 4280-4310: syncReflectiveGamification() function
  └─ Line 4350-4395: renderReflectiveLogs() function (enhanced)

public/index.html & netlify-deploy/index.html:
  └─ Same line ranges as index.html (synchronized)

Global Variables (early in file):
  ├─ leaderboardMode = 'score'
  ├─ reflectiveGamificationSyncKey = ''
  └─ reflectiveBadgeCatalog = [...]
```

### Search Patterns for Common Tasks
```javascript
// Find where leaderboard is rendered
grep_search("renderLeaderboard\\(")

// Find all badge-related code
grep_search("reflectiveBadge|Badge.*unlock|badgeCatalog")

// Find sync operations
grep_search("syncReflective|merge:\\s*true")

// Find Firebase listeners
grep_search("onSnapshot|allUsersData.*=")

// Find UI updates
grep_search("renderReflective|openLeaderboard|switchLeaderboard")
```

---

## ⚡ Quick Reference: Token Budget Allocation

**For 200,000 tokens:**
```
Efficient Workflow
├─ 150-200 feature implementations (150-200 tokens each)
├─ 300-400 debugging/optimization tasks (300-400 tokens each)
├─ 500-1000 infrastructure changes (500-1000 tokens each)
└─ 50-100 validation/checks (50-100 tokens each)

Poor Workflow
├─ 25-50 tasks before token exhaustion
└─ Much longer iterations due to full file reads
```

---

## ✅ Checklist: Before Making Changes

- [ ] **Search first:** Use `grep_search` to locate exact line numbers
- [ ] **Read focused:** `read_file` only the specific range needed (not whole file)
- [ ] **Batch edits:** If changing 2+ files, use `multi_replace_string_in_file`
- [ ] **Validate smart:** `get_errors` for targeted validation, not full file reads
- [ ] **Document:** Quick comment in code about what changed and why
- [ ] **Test locally:** Before pushing, verify in terminal or browser
- [ ] **Git commit:** Clean commit message with what was fixed/added

---

## 🎓 Examples From Real Tasks

### ✅ Good Practice (From V90.00 Implementation)
```
Task: Add badge collection to 3 files
Approach: grep_search → read function → multi_replace → get_errors
Tokens: ~1,500 ✅
Result: All 3 files updated with zero errors
```

### ❌ Wasteful Practice (Hypothetical)
```
Task: Debug leaderboard issue
Approach: read_file(index.html, 1-5000) → read_file(public, 1-5000)
Tokens: ~5,000 ❌ (before finding the problem!)
```

---

## 📞 When to Ask for Help

| Situation | Efficiency Tip |
|-----------|----------------|
| "Where does function X get called?" | Use `grep_search`, don't read whole files |
| "What's wrong with this code?" | Use `get_errors` first, then targeted `read_file` |
| "Fix the same issue in 3 files" | Use `multi_replace_string_in_file` |
| "I need to understand this whole system" | Use `grep_search` to map structure, read sections |
| "Integration seems broken" | Search for both old and new calls in context |

---

**Last Updated:** April 15, 2026  
**Applies to:** INTERN-PORT webapp project  
**Token Budget:** 200,000 per session  
**Goal:** Extend productivity to 150-200+ operations per session
