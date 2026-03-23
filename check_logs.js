
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I need to find if there is one

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkLogs() {
  const snapshot = await db.collection('reflective_logs').orderBy('timestamp', 'desc').limit(5).get();
  snapshot.forEach(doc => {
    console.log(doc.id, ' => ', doc.data());
  });
}

checkLogs();
