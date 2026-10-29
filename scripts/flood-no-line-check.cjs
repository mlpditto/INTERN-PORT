// V102.496: flood alerts and the single-case "New Case Submitted" bubble do not use the LINE push quota any more (both are e-mailed).
// Source check: the switch is off and BOTH flood pushes (home/site 'floodAlert', group 'floodTier') sit behind it; the e-mail stays.
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('functions/index.js', 'utf8');
assert(/^const FLOOD_LINE_PUSH = false;/m.test(src), 'FLOOD_LINE_PUSH is declared and false');
const fa = src.indexOf("pushLineFlex('floodAlert'"), ft = src.indexOf("pushLineFlex('floodTier'");
assert(fa > 0 && ft > 0, 'both flood pushes still exist (one switch brings them back)');
const guarded = (at) => src.slice(Math.max(0, at - 260), at).includes('FLOOD_LINE_PUSH &&');
assert(guarded(fa), "'floodAlert' push is behind FLOOD_LINE_PUSH");
assert(guarded(ft), "'floodTier' push is behind FLOOD_LINE_PUSH");
assert(src.includes('await sendFloodMail(m.subject, m.text);'), 'the early-warning e-mail is untouched');
const others = [...src.matchAll(/pushLineFlex\('(flood[A-Za-z]*)'/g)].map(m => m[1]);
assert.deepEqual(others.sort(), ['floodAlert', 'floodTier'], 'no other flood push appears unguarded: ' + others);
// single case: the LINE loop runs over no targets unless CASE_LINE_PUSH, and the case e-mail stays
assert(/^const CASE_LINE_PUSH = false;/m.test(src), 'CASE_LINE_PUSH is declared and false');
assert(src.includes('for (const target of (CASE_LINE_PUSH ? targets : []))'), 'the new-case LINE loop is behind CASE_LINE_PUSH');
assert(src.includes("await sendAdminMail('INTERN-PORT Cases'"), 'the new-case e-mail is untouched');
console.log('flood-no-line-check: PASS');
