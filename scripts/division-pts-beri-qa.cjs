// V101.147 / V102.238: ⋯ sits right of Flood watch; hidden in the CAFE UI; Audit not offered as a quiz audience; the 🌸 chip lists cafePts / cafeBeri.
const fs = require('fs'), path = require('path'), vm = require('vm');
const pub = p => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8');
const idx = pub('index.html'), adm = pub('admin.html'), css = pub('cafe-content.css');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.error('FAIL', m); } else console.log('ok', m); };

const fw = idx.indexOf('id="fw-btn"'), more = idx.indexOf('id="activity-more"');
ok(fw > 0 && more > fw, '⋯ button comes after Flood watch in the rail');
ok(idx.slice(fw, more).split('<button').length === 2, '⋯ is the very next button after #fw-btn');
ok((idx.match(/class="[^"]*activity-more/g) || []).length === 1, 'exactly one ⋯ button');
ok(/body\.cafe-mode #activity-more/.test(css), '⋯ is hidden in the CAFE UI (its panel lives in the hidden metrics bar)');

function grab(src, head) {
    const i = src.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
// Audit not offered
const opts = [];
const sel = { options: [{ value: 'Public' }], add: o => sel.options.push(o) };
const ctx = { document: { getElementById: () => sel, createElement: () => ({}) }, getGlobalGroups: () => ['EXTERN', 'Audit', 'CAFE', 'audit '] };
vm.createContext(ctx); vm.runInContext(grab(adm, 'function refreshQuizTargetGroupOptions()'), ctx); ctx.refreshQuizTargetGroupOptions();
const names = sel.options.map(o => o.value);
ok(names.includes('EXTERN') && names.includes('CAFE') && !names.some(n => n.trim().toLowerCase() === 'audit'), 'Target Group list: Audit gone, others stay → ' + names.join(','));

// chip list
const els = {}; const el = id => els[id] || (els[id] = { textContent: '', innerHTML: '', setAttribute() {}, style: {} });
const c2 = {
    document: { getElementById: el }, divisionConfig: { 'Content Creator': ['Blossom'], RSU: ['EXTERN'], Audit: [] },
    usersData: [
        { id: 'a', displayName: 'Nid', group: 'Blossom', division: 'Content Creator', cafePts: 41.256, cafeBeri: 120 },
        { id: 'b', displayName: 'Tan', group: 'Audit', division: 'Audit', cafePts: 27, cafeBeri: 60 },
        { id: 'c', displayName: 'Rsu', group: 'EXTERN', division: 'RSU', score: 99, beri: 999 },
        { id: 'd', displayName: 'Hidden', group: 'Blossom', division: 'Content Creator', cafePts: 500, isIgnored: true },
    ],
    userInDivision: (u, d) => u.division === d, userInScope: (u, g) => String(u.group).toLowerCase() === String(g).toLowerCase(),
    escapeHtml: s => String(s), parseInt, parseFloat, Number,
};
vm.createContext(c2); vm.runInContext(grab(adm, 'function cafePBUsers()') + grab(adm, 'function renderCafePB()') + ';var cafePBSort="pts";', c2); c2.renderCafePB();
const html = els['cafepb-body'].innerHTML;
ok(els['cafepb-chip-n'].textContent === 2, 'chip counts 2 (CAFE + Audit; RSU and hidden excluded)');
ok(html.includes('41.26') && html.includes('120') && !html.includes('999') && !html.includes('500'), 'shows cafePts/cafeBeri, not score/beri, not hidden users');
ok(/⭐ 68\.26 · 🪙 180/.test(els['cafepb-summary'].textContent), 'summary totals ' + els['cafepb-summary'].textContent);
ok(adm.includes('id="cafepb-chip"') && adm.includes('id="cafepb-panel"') && /renderBadgeStatsChip\(\);\r?\n\s+renderCafePB\(\);/.test(adm), 'chip + panel markup present, refreshed with Badge Stats');
process.exit(fail ? 1 : 0);
