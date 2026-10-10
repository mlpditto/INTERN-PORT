// V101.102: a user whose users/{uid} doc was deleted must land on Register again, not in the app as a 0-point ghost.
// Root cause (seen on prod 2026-10-10): background writers did set(..., {merge:true}) on the missing doc — preferredLanguage, reflective stats,
// badges — which re-created it; checkUser then saw `exists` and skipped enrollment. Fix: those writers use update() (fails on a missing doc),
// and checkUser only treats a doc as registered when enrollment ever wrote score / group / enrollmentCode / createdAt.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const idx = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');

// The real predicate, cut out of index.html by brace matching.
function grab(name) {
    const i = idx.indexOf('function ' + name + '(');
    assert.ok(i >= 0, name + ' exists');
    let d = 0, j = idx.indexOf('{', i);
    for (let k = j; k < idx.length; k++) { if (idx[k] === '{') d++; else if (idx[k] === '}' && --d === 0) return { src: idx.slice(i, k + 1), end: k + 1 }; }
    throw new Error('unbalanced ' + name);
}
const isRegisteredUserDoc = new Function(grab('isRegisteredUserDoc').src + '; return isRegisteredUserDoc;')();

// The exact ghost seen on prod (field names only) is NOT registered…
const ghost = {}; ['badges', 'displayName', 'lastSeen', 'pictureUrl', 'preferredLanguage', 'reflectiveBadges', 'reflectiveBestStreak', 'reflectiveClaimedBonuses', 'reflectiveCurrentStreak', 'reflectiveLastSync', 'reflectiveReviewedLogs', 'reflectiveTotalLogs'].forEach(k => { ghost[k] = 'x'; });
assert.equal(isRegisteredUserDoc(ghost), false, 'the prod ghost is not registered');
assert.equal(isRegisteredUserDoc({}), false);
assert.equal(isRegisteredUserDoc(undefined), false);
assert.equal(isRegisteredUserDoc({ personality: {}, bucketList: [], googleLink: {}, socialDrafts: [], beri: 3 }), false, 'other self-written fields do not make a user');
// …and anything enrollment / pre-registration writes IS (29 of 29 real prod users have at least one of these).
for (const k of ['score', 'group', 'enrollmentCode', 'createdAt']) assert.equal(isRegisteredUserDoc({ displayName: 'a', [k]: k === 'score' ? 0 : 'x' }), true, k + ' marks a registered user (score 0 counts)');

// checkUser only runs the signed-in branch for a registered doc, otherwise it shows Register.
const check = grab('checkUser').src;
assert.ok(/r\.onSnapshot\(d => \{\n\s*if \(d\.exists && isRegisteredUserDoc\(d\.data\(\)\)\) \{/.test(check), 'checkUser gates on isRegisteredUserDoc');
assert.ok(/\} else \{\n\s*\/\/ First time user — show enrollment modal\n\s*showEnrollmentModal\(\);/.test(check), 'else branch still opens Register');

// The three boot-time writers must not be able to create the doc.
const lang = grab('syncPreferredLanguage').src, refl = grab('syncReflectiveGamification').src;
assert.ok(/\.update\(\{ preferredLanguage: lang \}\)/.test(lang) && !/merge:\s*true/.test(lang), 'preferredLanguage uses update');
assert.ok(/\.update\(payload\)/.test(refl) && !/merge:\s*true/.test(refl), 'reflective sync uses update');
assert.ok(/'badges\.' \+ k/.test(idx) && /\.update\(badgeUpdate\)/.test(idx) && !/set\(\{ badges: updates \}, \{ merge: true \}\)/.test(idx), 'badge unlock uses update with dotted paths');
// (a dotted-path update still adds one badge without clobbering the others — that is Firestore's documented behaviour; the old set-merge
// deep-merged the same way, so nothing the user already earned is replaced.)

console.log('PASS: deleted-user ghost — only a doc with score/group/enrollmentCode/createdAt counts as registered (prod ghost → Register again); language, reflective-stats and badge writers use update() so they cannot re-create a deleted user');
