/**
 * Migration Script: Seed Firestore `taxonomy/case` from public/case-taxonomy.js
 *
 * V94.53 Phase 1 — copies the static CASE_SYSTEMS constant (12 disease
 * systems) into a single Firestore document at `taxonomy/case` so the
 * async overlay in case-taxonomy.js has data to read. After this runs,
 * Phase 2's admin UI can write back to the same doc.
 *
 * Usage:
 *   cd functions
 *   node ../scripts/migrate-case-taxonomy.js          # dry-run (prints payload)
 *   node ../scripts/migrate-case-taxonomy.js --apply  # actual write
 *
 * Safety:
 *   - Idempotent: writes the same doc every time (set, not add)
 *   - No deletes; only writes one doc
 *   - Dry-run by default — must pass --apply to actually write
 *   - Source of truth = the static CASE_SYSTEMS in case-taxonomy.js;
 *     this script does NOT introduce new data, it mirrors what users
 *     already see today
 *
 * Prerequisites:
 *   - `firebase login` (gcloud Application Default Credentials)
 *   - Or: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'intern-port-edfa7' });
const db = admin.firestore();

// MUST stay in sync with public/case-taxonomy.js CASE_SYSTEMS until Phase 2
// admin UI takes over as the source of truth. After Phase 2 ships and a few
// edits land, this list is intentionally stale — the script is then just a
// historical seed. Re-running it would overwrite admin-edited data with
// these defaults, so the --apply flag is gated.
const CASE_SYSTEMS = [
  { key: 'respiratory', emoji: '🫁',
    label: { en: 'Respiratory', ko: '호흡기', th: 'ระบบหายใจ' },
    symptoms: ['Cough', 'Dyspnea', 'Sore Throat', 'Fever', 'Wheezing', 'Runny Nose'] },
  { key: 'cardio', emoji: '❤️',
    label: { en: 'Cardiovascular', ko: '심혈관', th: 'หัวใจและหลอดเลือด' },
    symptoms: ['Chest Pain', 'Palpitations', 'Edema', 'Fatigue', 'High BP'] },
  { key: 'gi', emoji: '🍽️',
    label: { en: 'GI', ko: '소화기', th: 'ระบบทางเดินอาหาร' },
    symptoms: ['Abdominal Pain', 'Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Bloating'] },
  { key: 'neuro', emoji: '🧠',
    label: { en: 'Neurological', ko: '신경계', th: 'ระบบประสาท' },
    symptoms: ['Headache', 'Dizziness', 'Numbness', 'Weakness', 'Insomnia'] },
  { key: 'ent', emoji: '👂',
    label: { en: 'ENT', ko: '이비인후과', th: 'หู คอ จมูก' },
    symptoms: ['Ear Pain', 'Hearing Loss', 'Tinnitus', 'Sore Throat', 'Nasal Congestion'] },
  { key: 'eye', emoji: '👁️',
    label: { en: 'Ophthalmology', ko: '안과', th: 'จักษุ' },
    symptoms: ['Eye Pain', 'Blurred Vision', 'Redness', 'Discharge', 'Itching'] },
  { key: 'skin', emoji: '🧴',
    label: { en: 'Skin', ko: '피부', th: 'ผิวหนัง' },
    symptoms: ['Rash', 'Itching', 'Redness', 'Swelling', 'Lesion'] },
  { key: 'msk', emoji: '🦴',
    label: { en: 'Musculoskeletal', ko: '근골격계', th: 'กล้ามเนื้อกระดูก' },
    symptoms: ['Joint Pain', 'Back Pain', 'Stiffness', 'Sprain', 'Swelling'] },
  { key: 'endocrine', emoji: '🩺',
    label: { en: 'Endocrine / NCDs', ko: '내분비/만성질환', th: 'โรคเรื้อรัง' },
    symptoms: ['Hyperglycemia', 'Polyuria', 'Weight Loss', 'Fatigue', 'Poor Adherence'] },
  { key: 'renal', emoji: '🚰',
    label: { en: 'Renal / Urology', ko: '신장/비뇨기', th: 'ไตและทางเดินปัสสาวะ' },
    symptoms: ['Dysuria', 'Frequency', 'Hematuria', 'Flank Pain', 'Edema'] },
  { key: 'heme', emoji: '🩸',
    label: { en: 'Heme / Onc', ko: '혈액/종양', th: 'โลหิตและมะเร็ง' },
    symptoms: ['Anemia', 'Bruising', 'Bleeding', 'Lump', 'Weight Loss'] },
  { key: 'mental', emoji: '🧘',
    label: { en: 'Mental Health', ko: '정신건강', th: 'สุขภาพจิต' },
    symptoms: ['Stress', 'Anxiety', 'Low Mood', 'Poor Sleep', 'Panic'] },
  { key: 'other', emoji: '📋',
    label: { en: 'Other', ko: '기타', th: 'อื่นๆ' },
    symptoms: ['Follow-up', 'Medication Q', 'Unclear Symptom'] }
];

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`[migrate-case-taxonomy] ${APPLY ? 'APPLY' : 'DRY-RUN'} mode`);
  console.log(`[migrate-case-taxonomy] systems count: ${CASE_SYSTEMS.length}`);

  const payload = {
    systems: CASE_SYSTEMS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'migration-script-V94.53',
    schemaVersion: 1
  };

  if (!APPLY) {
    console.log('[migrate-case-taxonomy] DRY-RUN payload (would write to taxonomy/case):');
    console.log(JSON.stringify({ ...payload, updatedAt: '<server-timestamp>' }, null, 2));
    console.log('\nRe-run with --apply to actually write.');
    return;
  }

  // Refuse to overwrite a doc whose updatedBy is NOT this migration script
  // (i.e. admin already edited it post-Phase-2). Manual unlock via Firestore
  // console if you truly need to re-seed.
  const existing = await db.collection('taxonomy').doc('case').get();
  if (existing.exists) {
    const data = existing.data();
    if (data.updatedBy && !String(data.updatedBy).startsWith('migration-script')) {
      console.error(`[migrate-case-taxonomy] REFUSED: existing doc updatedBy="${data.updatedBy}" — admin has edited this. Delete the doc manually in Firestore console first if you really want to re-seed.`);
      process.exit(1);
    }
  }

  await db.collection('taxonomy').doc('case').set(payload);
  console.log('[migrate-case-taxonomy] OK — wrote taxonomy/case');
}

main().catch(err => {
  console.error('[migrate-case-taxonomy] FAILED:', err);
  process.exit(1);
});
