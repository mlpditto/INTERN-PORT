// V102.310: User Hub row rail — 📎 Documents took the 📅 slot; 📅 Set period lives in the ⋯ menu (where 📎 was). Static.
const fs = require('node:fs'), assert = require('node:assert/strict');
const h = fs.readFileSync('public/admin.html', 'utf8');
const rail = h.slice(h.indexOf("userRowQuick('${d.id}', 'docs')") - 200, h.indexOf("userRowQuick('${d.id}', 'cert')") + 120);
assert.ok(/'docs'\)" title="Documents · เอกสาร[\s\S]*?📎<\/button>`[\s\S]*?'history'\)[\s\S]*?'log'\)[\s\S]*?'cert'\)/.test(rail), 'rail order: 📎 · 📜 · ⬆ · 🎓');
assert.ok(!/userRowQuick\('\$\{d\.id\}', 'period'\)/.test(h), 'no 📅 in the rail');
assert.ok(/<button type="button" disabled title="No applicant record to attach to/.test(rail), 'no applicant record → 📎 disabled, not missing (the rail keeps its shape)');
assert.ok(/else if \(act === 'docs'\) \{ const o = applicantOwnerFor\(u\); if \(o\) openApplicantDocs\(o\); \}/.test(h), 'userRowQuick docs → the owner\'s Documents sheet');
const menu = h.slice(h.indexOf('const items = ['), h.indexOf("['<i class=\"fa-solid fa-trash-can\"></i>', 'Delete user…'"));
assert.ok(!/\['📎'/.test(menu), '📎 left the menu');
assert.ok(menu.indexOf("['⏱', 'Internship hours…'") < menu.indexOf("['📅', 'Set period'") && menu.indexOf("'Log work for this user'") < menu.indexOf("['📅', 'Set period'") && menu.indexOf("['📅', 'Set period'") < menu.indexOf("'Merge / transfer data'"), '📅 sits where 📎 was: after Log work, before Merge');
assert.ok(!/const apdOwner = applicantOwnerFor\(u\);/.test(menu), 'the menu no longer computes the applicant owner');
// V102.312: a const read before its declaration in the same block is a TDZ ReferenceError — renderTable threw on every row (no users shown)
const declAt = h.indexOf('const _apdOwner = '), useAt = h.indexOf('${_apdOwner ? ');
assert.ok(declAt > 0 && useAt > declAt && useAt - declAt < 3000, '_apdOwner is declared before actionsGroup reads it');
console.log('PASS: row rail 📎 ⇄ menu 📅 swap');
