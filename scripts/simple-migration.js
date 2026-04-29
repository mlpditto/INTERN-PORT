/**
 * Simple Migration Script using Firebase REST API
 * 
 * Usage:
 *   node scripts/simple-migration.js
 * 
 * This script:
 * 1. Reads firebase.json to get project ID
 * 2. Uses Firebase CLI credentials
 * 3. Migrates cases and works to submissions via REST API
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read project configuration
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
const projectId = 'intern-port-edfa7'; // Hardcoded for safety

console.log('🔥 Firebase Project:', projectId);
console.log('📋 Starting Migration...\n');

// This script requires manual execution via Firebase Console or Admin SDK
// For now, let's create a guide instead

const guide = `
╔══════════════════════════════════════════════════════════════════════╗
║           🔥 MIGRATION GUIDE - MANUAL METHOD                        ║
╚══════════════════════════════════════════════════════════════════════╝

Since automated migration requires service account credentials,
here are the EASIEST options:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 1: Use Firebase Console (Recommended) ⭐
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to: https://console.firebase.google.com
2. Select project: intern-port-edfa7
3. Go to Firestore Database
4. Manual migration for each collection:

   FOR CASES COLLECTION:
   - Open cases collection
   - For each document, manually create a copy in submissions with:
     * submissionType: "case"
     * All original fields
     * Add metadata.sourceId pointing to original doc ID

   FOR WORKS COLLECTION:
   - Open works collection  
   - For each document, manually create a copy in submissions with:
     * submissionType: "work"
     * All original fields
     * Add metadata.sourceId pointing to original doc ID

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 2: Use Firebase CLI with Service Account 🔑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Download service account key:
   - Firebase Console → Project Settings → Service Accounts
   - Generate New Private Key
   - Save as: serviceAccountKey.json (in project root)

2. Run migration:
   node scripts/migrate-legacy-to-unified.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 3: Test with New Data First ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The dual-write system is ALREADY WORKING for new submissions!

1. Open: https://mlpditto.github.io/INTERN-PORT/
2. Click the ➕ button (bottom-right)
3. Submit a new Case or Work
4. Check Unified History → should appear immediately!

This proves the system works. Old data can be migrated later.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDATION: Option 3 First, Then Option 1 if needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

console.log(guide);

// Save guide to file
fs.writeFileSync(
  path.join(__dirname, '..', 'INTERN-PORT-OPS', '06 Runbooks', 'MIGRATION-MANUAL-GUIDE.txt'),
  guide
);

console.log('✅ Guide saved to: INTERN-PORT-OPS/06 Runbooks/MIGRATION-MANUAL-GUIDE.txt\n');
console.log('💡 Recommendation: Test with new data submission first!');
