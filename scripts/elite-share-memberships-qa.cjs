// V102.215 — memberships on the admin boards (PR 3 of the option-A plan). Most of it already followed userInScope since V102.183 (Users list, Badge
// Stats, group/division share); what was left is the Elite Board "All" share text, which listed each division's top 5 by PRIMARY division only.
// A person who is also in a division now appears in that division's list (same score). The REAL copyLB + helpers cut from admin.html, in a vm.
// (The Elite strip #leaderboardList is display:none for good since V102.33, so nothing there was changed.)
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('<div id="leaderboardList" style="display:none;"></div>'), 'the Elite strip is still hidden — this PR leaves it alone');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
let shared = null;
const ctx = {
    divisionConfig: { RSU: ['EXTERN'], CAFE: ['Audit'] }, activeUserGroup: 'All', activeUserGroupDiv: undefined,
    usersData: [
        { id: 'a', displayName: 'Ann', group: 'EXTERN', division: 'RSU', score: 30 },
        { id: 'b', displayName: 'Bob', group: 'Audit', division: 'CAFE', score: 20 },
        { id: 'c', displayName: 'Cat', group: 'EXTERN', division: 'RSU', score: 25, memberships: [{ division: 'CAFE', group: 'Audit' }] },
        { id: 'd', displayName: 'Dan', group: 'Audit', division: 'CAFE', score: 10, isIgnored: true },
        { id: 'e', displayName: 'Eve', group: 'Public', score: 99 }
    ],
    document: { getElementById: () => ({ style: {} }), body: { appendChild() {}, removeChild() {} }, createElement: () => ({ select() {} }), execCommand() {} },
    liff: { isInClient: () => true, shareTargetPicker: ([m]) => { shared = m.text; } }, alert() {}, navigator: {}
};
vm.createContext(ctx);
vm.runInContext(['function userDivisionOf(', 'function userMemberships(', 'function userInDivision(', 'function userInScope(', 'async function copyLB('].map(m => grab(html, m)).join('\n'), ctx);
(async () => {
    await vm.runInContext('copyLB(true)', ctx);
    const lines = shared.split('\n');
    const section = name => { const i = lines.indexOf('🏅 ' + name); const out = []; for (let k = i + 1; k < lines.length && !lines[k].startsWith('🏅'); k++) if (lines[k].trim()) out.push(lines[k]); return out; };
    assert.deepEqual(section('RSU'), ['1. Ann (30)', '2. Cat (25)'], 'RSU: its own people');
    assert.deepEqual(section('CAFE'), ['1. Cat (25)', '2. Bob (20)'], 'CAFE: Cat is also in CAFE → listed there with the same score; hidden (Camp) Dan stays out');
    assert.ok(!shared.includes('Eve'), 'no division, no list');
    console.log('PASS: Elite share text — a membership puts the person on that division\'s list (same score), Camp users and Only I stay out');
})().catch(e => { console.error(e); process.exit(1); });
