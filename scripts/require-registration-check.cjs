// V101.159 — an intern without an enrollment CODE cannot earn or submit: every score / Beri / submit entry point starts with requireRegistered(), which re-opens the enrollment modal.
// The real requireRegistered from public/index.html + a static scan that each guarded function really begins with it.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(head) {
    const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head);
    let d = 0;
    for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); }
}
let opened = 0;
const ctx = { window: {}, showEnrollmentModal() { opened++; } };
vm.createContext(ctx);
vm.runInContext(grab('function requireRegistered()'), ctx);
const rr = () => vm.runInContext('requireRegistered()', ctx);

assert.strictEqual(rr(), true, 'profile not answered yet → do not block (no flash during load)');
ctx.window.myRegistered = true; assert.strictEqual(rr(), true, 'registered → allowed');
assert.strictEqual(opened, 0);
ctx.window.myRegistered = false; assert.strictEqual(rr(), false, 'no registered doc → blocked'); assert.strictEqual(opened, 1, '… and the enrollment modal opens');

assert.ok(/window\.myRegistered = !!\(d\.exists && isRegisteredUserDoc\(d\.data\(\)\)\)/.test(html), 'the profile listener sets window.myRegistered');
const names = ['tryDailyCheckin', 'awardEngagementBonusIfDue', 'finAwardBeri', 'explOpenLink', 'redeemBeriReward', 'runQuiz', 'confirmRunQuiz', 'submitProduct', 'submitReflectiveLog', 'submitJournalEntry', 'submitLpNoteOnly', 'submitWork', 'submitUnified', 'submitUnifiedCase', 'submitUnifiedWork', 'submitCase', 'submitExploreReview', 'submitLinkSuggestion', 'submitFeedback', 'saveNerisResult', 'submitBig5'];
for (const n of names) {
    const m = html.match(new RegExp('async function ' + n + '\\([^)]*\\)\\s*\\{\\n\\s*if \\(!requireRegistered\\(\\)\\) return;'));
    assert.ok(m, n + ' must start with the registration guard');
}
console.log('PASS: registration guard — blocks only when the profile says "not registered", opens the enrollment modal, ' + names.length + ' score/submit entry points guarded');
