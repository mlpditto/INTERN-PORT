// V102.290: User Hub › Personal details — the Birthday read value shows the age against today ("2002-12-11 · 23 y" / "· 23 ปี").
// Runs the REAL gsAgeText() + the read-value line of gsRefreshProfileCards() from admin.html under a pinned clock (no Playwright).
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const adm = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

// ---------------------------------------------------------------- static pins
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(adm));
assert.ok(adm.includes("const age = row.querySelector('input').id === 'gs-birthday' ? gsAgeText(value) : '';"), 'only the birthday row gets an age');
assert.ok(adm.includes("textContent = (value || gsText('Not provided', 'ยังไม่ได้ระบุ')) + age;"), 'age is appended to the read value, not to the input');
assert.ok(adm.includes('<input type="date" id="gs-birthday" hidden>'), 'the birthday input is unchanged (Copy still reads it)');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const fn = grab(adm, 'function gsAgeText(');

// ---------------------------------------------------------------- behaviour under a pinned "today" (local clock, like the browser)
function run(todayIso, lang) {
    const ctx = { out: null, RealDate: Date };
    vm.createContext(ctx);
    vm.runInContext(
        'const FIXED = new RealDate(' + JSON.stringify(todayIso + 'T12:00:00') + ');' +
        'class Date extends RealDate { constructor(...a) { if (a.length) super(...a); else super(FIXED.getTime()); } }' +
        'const gsText = (en, th) => ' + JSON.stringify(lang) + ' === "th" ? th : en;' +
        fn + '; out = gsAgeText;', ctx);
    return ctx.out;
}
let age = run('2026-10-18', 'en');
assert.equal(age('2002-12-11'), ' · 23 y', 'birthday later this year → not yet 24');
assert.equal(age('2002-10-18'), ' · 24 y', 'birthday today counts');
assert.equal(age('2002-10-19'), ' · 23 y', 'birthday tomorrow does not');
assert.equal(age('2026-10-18'), ' · 0 y', 'born today → 0');
assert.equal(age(''), '', 'blank → nothing');
assert.equal(age('11/12/2002'), '', 'not ISO → nothing');
assert.equal(age('2027-01-01'), '', 'future date → nothing');
assert.equal(age('1850-01-01'), '', 'implausible (≥130) → nothing');
age = run('2026-10-18', 'th');
assert.equal(age('2002-12-11'), ' · 23 ปี', 'Thai unit');
age = run('2026-02-28', 'en');
assert.equal(age('2000-02-29'), ' · 25 y', 'leap-day birthday, the day before Feb 29 in a non-leap year → still 25');
age = run('2026-03-01', 'en');
assert.equal(age('2000-02-29'), ' · 26 y', '…and 26 from 1 March');

console.log('gs-birthday-age-qa: PASS');
