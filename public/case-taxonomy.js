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

    const CASE_SYSTEM_BY_KEY = Object.fromEntries(CASE_SYSTEMS.map(s => [s.key, s]));

    // Primary canonical exports
    window.CASE_SYSTEMS = CASE_SYSTEMS;
    window.CASE_SYSTEM_BY_KEY = CASE_SYSTEM_BY_KEY;

    // ── Compat shims (kept identical to legacy shapes) ────────────────────
    // These let existing inline JS in index.html / admin.html keep using the
    // old names. Drop the in-file `const` declarations and these shims fill
    // the gap. New code should prefer CASE_SYSTEMS / CASE_SYSTEM_BY_KEY.

    // index.html:  caseTaxonomyCatalog (was 10 entries; now 12 incl. renal/heme)
    window.caseTaxonomyCatalog = CASE_SYSTEMS.map(s => ({
        key: s.key,
        label: s.label.en,
        symptoms: s.symptoms
    }));

    // index.html:  CASE_SYSTEM_EMOJI (was object {key: emoji})
    window.CASE_SYSTEM_EMOJI = Object.fromEntries(CASE_SYSTEMS.map(s => [s.key, s.emoji]));

    // admin.html:  alabastaTaxonomyCatalog (had thaiLabel + tags fields)
    window.alabastaTaxonomyCatalog = CASE_SYSTEMS.map(s => ({
        key: s.key,
        label: s.label.en,
        thaiLabel: s.label.th,
        tags: s.symptoms
    }));

    // admin.html:  PRIMARY_SYSTEMS (button group; previously had 8 items with
    // a different `endo` key vs the rest of the codebase's `endocrine`.
    // Unified to `endocrine` so all code paths agree.)
    window.PRIMARY_SYSTEMS = CASE_SYSTEMS.map(s => ({
        value: s.key,
        label: `${s.emoji} ${s.label.th}`,
        code: s.label.en
    }));
})();
