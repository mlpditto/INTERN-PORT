# 🔥 Legacy Data Migration - Complete Guide

## 📊 Current Status

✅ **New submissions** (after deployment) → Automatically sync to unified system  
⚠️ **Old submissions** (before deployment) → Still in legacy collections only

---

## 🎯 Recommended Solution: Test First!

**The easiest way to verify everything works:**

### Step 1: Submit New Test Data
1. Open: https://mlpditto.github.io/INTERN-PORT/
2. Click the **➕ FAB button** (bottom-right corner)
3. Select **Case / 케이스**
4. Fill in test data:
   - Case No: `MIGRATION-TEST-001`
   - Patient: `Test Patient`
   - Disease System: `Respiratory`
   - Symptoms: Select any
5. Click **🚀 Submit**

### Step 2: Verify
1. Open **Unified History** section (below Work section)
2. **You should see:** `MIGRATION-TEST-001` in the timeline!
3. ✅ If visible = Dual-write system working perfectly!

---

## 📦 Migration Options for Old Data

### Option A: Leave Old Data As-Is ✅ **RECOMMENDED**

**Why this is best:**
- ✅ Old data still accessible from original sections (Case History, Work History)
- ✅ No risk of migration errors
- ✅ New system works perfectly for all new submissions
- ✅ Zero downtime, zero configuration

**Result:**
- Old cases → Viewable in Case History section
- Old works → Viewable in Work History section
- New cases/works → Viewable in Unified History ✅

---

### Option B: Manual Migration via Firebase Console

**Best for:** Small amount of data (< 50 documents)

#### Steps:

1. **Open Firebase Console**
   - https://console.firebase.google.com
   - Select: `intern-port-edfa7`
   - Go to: Firestore Database

2. **Migrate Cases**
   ```
   For each document in 'cases' collection:
   1. Copy the document
   2. Create new document in 'submissions' collection
   3. Add these fields:
      - submissionType: "case"
      - metadata: {
          caseId: "...",
          customer: "...",
          disease: "...",
          sourceType: "cases",
          sourceId: "original-doc-id"
        }
   ```

3. **Migrate Works**
   ```
   For each document in 'works' collection:
   1. Copy the document
   2. Create new document in 'submissions' collection
   3. Add these fields:
      - submissionType: "work"
      - metadata: {
          link: "...",
          sourceType: "works",
          sourceId: "original-doc-id"
        }
   ```

---

### Option C: Automated Migration Script

**Best for:** Large datasets (100+ documents)

#### Requirements:
- Service Account Key from Firebase Console

#### Steps:

1. **Download Service Account Key**
   ```
   1. Go to Firebase Console
   2. Project Settings ⚙️ → Service Accounts
   3. Click "Generate New Private Key"
   4. Save JSON file as: serviceAccountKey.json
   5. Place in project root directory
   ```

2. **Install Dependencies** (already done ✅)
   ```bash
   npm install firebase-admin
   ```

3. **Test Run (Dry Run)**
   ```bash
   # Edit script: Set DRY_RUN = true
   node scripts/migrate-legacy-to-unified.js
   ```

4. **Real Migration**
   ```bash
   # Edit script: Set DRY_RUN = false
   node scripts/migrate-legacy-to-unified.js
   ```

5. **Verify Migration**
   - Check Firestore Console for new documents in `submissions` collection
   - Open app and check Unified History
   - Old data should now appear!

---

## 📋 Migration Checklist

### Before Migration:
- [ ] Backup Firestore data (Firebase Console → Export)
- [ ] Test with new submission (verify dual-write works)
- [ ] Count existing documents in cases/works collections

### After Migration:
- [ ] Check submissions collection has new documents
- [ ] Verify document structure matches schema
- [ ] Test Unified History in app
- [ ] Check multiple user accounts
- [ ] Verify original collections still intact

---

## 🆘 Troubleshooting

### Problem: Unified History shows nothing

**Solution:**
1. Submit a new case/work via FAB button
2. Check if it appears in Unified History
3. If yes = system works, old data just needs migration
4. If no = check browser console for errors

### Problem: Old data not showing

**Cause:** Old data not yet migrated to submissions collection

**Solution:** Choose one of the migration options above (A, B, or C)

### Problem: Migration script fails

**Common causes:**
- Service account key not found → Check file path
- Permission denied → Check service account roles
- Timeout → Increase timeout in script

---

## 📊 Data Structure Reference

### Case Document in Submissions:
```javascript
{
  submissionType: "case",
  userId: "user-id",
  displayName: "User Name",
  title: "CASE001 - Respiratory",
  description: "Notes...",
  status: "pending",
  score: 0,
  metadata: {
    caseId: "CASE001",
    customer: "Patient Name",
    disease: "Respiratory",
    diseaseSystemKey: "respiratory",
    symptomTags: ["Cough", "Fever"],
    sourceType: "cases",
    sourceId: "original-case-doc-id"
  },
  timestamp: Timestamp,
  updatedAt: Timestamp,
  pointsAwarded: false,
  pointsAmount: 0.01
}
```

### Work Document in Submissions:
```javascript
{
  submissionType: "work",
  userId: "user-id",
  displayName: "User Name",
  title: "Marketing Report",
  description: "https://example.com",
  status: "pending",
  score: 0,
  metadata: {
    link: "https://example.com",
    sourceType: "works",
    sourceId: "original-work-doc-id"
  },
  timestamp: Timestamp,
  updatedAt: Timestamp,
  pointsAwarded: false,
  pointsAmount: 0
}
```

---

## ✅ Quick Verification

**Test that everything works:**

```bash
# 1. Open app
https://mlpditto.github.io/INTERN-PORT/

# 2. Submit test case via FAB button
Click ➕ → Case → Fill form → Submit

# 3. Check Unified History
Should see the test case immediately

# 4. Check Firebase Console
Firestore → submissions collection
Should see new document with submissionType: "case"

# 5. Check Firestore Rules
submissions collection should have proper security rules
(see: firestore-unified-rules.txt)
```

---

## 🎯 Final Recommendation

**For now:**
1. ✅ Test with new submission (takes 1 minute)
2. ✅ Verify Unified History shows new data
3. ✅ Leave old data in legacy collections (no migration needed)
4. ✅ All new submissions will automatically appear in Unified History

**Later (if needed):**
- Migrate old data using Option B or C above
- Or just leave it (old data still accessible from original sections)

---

## 📁 Related Files

- `scripts/migrate-legacy-to-unified.js` - Automated migration script
- `scripts/simple-migration.js` - Simple migration guide
- `firestore-unified-rules.txt` - Firestore security rules
- `INTERN-PORT-OPS/06 Runbooks/MIGRATION-Legacy-to-Unified-Submissions.md` - Detailed migration guide
- `INTERN-PORT-OPS/06 Runbooks/QUICK-DATA-SYNC-GUIDE.md` - Quick sync guide

---

**Last Updated:** 2026-04-26  
**Version:** 2.0  
**Status:** Dual-write system operational ✅
