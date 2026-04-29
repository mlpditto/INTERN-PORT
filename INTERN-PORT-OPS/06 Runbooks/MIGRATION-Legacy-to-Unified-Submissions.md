# 🔥 Legacy Data Migration Guide
## Sync Old Cases & Works to Unified Submissions

---

## 📋 Overview

This migration script syncs **existing data** from legacy collections to the new unified `submissions` collection.

**What it does:**
- ✅ Migrates all documents from `cases` → `submissions` (submissionType: 'case')
- ✅ Migrates all documents from `works` → `submissions` (submissionType: 'work')
- ✅ Preserves all original data (does NOT delete)
- ✅ Safe to run multiple times (idempotent)
- ✅ Skips already-migrated documents

---

## ⚠️ Prerequisites

### 1. Firebase Service Account Key

You need a service account key file. If you don't have one:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `intern-port-edfa7`
3. Go to **Project Settings** ⚙️
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the JSON file as `serviceAccountKey.json` in the project root

**⚠️ IMPORTANT:** Never commit this file to git! It's already in `.gitignore`

---

## 🚀 Migration Steps

### Step 1: Test Run (Dry Run)

First, test without writing any data:

```bash
cd c:\Users\medli\OneDrive\Apps\WEBAPP\INTERN-PORT

# Edit the script to enable dry run
# Open scripts/migrate-legacy-to-unified.js
# Line 19: Change DRY_RUN = false → DRY_RUN = true

node scripts/migrate-legacy-to-unified.js
```

**Expected output:**
```
🚀 Starting Unified Submissions Migration
📋 Dry Run: YES (no data will be written)
==================================================

🔵 Starting Case Migration...
📊 Found 150 cases to migrate
✅ [DRY RUN] Would migrate case: abc123
✅ [DRY RUN] Would migrate case: def456
...
✅ Case Migration Complete!
   Migrated: 150
   Skipped: 0
   Errors: 0

🟢 Starting Work Migration...
📊 Found 80 works to migrate
✅ [DRY RUN] Would migrate work: ghi789
...
✅ Work Migration Complete!
   Migrated: 80
   Skipped: 0
   Errors: 0

🎉 Migration Complete!
⏱️  Duration: 12.34 seconds
```

### Step 2: Real Migration

Once dry run looks good, run the actual migration:

```bash
# Edit the script to disable dry run
# Open scripts/migrate-legacy-to-unified.js
# Line 19: Change DRY_RUN = true → DRY_RUN = false

node scripts/migrate-legacy-to-unified.js
```

**Expected output:**
```
🚀 Starting Unified Submissions Migration
📋 Dry Run: NO (real migration)
==================================================

🔵 Starting Case Migration...
📊 Found 150 cases to migrate
✅ Migrated case: abc123
✅ Migrated case: def456
⏳ Processed 10 cases...
...
✅ Case Migration Complete!
   Migrated: 150
   Skipped: 0
   Errors: 0

🟢 Starting Work Migration...
📊 Found 80 works to migrate
✅ Migrated work: ghi789
...
✅ Work Migration Complete!
   Migrated: 80
   Skipped: 0
   Errors: 0

🎉 Migration Complete!
⏱️  Duration: 45.67 seconds

📊 Summary:
   Cases: 150 migrated, 0 skipped, 0 errors
   Works: 80 migrated, 0 skipped, 0 errors
   Total: 230 documents migrated
```

---

## ✅ Verify Migration

### 1. Check Firestore Console

Go to [Firebase Console](https://console.firebase.google.com) → Firestore Database:

**Check submissions collection:**
- Should have documents with `submissionType: 'case'`
- Should have documents with `submissionType: 'work'`
- Each document should have `metadata.sourceId` pointing to original doc

**Check original collections:**
- `cases` collection - still has all original documents ✅
- `works` collection - still has all original documents ✅

### 2. Test in App

1. Open https://mlpditto.github.io/INTERN-PORT/
2. Login as a user with existing cases/works
3. Click **Unified History** section
4. **Expected:** Old cases and works now appear in the timeline!

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'firebase-admin'"

**Solution:**
```bash
npm install firebase-admin
```

### Error: "serviceAccountKey.json not found"

**Solution:**
1. Download service account key from Firebase Console (see Prerequisites)
2. Save as `serviceAccountKey.json` in project root

### Error: "Permission denied"

**Solution:**
- Ensure service account has **Firestore Admin** role
- Check Firestore rules allow writes to `submissions` collection

### Migration seems slow

**Solution:**
- This is normal for large datasets
- Script includes delays to avoid rate limiting
- Can process ~100 documents per minute

### Some documents failed

**Solution:**
- Check error messages in console
- Safe to re-run script - it will skip already-migrated docs
- Failed docs can be migrated manually if needed

---

## 🔄 Re-Running Migration

The script is **idempotent** - safe to run multiple times!

```bash
# Just run again - it will skip already-migrated documents
node scripts/migrate-legacy-to-unified.js
```

**Output will show:**
```
⏭️  Skipping case abc123 (already migrated)
⏭️  Skipping case def456 (already migrated)
```

---

## 📊 Data Structure After Migration

### Case Document in submissions collection:
```javascript
{
  submissionType: 'case',
  userId: 'user123',
  displayName: 'John Doe',
  title: 'CASE001 - Respiratory',
  description: 'Patient with cough and fever',
  status: 'approved',
  score: 0.5,
  metadata: {
    caseId: 'CASE001',
    customer: 'Patient Name',
    disease: 'Respiratory',
    diseaseSystemKey: 'respiratory',
    symptomTags: ['Cough', 'Fever'],
    sourceType: 'cases',
    sourceId: 'originalCaseDocId'  // ← Links to legacy document
  },
  timestamp: Timestamp,
  updatedAt: Timestamp
}
```

### Work Document in submissions collection:
```javascript
{
  submissionType: 'work',
  userId: 'user123',
  displayName: 'John Doe',
  title: 'Marketing Analysis Report',
  description: 'https://example.com/report',
  status: 'approved',
  score: 0.8,
  metadata: {
    link: 'https://example.com/report',
    sourceType: 'works',
    sourceId: 'originalWorkDocId'  // ← Links to legacy document
  },
  timestamp: Timestamp,
  updatedAt: Timestamp
}
```

---

## 🎯 Post-Migration Checklist

- [ ] Dry run completed successfully
- [ ] Real migration completed
- [ ] Verified submissions collection has documents
- [ ] Verified original collections still intact
- [ ] Tested in app - old data appears in unified history
- [ ] Checked multiple user accounts
- [ ] No errors in browser console

---

## 📝 Notes

- **Original data is NEVER deleted** - dual system continues to work
- **New submissions** will automatically write to both collections
- **Migration only needs to run once** for existing data
- **Safe to re-run** - skips already-migrated documents
- **Takes ~1-5 minutes** depending on data volume

---

## 🆘 Support

If you encounter issues:
1. Check console output for error messages
2. Verify service account has correct permissions
3. Try dry run first to identify issues
4. Check Firebase Console for data integrity

---

**Migration Script:** `scripts/migrate-legacy-to-unified.js`  
**Created:** 2026-04-26  
**Version:** 1.0
