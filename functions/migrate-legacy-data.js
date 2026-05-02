/**
 * Migration Cloud Function: Migrate Legacy Data to Unified Submissions
 * 
 * Trigger via HTTP:
 * https://us-central1-intern-port-edfa7.cloudfunctions.net/migrateLegacyData
 * 
 * This will:
 * 1. Migrate all cases → submissions (submissionType: 'case')
 * 2. Migrate all works → submissions (submissionType: 'work')
 * 3. Skip already-migrated documents
 * 4. Return migration statistics
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.migrateLegacyData = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  
  // Only allow GET requests for safety
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  
  const startTime = Date.now();
  const results = {
    cases: { migrated: 0, skipped: 0, errors: 0 },
    works: { migrated: 0, skipped: 0, errors: 0 }
  };
  
  try {
    // Migrate Cases
    console.log('🔵 Starting Case Migration...');
    const casesSnapshot = await db.collection('cases').get();
    console.log(`📊 Found ${casesSnapshot.size} cases`);
    
    for (const caseDoc of casesSnapshot.docs) {
      try {
        const caseData = caseDoc.data();
        
        // Check if already migrated
        const existingSubmissions = await db.collection('submissions')
          .where('metadata.sourceId', '==', caseDoc.id)
          .where('submissionType', '==', 'case')
          .limit(1)
          .get();
        
        if (!existingSubmissions.empty) {
          results.cases.skipped++;
          continue;
        }
        
        // Create unified submission
        const submissionData = {
          submissionType: 'case',
          authUid: caseData.authUid || '',
          userId: caseData.userId || '',
          displayName: caseData.displayName || '',
          pictureUrl: caseData.pictureUrl || '',
          title: `${caseData.caseId || 'N/A'} - ${caseData.disease || 'General'}`,
          description: caseData.note || '',
          status: caseData.status || 'pending',
          score: caseData.score || 0,
          adminComment: caseData.adminComment || '',
          adminBonus: caseData.adminBonus || 0,
          adminReviewedBy: caseData.adminReviewedBy || '',
          adminUpdatedAt: caseData.adminUpdatedAt || null,
          metadata: {
            caseId: caseData.caseId || '',
            customer: caseData.customer || '',
            disease: caseData.disease || '',
            diseaseSystemKey: caseData.diseaseSystemKey || null,
            diseaseSystemLabel: caseData.diseaseSystemLabel || '',
            symptomTags: caseData.symptomTags || [],
            sourceType: 'cases',
            sourceId: caseDoc.id
          },
          timestamp: caseData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: caseData.adminUpdatedAt || caseData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          pointsAwarded: caseData.adminBonus > 0,
          pointsAmount: caseData.adminBonus || 0.01
        };
        
        await db.collection('submissions').add(submissionData);
        results.cases.migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating case ${caseDoc.id}:`, error);
        results.cases.errors++;
      }
    }
    
    console.log(`✅ Case Migration Complete: ${results.cases.migrated} migrated, ${results.cases.skipped} skipped, ${results.cases.errors} errors`);
    
    // Migrate Works
    console.log('🟢 Starting Work Migration...');
    const worksSnapshot = await db.collection('works').get();
    console.log(`📊 Found ${worksSnapshot.size} works`);
    
    for (const workDoc of worksSnapshot.docs) {
      try {
        const workData = workDoc.data();
        
        // Check if already migrated
        const existingSubmissions = await db.collection('submissions')
          .where('metadata.sourceId', '==', workDoc.id)
          .where('submissionType', '==', 'work')
          .limit(1)
          .get();
        
        if (!existingSubmissions.empty) {
          results.works.skipped++;
          continue;
        }
        
        // Create unified submission
        const submissionData = {
          submissionType: 'work',
          authUid: workData.authUid || '',
          userId: workData.userId || '',
          displayName: workData.displayName || '',
          pictureUrl: workData.pictureUrl || '',
          title: workData.title || 'Untitled Work',
          description: workData.link || '',
          status: workData.status || 'pending',
          score: workData.score || 0,
          adminComment: workData.adminComment || '',
          adminBonus: workData.adminBonus || 0,
          adminReviewedBy: workData.adminReviewedBy || '',
          adminUpdatedAt: workData.adminUpdatedAt || null,
          metadata: {
            link: workData.link || '',
            sourceType: 'works',
            sourceId: workDoc.id
          },
          timestamp: workData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: workData.adminUpdatedAt || workData.timestamp || admin.firestore.FieldValue.serverTimestamp(),
          pointsAwarded: workData.score > 0,
          pointsAmount: workData.score || 0
        };
        
        await db.collection('submissions').add(submissionData);
        results.works.migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating work ${workDoc.id}:`, error);
        results.works.errors++;
      }
    }
    
    console.log(`✅ Work Migration Complete: ${results.works.migrated} migrated, ${results.works.skipped} skipped, ${results.works.errors} errors`);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const response = {
      success: true,
      duration: `${duration} seconds`,
      summary: {
        cases: results.cases,
        works: results.works,
        total: {
          migrated: results.cases.migrated + results.works.migrated,
          skipped: results.cases.skipped + results.works.skipped,
          errors: results.cases.errors + results.works.errors
        }
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('🎉 Migration Complete:', JSON.stringify(response, null, 2));
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
