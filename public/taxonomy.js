// V94.15: Tri-lingual LP tag taxonomy + Straw Hat easter-egg colors (Phase A polish)
// Data source for #rl-lp-pane and #rl-lp-toggle-body Suggested chips.
// Schema unchanged — LP entries still write tags[] as flat string array.
//
// V94.55 Phase 1: async Firestore overlay across 3 docs:
//   taxonomy/lp_medical, taxonomy/lp_skill, taxonomy/lp_tool
//   Each doc shape: { systems: [{key, label{en,ko,th}, tags[]}, ...] }
// Axis metadata (icon/easterEgg/colors/label) stays bundled in this file —
// only systems[] is overlay-eligible. If a doc is missing or fetch fails,
// that axis falls back to its static `systems`. LP_ALL_TAGS is rebuilt after
// overlay so fuzzy match stays consistent. Fires `lp-taxonomy-loaded` event.
// Rules: V94.53's `match /taxonomy/{type}` already covers lp_* types.

(function () {
    'use strict';

    // Static fallback baseline — also the seed source for the V94.55 migration
    // script. Each axis here keeps its `systems[]` until Firestore overlays it.
    const LP_TAXONOMY = {
        medical: {
            icon: '🩺',
            label: { en: 'Medical', ko: '의료', th: 'การแพทย์' },
            easterEgg: '🦌',
            colors: { border: '#fb7185', text: '#be123c', hoverBg: '#fff1f2' },
            systems: [
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
            ]
        },
        skill: {
            icon: '🎯',
            label: { en: 'Skill', ko: '스킬', th: 'ทักษะ' },
            easterEgg: '🗡️',
            colors: { border: '#4ade80', text: '#15803d', hoverBg: '#f0fdf4' },
            systems: [
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
            ]
        },
        tool: {
            icon: '🛠️',
            label: { en: 'Tool', ko: '도구', th: 'เครื่องมือ' },
            easterEgg: '🤖',
            colors: { border: '#38bdf8', text: '#0c4a6e', hoverBg: '#f0f9ff' },
            systems: [
                { key: 'tool', label: { en: 'Tool', ko: '도구', th: 'เครื่องมือ' },
                  tags: ['BOTNOI', 'CANVA', 'FACEBOOK', 'IG', 'LINE', 'SHOPEE', 'TIKTOK', 'GPT', 'GEMINI', 'CLAUDE', 'OTHER'] }
            ]
        }
    };

    // V94.55: expose `LP_TAXONOMY` as the canonical sync global, plus
    // `rebuildLpAllTags` so admin write paths (Phase 2) can refresh derived
    // state in-place after a Save without reloading the page.
    window.LP_TAXONOMY = LP_TAXONOMY;
    function rebuildLpAllTags() {
        const set = new Set();
        Object.values(window.LP_TAXONOMY).forEach(axis => {
            (axis.systems || []).forEach(sys => (sys.tags || []).forEach(t => set.add(String(t).toLowerCase())));
        });
        window.LP_ALL_TAGS = [...set];
    }
    rebuildLpAllTags();
    window.rebuildLpAllTags = rebuildLpAllTags;
    window.LP_TAXONOMY_SOURCE = 'static';

    // V94.55 Phase 1: async overlay — fetch 3 axis docs in parallel; for each
    // doc that returns a valid `systems[]`, replace LP_TAXONOMY[axis].systems
    // and keep the bundled axis metadata (icon/easterEgg/colors/label) intact.
    // Failures are non-fatal and per-axis: only the failed axis falls back to
    // static. Fires `lp-taxonomy-loaded` with per-axis source map.
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
            const db = firebase.firestore();
            const axisKeys = ['medical', 'skill', 'tool'];
            Promise.all(axisKeys.map(function (axis) {
                return db.collection('taxonomy').doc('lp_' + axis).get()
                    .then(function (snap) {
                        if (snap.exists) {
                            const data = snap.data();
                            if (Array.isArray(data.systems) && data.systems.length > 0) {
                                window.LP_TAXONOMY[axis].systems = data.systems;
                                return { axis: axis, source: 'firestore', count: data.systems.length };
                            }
                        }
                        return { axis: axis, source: 'static-fallback-missing-doc', count: window.LP_TAXONOMY[axis].systems.length };
                    })
                    .catch(function (err) {
                        console.warn('[lp-taxonomy] axis ' + axis + ' overlay failed:', err && err.message);
                        return { axis: axis, source: 'static-fallback-error', error: err && err.message };
                    });
            })).then(function (results) {
                rebuildLpAllTags();
                const allFirestore = results.every(function (r) { return r.source === 'firestore'; });
                window.LP_TAXONOMY_SOURCE = allFirestore ? 'firestore' : 'mixed';
                document.dispatchEvent(new CustomEvent('lp-taxonomy-loaded', { detail: { results: results } }));
            });
        } catch (e) {
            console.warn('[lp-taxonomy] Firestore not ready, using static fallback:', e && e.message);
        }
    }

    // Soft fuzzy match: returns suggested tag if input is close to a known tag.
    // Returns null on empty, exact match, or no good suggestion (>= threshold).
    window.lpSuggestSimilarTag = function (input, threshold) {
        if (!input || input.length < 3) return null;
        const lower = input.toLowerCase().trim();
        threshold = threshold || 0.7;
        let best = null;
        let bestScore = 0;
        for (const tag of window.LP_ALL_TAGS) {
            if (tag === lower) return null; // exact (case-insensitive) match — no hint needed
            const score = similarity(lower, tag);
            if (score > bestScore && score >= threshold) {
                bestScore = score;
                best = tag;
            }
        }
        return best;
    };

    function similarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0) return 1.0;
        return (longer.length - editDistance(longer, shorter)) / longer.length;
    }

    function editDistance(s1, s2) {
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let last = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else if (j > 0) {
                    let next = costs[j - 1];
                    if (s1[i - 1] !== s2[j - 1]) next = Math.min(next, last, costs[j]) + 1;
                    costs[j - 1] = last;
                    last = next;
                }
            }
            if (i > 0) costs[s2.length] = last;
        }
        return costs[s2.length];
    }
})();
