// V101.116: a user's division is users.division (admin-set) — the same group name can sit in several divisions. A doc without the field keeps the old
// rule (the division whose group list holds users.group). The leaderboard peers, the division badge and the Content-Creator gate follow it.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const cafe = fs.readFileSync('public/cafe-content.js', 'utf8').replace(/\r\n/g, '\n');
const fnSrc = fs.readFileSync('functions/index.js', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx));
assert.ok(/getLeaderboard[\s\S]{0,900}typeof u\.division === 'string' \? \{ division: u\.division \} : \{\}/.test(fnSrc), 'getLeaderboard sends users.division when the doc has one');
assert.ok(!/relevantGroups/.test(idx), 'no leaderboard filter is built from "the groups listed under my division" any more');
assert.ok(idx.includes('myDivisionRaw = typeof da.division') && idx.includes('myDivisionRaw = typeof userData.division'), 'both user-doc paths keep myDivisionRaw');
assert.ok(cafe.includes('function primaryDivision(') && cafe.includes('isCreatorDivision(primaryDivision(primary))'), 'the Content gate uses the user\'s own division');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const ctx = { divisionConfig: { RSU: ['EXTERN', 'Junior', 'Audit'], CAFE: ['Audit', 'Marketing'] }, myGroup: 'Public', myDivisionRaw: undefined, allUsersData: [] };
vm.createContext(ctx);
vm.runInContext(['function userDivisionOf(', 'function getMyDivision(', 'function myDivisionPeers('].map(m => grab(idx, m)).join('\n'), ctx);
const div = u => vm.runInContext('userDivisionOf(' + JSON.stringify(u) + ')', ctx);

// derived (no users.division): the first division whose list holds the group
assert.equal(div({ group: 'EXTERN' }), 'RSU');
assert.equal(div({ group: 'marketing' }), 'CAFE', 'case-insensitive');
assert.equal(div({ group: 'Pharmacists' }), '', 'in no list → none (Only I)');
assert.equal(div({}), '', 'no group → Public → none');
// explicit wins — the same group name in two divisions
assert.equal(div({ group: 'Audit', division: 'CAFE' }), 'CAFE');
assert.equal(div({ group: 'Audit', division: 'RSU' }), 'RSU');
assert.equal(div({ group: 'EXTERN', division: '' }), '', 'explicit "" = none even though a list holds the group');
assert.equal(div({ group: 'EXTERN', division: 'GONE' }), '', 'a division that no longer exists counts as none');

// peers
const users = [
    { id: 'a', group: 'Audit', division: 'CAFE' }, { id: 'b', group: 'Audit', division: 'RSU' }, { id: 'c', group: 'Marketing' }, { id: 'd', group: 'EXTERN' },
    { id: 'e', group: 'Pharmacists' }, { id: 'f', group: 'Pharmacists', division: 'RSU' }, { id: 'g', group: 'Pharmacists' }
];
ctx.allUsersData = users;
const peers = (group, division) => { ctx.myGroup = group; ctx.myDivisionRaw = division; return vm.runInContext('myDivisionPeers(allUsersData).map(u => u.id).join("")', ctx); };
assert.equal(peers('Audit', 'CAFE'), 'ac', 'me = Audit in CAFE → CAFE people (the Audit in RSU is not mine)');
assert.equal(peers('Audit', 'RSU'), 'bdf', 'me = Audit in RSU → RSU people');
assert.equal(peers('Pharmacists', undefined), 'eg', 'no division → my group-mates who have no division either');
assert.equal(peers('EXTERN', undefined), 'bdf', 'EXTERN derives RSU → RSU people');
ctx.myGroup = 'Audit'; ctx.myDivisionRaw = 'CAFE';
assert.equal(vm.runInContext('getMyDivision()', ctx), 'CAFE');
ctx.myGroup = 'Pharmacists'; ctx.myDivisionRaw = undefined;
assert.equal(vm.runInContext('getMyDivision()', ctx), 'General Division', 'the old default label when there is none');
console.log('PASS: user division field — explicit users.division wins, legacy docs derive from the group list, peers + badge follow it');
