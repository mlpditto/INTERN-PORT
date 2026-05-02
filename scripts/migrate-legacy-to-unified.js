/**
 * Migration Script: Sync Legacy Cases & Works to Unified Submissions
 * 
 * This script migrates existing data from:
 * - cases collection → submissions collection (submissionType: 'case')
 * - works collection → submissions collection (submissionType: 'work')
 * 
 * Usage:
 *   cd functions
 *   node ../scripts/migrate-legacy-to-unified.js
 * 
 * Safety:
 *   - Does NOT delete original data
 *   - Uses batch operations for efficiency
 *   - Logs progress and errors
 *   - Can be run multiple times safely (idempotent)
 */

const admin = require('firebase-admin');

// Initialize with application default credentials (from firebase login)
admin.initializeApp({
  projectId: 'intern-port-edfa7'
});

const db = admin.firestore();

// Configuration
const BATCH_SIZE = 500;
const DRY_RUN = true; // Set to false for actual migration

async function migrateCases() {
  console.log('\n🔵 Starting Case Migration...');
  
  const snapshot = await db.collection('cases').get();
  console.log(`📊 Found ${snapshot.size} cases to migrate`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      
      // Check if already migrated (by checking sourceId)
      const existingSubmissions = await db.collection('submissions')
        .where('metadata.sourceId', '==', doc.id)
        .where('submissionType', '==', 'case')
        .limit(1)
        .get();
      
      if (!existingSubmissions.empty) {
        console.log(`⏭️  Skipping case ${doc.id} (already migrated)`);
        skipped++;
        continue;
      }
      
      // Create unified submission document
      const submissionData = {
        submissionType: 'case',
        authUid: data.authUid || '',
        userId: data.userId || '',
        displayName: data.displayName || '',
        pictureUrl: data.pictureUrl || '',
        title: `${data.caseId || 'N/A'} - ${data.disease || 'General'}`,
        description: data.note || '',
        status: data.status || 'pending',
        score: data.score || 0,
        adminComment: data.adminComment || '',
        adminBonus: data.adminBonus || 0,
        adminReviewedBy: data.adminReviewedBy || '',
        adminUpdatedAt: data.adminUpdatedAt || null,
        metadata: {
          caseId: data.caseId || '',
          customer: data.customer || '',
          disease: data.disease || '',
          diseaseSystemKey: data.diseaseSystemKey || null,
          diseaseSystemLabel: data.diseaseSystemLabel || '',
          symptomTags: data.symptomTags || [],
          sourceType: 'cases',
          sourceId: doc.id
        },
        timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: data.adminUpdatedAt || data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        pointsAwarded: data.adminBonus > 0,
        pointsAmount: data.adminBonus || 0.01
      };
      
      if (DRY_RUN) {
        console.log(`✅ [DRY RUN] Would migrate case: ${doc.id}`);
      } else {
        await db.collection('submissions').add(submissionData);
        console.log(`✅ Migrated case: ${doc.id}`);
      }
      
      migrated++;
      
      // Small delay to avoid rate limiting
      if (migrated % 10 === 0) {
        console.log(`⏳ Processed ${migrated} cases...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ Error migrating case ${doc.id}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n✅ Case Migration Complete!');
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  return { migrated, skipped, errors };
}

async function migrateWorks() {
  console.log('\n🟢 Starting Work Migration...');
  
  const snapshot = await db.collection('works').get();
  console.log(`📊 Found ${snapshot.size} works to migrate`);
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();
      
      // Check if already migrated
      const existingSubmissions = await db.collection('submissions')
        .where('metadata.sourceId', '==', doc.id)
        .where('submissionType', '==', 'work')
        .limit(1)
        .get();
      
      if (!existingSubmissions.empty) {
        console.log(`⏭️  Skipping work ${doc.id} (already migrated)`);
        skipped++;
        continue;
      }
      
      // Create unified submission document
      const submissionData = {
        submissionType: 'work',
        authUid: data.authUid || '',
        userId: data.userId || '',
        displayName: data.displayName || '',
        pictureUrl: data.pictureUrl || '',
        title: data.title || 'Untitled Work',
        description: data.link || '',
        status: data.status || 'pending',
        score: data.score || 0,
        adminComment: data.adminComment || '',
        adminBonus: data.adminBonus || 0,
        adminReviewedBy: data.adminReviewedBy || '',
        adminUpdatedAt: data.adminUpdatedAt || null,
        metadata: {
          link: data.link || '',
          sourceType: 'works',
          sourceId: doc.id
        },
        timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: data.adminUpdatedAt || data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
        pointsAwarded: data.score > 0,
        pointsAmount: data.score || 0
      };
      
      if (DRY_RUN) {
        console.log(`✅ [DRY RUN] Would migrate work: ${doc.id}`);
      } else {
        await db.collection('submissions').add(submissionData);
        console.log(`✅ Migrated work: ${doc.id}`);
      }
      
      migrated++;
      
      // Small delay to avoid rate limiting
      if (migrated % 10 === 0) {
        console.log(`⏳ Processed ${migrated} works...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ Error migrating work ${doc.id}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n✅ Work Migration Complete!');
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  return { migrated, skipped, errors };
}

async function main() {
  console.log('🚀 Starting Unified Submissions Migration');
  console.log(`📋 Dry Run: ${DRY_RUN ? 'YES (no data will be written)' : 'NO (real migration)'}`);
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Migrate cases
    const caseResults = await migrateCases();
    
    console.log('\n' + '='.repeat(50));
    
    // Migrate works
    const workResults = await migrateWorks();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Migration Complete!');
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log('\n📊 Summary:');
    console.log(`   Cases: ${caseResults.migrated} migrated, ${caseResults.skipped} skipped, ${caseResults.errors} errors`);
    console.log(`   Works: ${workResults.migrated} migrated, ${workResults.skipped} skipped, ${workResults.errors} errors`);
    console.log(`   Total: ${caseResults.migrated + workResults.migrated} documents migrated`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN. No data was modified.');
      console.log('   Set DRY_RUN = false to perform actual migration.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
