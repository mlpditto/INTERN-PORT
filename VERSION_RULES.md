# Intern Admin Portal - Version Management Rules

## 🎯 Core Rule: Always Update Version Number

### Mandatory Version Update
**EVERY commit to `admin.html` MUST include a version number update.**

No exceptions. No matter how small the change.

---

## 📍 Where to Update

### 1. HTML Title Tag
```html
<title>Intern Admin Portal (V88.73)</title>
```

### 2. Comment Header
```html
<!-- V88.73: AI Magic buttons restored + Timer widths expanded + Language flags -->
<!-- Release: 2026-04-05 19:40 UTC+7 -->
```

### 3. Version Format
- **Format:** `V[MAJOR].[MINOR].[PATCH]`
- **Example:** `V88.73`
- **Location:** Both title tag and comment header

---

## 🔄 Version Increment Rules

### PATCH Version (+0.0.1)
- Bug fixes
- Small UI improvements
- Text changes
- CSS tweaks
- API endpoint fixes

**Examples:**
- V88.73 → V88.74
- V88.74 → V88.75

### MINOR Version (+0.1.0)
- New features
- Major UI redesigns
- New AI models added
- New functionality

**Examples:**
- V88.73 → V88.80
- V88.80 → V88.90

### MAJOR Version (+1.0.0)
- Complete rewrite
- Major architecture changes
- Breaking changes
- New major modules

**Examples:**
- V88.73 → V89.0
- V89.0 → V90.0

---

## 📝 Commit Message Template

### Required Format
```bash
git commit -m "V88.74: [Brief description of change]"
```

### Examples
```bash
# Bug fix
git commit -m "V88.74: Fix Typhoon API JSON mode error"

# Small improvement
git commit -m "V88.75: Remove text from Translate button for UI consistency"

# New feature
git commit -m "V88.80: Add quiz pagination navigation arrows"
```

---

## ✅ Pre-Commit Checklist

### Before EVERY commit:
1. [ ] Update version number in `<title>` tag
2. [ ] Update version in comment header
3. [ ] Update release date/time
4. [ ] Add brief change description in comment
5. [ ] Use version in commit message

### Example Complete Update:
```html
<!-- BEFORE -->
<title>Intern Admin Portal (V88.73)</title>
<!-- V88.73: AI Magic buttons restored + Timer widths expanded + Language flags -->
<!-- Release: 2026-04-05 19:40 UTC+7 -->

<!-- AFTER -->
<title>Intern Admin Portal (V88.74)</title>
<!-- V88.74: Fix Typhoon API JSON mode + Remove duplicate Translate text -->
<!-- Release: 2026-04-05 20:15 UTC+7 -->
```

---

## 🚫 Common Mistakes to Avoid

### NEVER Do This:
- ❌ Commit without updating version
- ❌ Update only one location (title OR comment)
- ❌ Use wrong version format
- ❌ Forget release timestamp
- ❌ Use generic commit messages

### ALWAYS Do This:
- ✅ Update BOTH title and comment
- ✅ Increment version appropriately
- ✅ Add timestamp
- ✅ Describe changes briefly
- ✅ Use version in commit message

---

## 🔍 Quality Assurance

### Version Validation Script
```bash
# Check if version is updated correctly
grep -n "Intern Admin Portal" admin.html
grep -n "Release:" admin.html
```

### Pre-Push Verification
Before pushing to production:
1. Verify version is updated
2. Check commit message includes version
3. Ensure timestamp is current
4. Test functionality works

---

## 📊 Version History Tracking

### Current Version: V88.74
### Last Updated: 2026-04-05 20:15 UTC+7

### Recent Changes:
- V88.73: AI Magic buttons restored + Timer widths expanded + Language flags
- V88.74: Fix Typhoon API JSON mode + Remove duplicate Translate text

---

## 🎯 Enforcement

### Git Hooks (Recommended)
```bash
# Pre-commit hook to check version update
#!/bin/bash
if ! grep -q "V[0-9]\+\.[0-9]\+\.[0-9]\+" admin.html; then
    echo "ERROR: Version number not found or not updated!"
    exit 1
fi
```

### Code Review Checklist
- [ ] Version number updated?
- [ ] Both locations updated?
- [ ] Commit message includes version?
- [ ] Timestamp current?

---

## 🚨 Emergency Exceptions

### ONLY Skip Version Update For:
- **Hotfixes to documentation files** (README.md, *.md)
- **Git configuration changes**
- **CI/CD pipeline fixes**

### NEVER Skip For:
- ❌ Any changes to `admin.html`
- ❌ CSS changes
- ❌ JavaScript changes
- ❌ HTML structure changes
- ❌ API integration changes

---

## 📋 Quick Reference

| Change Type | Version Increment | Example |
|-------------|------------------|---------|
| Bug Fix | +0.0.1 | V88.73 → V88.74 |
| UI Tweak | +0.0.1 | V88.74 → V88.75 |
| Small Feature | +0.1.0 | V88.75 → V88.80 |
| Major Feature | +0.1.0 | V88.80 → V88.90 |
| Breaking Change | +1.0.0 | V88.90 → V89.0 |

---

**REMEMBER: If you touch `admin.html`, you MUST update the version number. No exceptions!**

*Last Updated: V88.74 - 2026-04-05*
