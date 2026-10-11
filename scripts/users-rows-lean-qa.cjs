// V102.181: Users (Elite Board) rows lean — less duplication per row. The "RSU · EXTERN" chip stays after the name (owner's call); instead:
// 1 an institute that starts with the user's division name (RSU, CU69 under CU) leaves the second line (tooltip only); no fullName → "add name";
// 3 hide what is empty (no "—" / "📝0"; the badges line goes when both are empty);
// 4 ⏳ = ONE stacked block: days bar + 2px hours line + one text line "5d left · 180/200 h"; a period > 400 days → "⚠ dates 1988 → 2027";
// 6 the dashed "tap to adjust" underline on the numbers shows on the hovered row only.
// Static pins + the REAL row code cut out of admin.html and run in vm.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
for (const css of ['.u-tl { display: inline-flex; flex-direction: column;', '.u-tl-bar-h { height: 2px;', 'tr:hover .u-num-tap, .u-num-tap:focus-visible { border-bottom-color: currentColor; }', '.u-num-tap { border-bottom-color: transparent; }'])
    assert.ok(html.includes(css), 'css: ' + css);
assert.ok(!html.includes("color:${logsN ? '#e67e22' : '#cbd5e1'}"), 'no grey 📝0 any more');
assert.ok(html.includes('${(_badgesHtml || _logsHtml) ?'), 'the badges line goes when both are empty');
assert.ok(html.includes('userGroupTagHtml(d)'), 'the RSU · EXTERN chip is still after the name');

// ---- ⏳ block ----
const tlBlock = html.slice(html.indexOf("                    let daysRemainingHtml = '', _tl = null;"), html.indexOf('                    const userCode = d.enrollmentCode'));
assert.ok(tlBlock.length > 500, 'found the days + hours block');
const tl = d => { const c = { d, escapeHtml: s => String(s) }; vm.createContext(c); vm.runInContext(tlBlock + '\nthis.out = { days: daysRemainingHtml, hours: hoursHtml };', c); return c.out; };
const fmt = x => new Date(Date.now() + x * 86400000).toISOString().slice(0, 10);
// dates + hours → ONE .u-tl with both bars and the merged text; no separate hours block
const both = tl({ id: 'bua', startDate: fmt(-35), endDate: fmt(5), internHoursTarget: 200, internHours: { status: 'ok', total: 179.7, days: 20 } });
assert.equal((both.days.match(/class="u-tl"/g) || []).length, 1, 'one block');
assert.ok(both.days.includes('u-tl-bar-h'), 'hours line under the days bar');
assert.ok(/class="u-tl-h"[^>]*onclick="openInternHoursDetail\(event, 'bua'\)"[^>]*><b[^>]*>180<\/b>\/200 h<\/button>/.test(both.days), 'hours text "180/200 h" is the button to the day-by-day popup');
assert.ok(/<b style="color:#f97316;">5d<\/b> left · 41d/.test(both.days), 'days text: 5d left · 41d');
assert.equal(both.hours, '', 'the separate hours block is gone when dates exist');
// a broken time-clock link keeps its ⚠
assert.ok(/class="u-tl-h"[^>]*>⚠ <b/.test(tl({ id: 'nt', startDate: fmt(-1), endDate: fmt(30), internHoursTarget: 100, internHours: { status: 'no-match', total: 50 } }).days), 'no-match → ⚠ on the hours part');
// dates only → days block alone, no hours line
const only = tl({ id: 'x', startDate: fmt(-10), endDate: fmt(20) });
assert.ok(only.days.includes('class="u-tl"') && !only.days.includes('u-tl-bar-h') && only.hours === '', 'days only');
// hours without dates → the old stand-alone button
const hOnly = tl({ id: 'h', internHoursTarget: 200, internHours: { status: 'ok', total: 100, days: 10 } });
assert.equal(hOnly.days, ''); assert.ok(/<button type="button" onclick="openInternHoursDetail\(event, 'h'\)"[^>]*>.*<b[^>]*>100\.0<\/b> \/ 200 h/s.test(hOnly.hours), 'no dates → the stand-alone hours button');
// wrong dates (80 years) → ⚠ with the years, no "15369d left"
const bad = tl({ id: 'j', startDate: '1988-11-08', endDate: '2027-11-08' });
assert.ok(bad.days.includes('⚠</b> dates 1988 → 2027') && !/\d{4,}d left/.test(bad.days), 'bad dates → ⚠ dates 1988 → 2027');
assert.ok(bad.days.includes('title="Check the internship dates: 1988 → 2027'), 'tooltip names the problem');
assert.ok(bad.days.includes('width:0%'), 'no progress drawn for a bad period');

// ---- institute / name line ----
const certBlock = html.slice(html.indexOf('                    const _instRaw = d.institute'), html.indexOf('                    const _certHasMore'));
assert.ok(certBlock.length > 200, 'found the name-line block');
const cert = (d, dv) => { const c = { d, userDivisionOf: () => dv }; vm.createContext(c); vm.runInContext(certBlock + '\nthis.out = JSON.stringify({ s: _certSummary, tip: _certTip });', c); return JSON.parse(c.out); };
assert.deepEqual(cert({ fullName: 'ณัชชา', institute: 'RSU' }, 'RSU'), { s: 'ณัชชา', tip: 'ณัชชา · RSU' }, 'institute = division → hidden, kept in the tooltip');
assert.equal(cert({ fullName: 'ธนพล', institute: 'CU69' }, 'CU').s, 'ธนพล', 'CU69 under CU → hidden');
assert.equal(cert({ fullName: 'ธนพล', institute: 'Rangsit University' }, 'RSU').s, 'ธนพล · Rangsit University', 'a different institute stays');
assert.equal(cert({ fullName: 'ธนพล', institute: 'CU69' }, '').s, 'ธนพล · CU69', 'no division → shown');
assert.equal(cert({ fullName: '', institute: 'CU' }, 'CU').s, '', 'no name, institute hidden → empty (renders "add name")');
assert.ok(html.includes("${_certSummary || '<span style=\"color:#cbd5e1;\">add name</span>'}"), '"add name" placeholder');
console.log('PASS: Users rows lean — institute hidden when it repeats the division, hide-empty badges/📝, one stacked ⏳ block (+⚠ bad dates), number underline on hover only, division chip kept');
