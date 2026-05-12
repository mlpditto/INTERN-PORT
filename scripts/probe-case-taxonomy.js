/**
 * Probe Script: Read-only inspection of Firestore `taxonomy/case` doc state.
 *
 * V94.53 Phase 1 verification — confirms whether the Firestore overlay is
 * actually returning data (not just falling back to bundled .js). Run after
 * Phase 1 rules deploy + any time admin's first Save is in question.
 *
 * Usage:
 *   cd functions
 *   node ../scripts/probe-case-taxonomy.js
 *
 * No writes. Exits 0 on success regardless of doc presence.
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'intern-port-edfa7' });
const db = admin.firestore();

async function main() {
    console.log('[probe] Reading taxonomy/case doc from Firestore...');
    const ref = db.collection('taxonomy').doc('case');
    const snap = await ref.get();

    if (!snap.exists) {
        console.log('\n📁 STATIC FALLBACK MODE');
        console.log('  Doc does NOT exist at taxonomy/case.');
        console.log('  Phase 1 overlay falls back to bundled CASE_SYSTEMS in case-taxonomy.js.');
        console.log('  Phase 2 admin UI will create this doc on first Save.');
        return;
    }

    const data = snap.data() || {};
    const systems = Array.isArray(data.systems) ? data.systems : [];

    console.log('\n📦 FIRESTORE MODE — doc exists');
    console.log('  systems count:    ', systems.length);
    console.log('  schemaVersion:    ', data.schemaVersion);
    console.log('  updatedBy:        ', data.updatedBy);
    console.log('  updatedAt:        ', data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt);

    // Quick scan: per-system summary
    console.log('\n  Systems summary:');
    systems.forEach((s, i) => {
        const symC = (s.symptoms || []).length;
        const en = (s.label && s.label.en) || '';
        const ko = (s.label && s.label.ko) || '';
        const th = (s.label && s.label.th) || '';
        console.log(`    ${i + 1}. ${s.emoji || '·'}  ${(s.key || '').padEnd(14)}  ${en} / ${ko} / ${th}  [${symC} symptoms]`);
    });

    // Interpret updatedBy
    console.log('\n[probe] Interpretation:');
    const ub = String(data.updatedBy || '');
    if (ub.startsWith('migration-script')) {
        console.log('  → Doc was seeded by the migration script (V94.53 Phase 1 path).');
        console.log('  → Admin has NOT edited via the ⚙️ UI yet. Phase 2 UI will work; first Save will overwrite this seed.');
    } else if (ub === 'admin-ui') {
        console.log('  → Doc was last written by the admin UI fallback path (no auth email captured at write time).');
        console.log('  → Phase 2 UI has been used. ✓');
    } else if (ub.includes('@')) {
        console.log(`  → Doc was last written by admin "${ub}" via the ⚙️ UI.`);
        console.log('  → Phase 2 UI is fully operational. ✓');
    } else if (ub === 'manual-console-V94.53') {
        console.log('  → Doc was hand-pasted via Firestore Console (manual migration path).');
        console.log('  → Phase 2 UI will work; first Save will overwrite.');
    } else {
        console.log(`  → Unrecognized updatedBy value: "${ub}".`);
        console.log('  → If Phase 2 was used, expected admin email. Investigate.');
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('[probe] FAILED:', err.message || err);
        console.error('\nHint: if "Could not load the default credentials" — run:');
        console.error('  gcloud auth application-default login');
        console.error('\nNote: that is DIFFERENT from `gcloud auth login` (which is user auth for the CLI itself).');
        process.exit(1);
    });
