// public/th-holidays.json (Thai public holidays) + its builder scripts/build-th-holidays.cjs. The builder runs on a small ICS fixture (folded lines, zero-width
// space, escaped commas, substitution days, an incomplete year, an unknown name); the committed JSON is checked for shape, order, dates and English names.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseIcs, englishName, build, BUDDHIST } = require('./build-th-holidays.cjs');

// ---- the builder
const ev = (d, name, desc) => `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${d}\r\nSUMMARY:${name}\r\nDESCRIPTION:${desc || 'วันหยุดนักขัตฤกษ์'}\r\nEND:VEVENT\r\n`;
const ICS = 'BEGIN:VCALENDAR\r\n'
  + ev('20300303', 'วันมาฆบูชา') + ev('20300531', 'วันวิสาขบูชา') + ev('20300729', 'วันอาสาฬหบูชา')
  + ev('20300101', 'วันขื้นปีใหม่') + ev('20300103', 'วันหยุดชดเชยวันขื้นปีใหม่') + ev('20301211', 'ชดเชยวันรัฐธรรมนูญ') + ev('20301210', '​วันรัฐธรรมนูญ')
  + 'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20300728\r\nSUMMARY:วันเฉลิมพระชนมพรรษา สมเด็จพระเจ้าอยู่หัว\r\n มหาวชิราลงกรณ บดินทรเทพยวรา\r\nDESCRIPTION:วันหยุดนักขัตฤกษ์\r\nEND:VEVENT\r\n'
  + ev('20300214', 'วันวาเลนไทน์', 'วันสำคัญ') + ev('20310101', 'วันขื้นปีใหม่') + 'END:VCALENDAR\r\n';   // 2031 has no Buddhist days
const parsed = parseIcs(ICS);
assert.equal(parsed.length, 10, 'every all-day event is read');
assert.ok(parsed.some(e => e.th === 'วันรัฐธรรมนูญ'), 'the zero-width space is stripped');
assert.ok(parsed.find(e => e.d === '2030-07-28').th.includes('สมเด็จพระเจ้าอยู่หัว มหาวชิราลงกรณ') || parsed.find(e => e.d === '2030-07-28').th.includes('สมเด็จพระเจ้าอยู่หัวมหาวชิราลงกรณ'), 'a folded line is joined');
const { years, skipped } = build(parsed, 2026);
assert.deepEqual(Object.keys(years), ['2030'], 'only complete years (31 lacks the Buddhist days)'); assert.deepEqual(skipped, ['2031']);
const y30 = years['2030'];
assert.ok(!y30.some(h => h.th === 'วันวาเลนไทน์'), 'important days (not public holidays) are left out');
assert.deepEqual(y30.map(h => h.d), [...y30.map(h => h.d)].sort(), 'sorted by date');
assert.equal(y30.find(h => h.d === '2030-01-03').en, "Day off for New Year's Day", 'substitution (วันหยุดชดเชย…) → "Day off for …"');
assert.equal(y30.find(h => h.d === '2030-12-11').en, 'Day off for Constitution Day', 'substitution (ชดเชย…)');
assert.equal(englishName('วันไม่เคยมี'), null);
assert.throws(() => build(parseIcs(ICS + '').concat([{ d: '2030-09-09', th: 'วันที่ไม่รู้จัก', desc: 'วันหยุดนักขัตฤกษ์' }]), 2026), /No English name/, 'a new Thai name stops the build until it has an English name');
assert.deepEqual(build(parsed, 2031).years, {}, 'fromYear leaves earlier years out');

// ---- the committed file
const j = JSON.parse(fs.readFileSync('public/th-holidays.json', 'utf8'));
assert.ok(j.source && /^\d{4}-\d{2}-\d{2}$/.test(j.builtAt), 'source + builtAt');
const ys = Object.keys(j.years); assert.ok(ys.length >= 1, 'at least one year');
ys.forEach(y => {
  const list = j.years[y];
  assert.ok(list.length >= 15 && list.length <= 35, y + ': a plausible number of holidays (' + list.length + ')');
  list.forEach(h => {
    assert.match(h.d, /^\d{4}-\d{2}-\d{2}$/); assert.equal(h.d.slice(0, 4), y, h.d + ' is in ' + y);
    assert.equal(new Date(h.d + 'T00:00:00Z').toISOString().slice(0, 10), h.d, h.d + ' is a real date');
    assert.ok(h.th && h.en && !/[​]/.test(h.th + h.en), h.d + ' has Thai + English names');
  });
  assert.deepEqual(list.map(h => h.d + h.th), [...list.map(h => h.d + h.th)].sort(), y + ': sorted');
  assert.equal(new Set(list.map(h => h.d + h.th)).size, list.length, y + ': no duplicate');
  BUDDHIST.forEach(re => assert.ok(list.some(h => re.test(h.th)), y + ' is complete: ' + re));
  assert.ok(list.some(h => h.d === y + '-01-01') && list.some(h => h.d === y + '-12-10'), y + ': New Year\'s Day and Constitution Day are there');
});
console.log('PASS: th-holidays — builder (folded lines, zero-width space, substitution days, incomplete years skipped, unknown names stop the build) and the committed file (' + ys.map(y => y + ': ' + j.years[y].length).join(', ') + ')');
