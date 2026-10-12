// V101.131 — memberships on the intern side (PR 2 of the option-A plan): users.memberships [{division, group}] are
//   · sent by getLeaderboard (strings only, real divisions only, max 6),
//   · counted by myDivisionPeers (a member is ranked on that division's board too, same score),
//   · counted by audienceIncludesMe (a quiz made for the membership's group reaches them),
//   · marked "· also" on a board row whose primary division is not the one being shown.
// The primary pair (points, rank, my own board) is untouched. The REAL functions, cut from the files, in a vm.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const fnSrc = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(/\.\.\.publicMemberships\(u\),/.test(fnSrc), 'getLeaderboard spreads publicMemberships(u) into each row');
assert.ok(idx.includes('· also</span>'), 'a board row from another division is marked also');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}

// --- server projection
const sctx = {}; vm.createContext(sctx);
vm.runInContext(grab(fnSrc, 'function publicMemberships('), sctx);
const pm = u => JSON.parse(vm.runInContext('JSON.stringify(publicMemberships(' + JSON.stringify(u) + '))', sctx));
assert.deepEqual(pm({}), {}, 'no memberships → nothing added');
assert.deepEqual(pm({ memberships: [] }), {});
assert.deepEqual(pm({ memberships: [{ division: 'CAFE', group: 'Audit', extra: 'x' }] }), { memberships: [{ division: 'CAFE', group: 'Audit' }] }, 'strings only, no other fields');
assert.deepEqual(pm({ memberships: [{ division: '', group: 'Audit' }, { division: 'CAFE' }, null, { division: 'RSU', group: 'EXTERN' }] }), { memberships: [{ division: 'RSU', group: 'EXTERN' }] }, 'Only I / malformed pairs dropped');
assert.equal(pm({ memberships: Array.from({ length: 10 }, (_, i) => ({ division: 'D' + i, group: 'G' })) }).memberships.length, 6, 'capped at 6');

// --- client
const ctx = { divisionConfig: { RSU: ['EXTERN'], CAFE: ['Audit'] }, myGroup: 'EXTERN', myDivisionRaw: 'RSU', window: { myMemberships: [] } };
vm.createContext(ctx);
vm.runInContext(['function userDivisionOf(', 'function rowIsMemberOf(', 'function myDivisionPeers(', 'function audienceIncludesMe('].map(m => grab(idx, m)).join('\n'), ctx);
const peers = (list, o = {}) => { Object.assign(ctx, o); ctx.list = list; return vm.runInContext('myDivisionPeers(list).map(u => u.id).join(",")', ctx); };
const rows = [{ id: 'a', group: 'EXTERN', division: 'RSU' }, { id: 'b', group: 'Audit', division: 'CAFE' },
    { id: 'c', group: 'EXTERN', division: 'RSU', memberships: [{ division: 'CAFE', group: 'Audit' }] }, { id: 'd', group: 'Audit', division: 'CAFE', memberships: [{ division: 'RSU', group: 'EXTERN' }] }];
assert.equal(peers(rows), 'a,c,d', 'RSU board = RSU people + the CAFE person who is also in RSU');
assert.equal(peers(rows, { myGroup: 'Audit', myDivisionRaw: 'CAFE' }), 'b,c,d', 'CAFE board = CAFE people + the RSU person who is also in CAFE');
assert.equal(peers(rows, { myGroup: 'Public', myDivisionRaw: '' }), '', 'Only I: memberships do not leak in');
assert.equal(vm.runInContext('rowIsMemberOf({ memberships: [{ division: "CAFE" }] }, "")', ctx), false, 'an empty division is never a membership match');

const aud = (t, mem, g = 'EXTERN') => { ctx.myGroup = g; ctx.window.myMemberships = mem; return vm.runInContext('audienceIncludesMe(' + JSON.stringify(t) + ')', ctx); };
assert.equal(aud('Audit', []), false, 'a quiz for Audit does not reach an EXTERN-only intern');
assert.equal(aud('Audit', [{ division: 'CAFE', group: 'Audit' }]), true, '…but does reach someone also in Audit');
assert.equal(aud('audit', [{ division: 'CAFE', group: 'Audit' }]), true, 'case-insensitive');
assert.equal(aud('Junior,Audit', [{ division: 'CAFE', group: 'Audit' }]), true, 'comma lists');
assert.equal(aud('Public', []), true); assert.equal(aud('EXTERN', []), true, 'the primary group still works');
console.log('PASS: memberships on the intern side — getLeaderboard projection, member on a second board, quiz audience, primary untouched');
