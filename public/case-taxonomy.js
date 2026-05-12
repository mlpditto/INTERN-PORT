// V94.21: Single source of truth for Case disease systems.
// Loaded by both index.html (LIFF user side) and admin.html. Replaces three
// previously-divergent inline catalogs:
//   - index.html `caseTaxonomyCatalog` + `CASE_SYSTEM_EMOJI`
//   - admin.html `alabastaTaxonomyCatalog`
//   - admin.html `PRIMARY_SYSTEMS`
//
// Schema mirrors public/taxonomy.js (LP_TAXONOMY) for consistency:
//   { key, label: { en, ko, th }, emoji, symptoms: [...] }
//
// Compat shims at the bottom expose the prior global names with their old
// shapes so existing inline JS keeps working without per-call changes.

(function () {
    'use strict';

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
          symptoms: ['Ear Pain', 'Hearing Loss', 'Tinnitus', 'Nasal Congestion', 'Eye Redness', 'Throat Pain'] },
        { key: 'skin', emoji: '🩹',
          label: { en: 'Skin', ko: '피부', th: 'ระบบผิวหนัง' },
          symptoms: ['Rash', 'Itching', 'Redness', 'Swelling', 'Lesion', 'Burning'] },
        { key: 'msk', emoji: '🦴',
          label: { en: 'Musculoskeletal', ko: '근골격계', th: 'กล้ามเนื้อและกระดูก' },
          symptoms: ['Back Pain', 'Joint Pain', 'Stiffness', 'Sprain', 'Swelling'] },
        { key: 'renal', emoji: '💧',
          label: { en: 'Renal/Urinary', ko: '비뇨기', th: 'ระบบทางเดินปัสสาวะ' },
          symptoms: ['Dysuria', 'Frequency', 'Urgency', 'Hematuria', 'Lower Back Pain'] },
        { key: 'endocrine', emoji: '💊',
          label: { en: 'Endocrine/NCDs', ko: '내분비/만성질환', th: 'ต่อมไร้ท่อ/โรคเรื้อรัง' },
          symptoms: ['Hyperglycemia', 'Polyuria', 'Weight Loss', 'Fatigue', 'Poor Adherence'] },
        { key: 'heme', emoji: '🩸',
          label: { en: 'Heme/Immune', ko: '혈액/면역', th: 'โลหิต/ภูมิคุ้มกัน' },
          symptoms: ['Pallor', 'Bruising', 'Bleeding', 'Recurrent Infection', 'Lymphadenopathy'] },
        { key: 'mental', emoji: '🧘',
          label: { en: 'Mental Health', ko: '정신건강', th: 'สุขภาพจิต' },
          symptoms: ['Stress', 'Anxiety', 'Low Mood', 'Poor Sleep', 'Panic'] },
        { key: 'other', emoji: '📋',
          label: { en: 'Other', ko: '기타', th: 'อื่นๆ' },
          symptoms: ['Follow-up', 'Medication Q', 'Unclear Symptom'] }
    ];

    // V94.53 Phase 1: shim builder hoisted into a function so the same code
    // path runs for both the synchronous static fallback (immediate) and the
    // async Firestore overlay (when `taxonomy/case` doc is available). The
    // build rebuilds every global the legacy inline JS in index.html /
    // admin.html depends on — so dynamic re-renders that re-read these
    // globals automatically pick up Firestore-edited data.
    function buildCaseTaxonomyGlobals(systems) {
        window.CASE_SYSTEMS = systems;
        window.CASE_SYSTEM_BY_KEY = Object.fromEntries(systems.map(s => [s.key, s]));

        // index.html:  caseTaxonomyCatalog
        window.caseTaxonomyCatalog = systems.map(s => ({
            key: s.key,
            label: s.label.en,
            thaiLabel: s.label.th,
            symptoms: s.symptoms
        }));

        // index.html:  CASE_SYSTEM_EMOJI
        window.CASE_SYSTEM_EMOJI = Object.fromEntries(systems.map(s => [s.key, s.emoji]));

        // admin.html:  alabastaTaxonomyCatalog (V91.84: EN/KR/TH labels + symptoms→tags)
        window.alabastaTaxonomyCatalog = systems.map(s => ({
            key: s.key,
            label: s.label.en,
            thaiLabel: s.label.th,
            koLabel: s.label.ko,
            tags: s.symptoms
        }));

        // admin.html:  PRIMARY_SYSTEMS (V91.83 bilingual EN+KR button label)
        window.PRIMARY_SYSTEMS = systems.map(s => ({
            value: s.key,
            label: `${s.emoji} ${s.label.en} ${s.label.ko}`,
            code: s.label.en
        }));
    }

    // Synchronous boot — static fallback. Callers that read globals before
    // the Firestore overlay completes see the bundled 12 systems and never
    // get a null/undefined. Identical shape to legacy V91.84 behavior.
    buildCaseTaxonomyGlobals(CASE_SYSTEMS);
    window.CASE_TAXONOMY_SOURCE = 'static';

    // V94.53 Phase 1: async Firestore overlay. `taxonomy/case` (single doc)
    // schema: { systems: [{key, emoji, label{en,ko,th}, symptoms[]}, ...] }.
    // Rules: read=public, write=admin only (Phase 2 wires write). Failure
    // modes (doc missing / network error / SDK unavailable) all keep the
    // static fallback in place — production behavior unchanged until the
    // migration writes the doc.
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
            firebase.firestore().collection('taxonomy').doc('case').get()
                .then(function (doc) {
                    if (doc.exists) {
                        const data = doc.data();
                        if (Array.isArray(data.systems) && data.systems.length > 0) {
                            buildCaseTaxonomyGlobals(data.systems);
                            window.CASE_TAXONOMY_SOURCE = 'firestore';
                            document.dispatchEvent(new CustomEvent('case-taxonomy-loaded', {
                                detail: { source: 'firestore', count: data.systems.length }
                            }));
                            return;
                        }
                    }
                    // Doc missing or malformed — static fallback stays in place.
                    document.dispatchEvent(new CustomEvent('case-taxonomy-loaded', {
                        detail: { source: 'static-fallback-missing-doc', count: CASE_SYSTEMS.length }
                    }));
                })
                .catch(function (err) {
                    console.warn('[case-taxonomy] Firestore overlay failed, using static fallback:', err && err.message);
                    document.dispatchEvent(new CustomEvent('case-taxonomy-loaded', {
                        detail: { source: 'static-fallback-error', error: err && err.message }
                    }));
                });
        } catch (e) {
            // firebase.firestore() threw — defensive: keep static fallback.
            console.warn('[case-taxonomy] Firestore not ready, using static fallback:', e && e.message);
        }
    }
})();
