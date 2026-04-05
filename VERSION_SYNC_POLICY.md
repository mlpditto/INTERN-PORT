# Intern Admin Portal - Version Update Policy

## 🎯 Golden Rule: Version Must Match Title

### **MANDATORY REQUIREMENT:**
**Intern Admin Portal title on GitHub Pages MUST always match the current version number.**

No exceptions. No delays. Instant synchronization required.

---

## 📍 Current Issue Identified

### **Problem:**
- **Local Repository:** V88.74 ✅
- **Git Repository:** V88.74 ✅  
- **GitHub Pages Title:** V88.73 ❌
- **GitHub Pages Content:** V88.74 ✅

### **Root Cause:**
GitHub Pages cache or deployment delay causing title version mismatch.

---

## 🔧 Solution: Dual Branch Strategy

### **Current Setup:**
- **Development Branch:** `production`
- **GitHub Pages Branch:** `main`
- **Issue:** GitHub Pages reads from `main` branch

### **Required Workflow:**
```bash
# 1. Make changes on production branch
git checkout production
# ... make changes ...

# 2. Update version number
# Edit admin.html title and comment

# 3. Commit to production
git commit -m "V88.75: [Description]"

# 4. Merge to main for GitHub Pages
git checkout main
git merge production
git push origin main

# 5. Return to production
git checkout production
```

---

## 📋 Version Update Checklist

### **Before EVERY commit:**
1. [ ] Update `<title>` tag: `Intern Admin Portal (V88.75)`
2. [ ] Update comment header: `<!-- V88.75: Description -->`
3. [ ] Update timestamp: `<!-- Release: 2026-04-05 20:30 UTC+7 -->`
4. [ ] Use version in commit message: `V88.75: [Description]`

### **After EVERY commit:**
1. [ ] Merge to main branch: `git checkout main && git merge production`
2. [ ] Push to main: `git push origin main`
3. [ ] Return to production: `git checkout production`
4. [ ] Verify GitHub Pages updates within 5 minutes

---

## ⚡ Quick Update Commands

### **Single Command for Version Update:**
```bash
# Update version and deploy both branches
update_and_deploy() {
    local version=$1
    local description=$2
    
    # Update version in admin.html
    sed -i "s/Intern Admin Portal (V[0-9]\+\.[0-9]\+\.[0-9]\+)/Intern Admin Portal ($version)/" admin.html
    sed -i "s/<!-- V[0-9]\+\.[0-9]\+\.[0-9]\+:.*/<!-- $version: $description -->/" admin.html
    sed -i "s/<!-- Release: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\} UTC[0-9] -->/<!-- Release: $(date '+%Y-%m-%d %H:%M UTC%z') -->/" admin.html
    
    # Commit and push
    git add admin.html
    git commit -m "$version: $description"
    git push origin production
    
    # Merge to main for GitHub Pages
    git checkout main
    git merge production
    git push origin main
    git checkout production
}

# Usage:
# update_and_deploy "V88.75" "Fixed quiz navigation issue"
```

---

## 🔍 Verification Process

### **Automatic Verification:**
```bash
# Check version consistency
verify_version() {
    local local_version=$(grep -o "Intern Admin Portal (V[0-9]\+\.[0-9]\+\.[0-9]\+)" admin.html | head -1)
    local remote_version=$(curl -s https://mlpditto.github.io/INTERN-PORT/admin.html | grep -o "Intern Admin Portal (V[0-9]\+\.[0-9]\+\.[0-9]\+)" | head -1)
    
    echo "Local: $local_version"
    echo "Remote: $remote_version"
    
    if [[ "$local_version" == "$remote_version" ]]; then
        echo "✅ Version synchronized"
    else
        echo "❌ Version mismatch detected!"
        echo "Please wait for GitHub Pages to update or force redeploy"
    fi
}
```

---

## 🚨 Emergency Fix for Version Mismatch

### **If GitHub Pages shows wrong version:**

#### **Option 1: Force Redeploy**
```bash
# Touch a file to trigger rebuild
touch .nojekyll
git add .nojekyll
git commit -m "Force GitHub Pages rebuild"
git push origin main
```

#### **Option 2: Clear Cache**
```bash
# Add cache-busting parameter
# In admin.html, add version to CSS/JS URLs
<link rel="stylesheet" href="style.css?v=88.74">
<script src="script.js?v=88.74"></script>
```

#### **Option 3: Wait and Verify**
```bash
# Wait 5-10 minutes for GitHub Pages
sleep 300
verify_version
```

---

## 📊 Version Synchronization Timeline

| Time After Push | Expected Status |
|------------------|------------------|
| 0-2 minutes | Local: V88.74, Remote: V88.73 |
| 2-5 minutes | Local: V88.74, Remote: Updating... |
| 5+ minutes | Local: V88.74, Remote: V88.74 ✅ |

---

## 🎯 Policy Summary

### **MUST DO:**
1. **Always update version number in title**
2. **Always update both branches (production + main)**
3. **Always verify GitHub Pages reflects current version**
4. **Always use version in commit messages**

### **NEVER DO:**
1. **Never commit without version update**
2. **Never push only to production branch**
3. **Never ignore version mismatch**
4. **Never use generic commit messages**

---

## 🔧 GitHub Pages Configuration

### **Recommended Settings:**
- **Source:** Deploy from a branch
- **Branch:** `main` 
- **Folder:** `/ (root)`
- **Custom Domain:** None (default)

### **Alternative Setup:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ production ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          publish_branch: main
```

---

## 📋 Quick Reference Commands

| Task | Command |
|------|---------|
| Update version | `sed -i 's/V88\.74/V88.75/' admin.html` |
| Deploy both branches | `git push origin production && git checkout main && git merge production && git push origin main && git checkout production` |
| Verify version | `verify_version` |
| Force rebuild | `touch .nojekyll && git add . && git commit -m "Force rebuild" && git push origin main` |

---

**REMEMBER: GitHub Pages title MUST always match current version number. No exceptions!**

*Last Updated: V88.74 - 2026-04-05*
