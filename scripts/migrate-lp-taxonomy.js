/**
 * Migration Script: Seed 3 Firestore `taxonomy/lp_{axis}` docs from public/taxonomy.js
 *
 * V94.55 Phase 1 — copies the static LP_TAXONOMY.{axis}.systems[] arrays
 * (medical, skill, tool) into 3 separate Firestore documents so the async
 * overlay in taxonomy.js has data to read. After this runs, Phase 2's admin
 * UI can write back to the same docs.
 *
 * Schema per doc (taxonomy/lp_medical etc):
 *   { systems: [{key, label{en,ko,th}, tags[]}], updatedAt, updatedBy, schemaVersion }
 *
 * Note: per-axis metadata (icon/easterEgg/colors) stays in public/taxonomy.js
 * — only systems[] is migrated.
 *
 * Usage:
 *   cd functions
 *   node ../scripts/migrate-lp-taxonomy.js          # dry-run
 *   node ../scripts/migrate-lp-taxonomy.js --apply  # actually write
 *
 * Safety:
 *   - Idempotent: same payload each run
 *   - Dry-run by default
 *   - Per-axis refusal if existing doc was last written by admin UI
 *     (admin email or 'admin-ui') — prevents accidental seed overwrite
 *
 * Prerequisites:
 *   - `gcloud auth application-default login` (ADC, set up 2026-05-12)
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'intern-port-edfa7' });
const db = admin.firestore();

// MUST stay in sync with LP_TAXONOMY.{axis}.systems[] in public/taxonomy.js
// until Phase 2 admin UI becomes source of truth. Then this script is just
// a historical seed and should not be re-run without manually clearing docs.
const LP_SYSTEMS = {
  medical: [
    { key: 'respiratory', label: { en: 'Respiratory', ko: '호흡기', th: 'ระบบทางเดินหายใจ' },
      tags: ['cough', 'dyspnea', 'sore throat', 'fever', 'runny nose'] },
    { key: 'cardio', label: { en: 'Cardiovascular', ko: '심혈관', th: 'ระบบหัวใจและหลอดเลือด' },
      tags: ['chest pain', 'palpitations', 'edema', 'fatigue', 'high BP'] },
    { key: 'gi', label: { en: 'GI', ko: '소화기', th: 'ระบบทางเดินอาหาร' },
      tags: ['abdominal pain', 'nausea', 'vomiting', 'diarrhea', 'constipation', 'bloating'] },
    { key: 'skin', label: { en: 'Skin', ko: '피부', th: 'ระบบผิวหนัง' },
      tags: ['rash', 'itching', 'redness', 'swelling', 'lesion'] },
    { key: 'neuro', label: { en: 'Neurological', ko: '신경계', th: 'ระบบประสาท' },
      tags: ['headache', 'dizziness', 'numbness', 'weakness', 'insomnia'] },
    { key: 'msk', label: { en: 'Musculoskeletal', ko: '근골격계', th: 'กล้ามเนื้อและกระดูก' },
      tags: ['joint pain', 'back pain', 'stiffness', 'sprain', 'swelling'] },
    { key: 'endocrine', label: { en: 'Endocrine / NCDs', ko: '내분비/만성질환', th: 'โรคเรื้อรัง / ต่อมไร้ท่อ' },
      tags: ['hyperglycemia', 'polyuria', 'weight loss', 'fatigue', 'poor adherence'] },
    { key: 'mental', label: { en: 'Mental Health', ko: '정신건강', th: 'สุขภาพจิต' },
      tags: ['stress', 'anxiety', 'low mood', 'panic', 'poor sleep'] },
    { key: 'other', label: { en: 'Other', ko: '기타', th: 'อื่นๆ' },
      tags: ['follow-up', 'medication question', 'unclear symptom'] }
  ],
  skill: [
    { key: 'communication', label: { en: 'Communication', ko: '의사소통', th: 'การสื่อสาร' },
      tags: ['presentation', 'listening', 'feedback', 'writing', 'public speaking', 'negotiation'] },
    { key: 'leadership', label: { en: 'Leadership', ko: '리더십', th: 'ภาวะผู้นำ' },
      tags: ['delegation', 'coaching', 'decision-making', 'vision', 'mentoring', 'accountability'] },
    { key: 'problem-solving', label: { en: 'Problem-solving', ko: '문제해결', th: 'การแก้ปัญหา' },
      tags: ['root cause', 'brainstorming', 'critical thinking', 'debugging', 'analysis', 'creativity'] },
    { key: 'time-management', label: { en: 'Time management', ko: '시간관리', th: 'การบริหารเวลา' },
      tags: ['prioritization', 'focus', 'planning', 'deadlines', 'deep work', 'scheduling'] },
    { key: 'customer-service', label: { en: 'Customer service', ko: '고객서비스', th: 'การบริการลูกค้า' },
      tags: ['empathy', 'conflict resolution', 'active listening', 'follow-up', 'expectations', 'complaints'] },
    { key: 'digital-literacy', label: { en: 'Digital literacy', ko: '디지털 리터러시', th: 'ทักษะดิจิทัล' },
      tags: ['AI tools', 'prompts', 'automation', 'data', 'security', 'search'] },
    { key: 'wellness', label: { en: 'Wellness', ko: '웰니스', th: 'ความเป็นอยู่ที่ดี' },
      tags: ['stress', 'burnout', 'work-life balance', 'sleep', 'exercise', 'mindfulness'] }
  ],
  tool: [
    { key: 'tool', label: { en: 'Tool', ko: '도구', th: 'เครื่องมือ' },
      tags: ['BOTNOI', 'CANVA', 'FACEBOOK', 'IG', 'LINE', 'SHOPEE', 'TIKTOK', 'GPT', 'GEMINI', 'CLAUDE', 'OTHER'] }
  ]
};

const APPLY = process.argv.includes('--apply');

async function migrateAxis(axis, systems) {
  const docId = 'lp_' + axis;
  const ref = db.collection('taxonomy').doc(docId);

  if (!APPLY) {
    console.log(`[migrate-lp] DRY-RUN taxonomy/${docId}: ${systems.length} systems, ${systems.reduce((n, s) => n + s.tags.length, 0)} tags total`);
    return;
  }

  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data();
    const ub = String(data.updatedBy || '');
    if (ub && !ub.startsWith('migration-script')) {
      console.error(`[migrate-lp] REFUSED ${docId}: existing doc updatedBy="${ub}" — admin has edited this. Delete the doc manually in Firestore console first if you really want to re-seed.`);
      return;
    }
  }

  await ref.set({
    systems: systems,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'migration-script-V94.55',
    schemaVersion: 1
  });
  console.log(`[migrate-lp] OK — wrote taxonomy/${docId} (${systems.length} systems)`);
}

async function main() {
  console.log(`[migrate-lp] ${APPLY ? 'APPLY' : 'DRY-RUN'} mode`);
  for (const axis of Object.keys(LP_SYSTEMS)) {
    await migrateAxis(axis, LP_SYSTEMS[axis]);
  }
  if (!APPLY) console.log('\nRe-run with --apply to actually write all 3 docs.');
}

main().catch(err => {
  console.error('[migrate-lp] FAILED:', err);
  process.exit(1);
});
