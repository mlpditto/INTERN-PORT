// V101.236: the quiz Submit confirm names every language the quiz translation chip offers — 🇺🇸 EN · 🇹🇭 TH · 🇰🇷 KR · 🇯🇵 JA · 🇨🇳 ZH — in both variants (all answered / some unanswered).
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
const at = src.indexOf('const confirmMsg = hasEmptyAnswers');
assert(at > 0, 'confirmMsg found');
const block = src.slice(at, src.indexOf('if (!confirm(confirmMsg))', at));
const lits = [...block.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse('"' + m[1] + '"'));
assert.equal(lits.length, 2, 'two messages: unanswered / confirm');
const FLAGS = ['🇺🇸', '🇹🇭', '🇰🇷', '🇯🇵', '🇨🇳'];
for (const msg of lits) {
    const lines = msg.split('\n');
    assert.equal(lines.length, 5, 'five lines, one per language: ' + JSON.stringify(msg));
    assert.deepEqual(lines.map(l => l.slice(0, 4)), FLAGS, 'EN · TH · KR · JA · ZH in this order');
    assert.ok(/[぀-ヿ]/.test(lines[3]) && /[一-鿿]/.test(lines[4]), 'the JA line has kana, the ZH line has hanzi');
    assert.ok(lines.every(l => l.length > 6), 'no empty line');
}
// the quiz translation chip really offers ja / zh (this is why the confirm must name them)
assert.ok(/code: 'ja'/.test(src) && /code: 'zh'/.test(src), 'ja / zh are quiz languages');
// V101.254 (owner): the ONE-TIME Practice confirm carries one short JA and one short ZH line (first run = no points, the real exam needs admin approval)
{ const a = src.indexOf('const practiceMsg = '), b = src.slice(a, src.indexOf('if (confirm(practiceMsg))', a));
  const ja = (b.match(/🇯🇵 ([^`]*?)\\n/) || [])[1] || '', zh = (b.match(/🇨🇳 ([^`]*?)\\n/) || [])[1] || '';
  assert.ok(/[぀-ヿ]/.test(ja) && /得点なし/.test(ja) && /承認/.test(ja), 'ONE-TIME JA line: ' + ja);
  assert.ok(/不计分/.test(zh) && /批准/.test(zh), 'ONE-TIME ZH line: ' + zh);
  assert.ok(ja.length <= 40 && zh.length <= 40, 'both stay one short line');
  assert.ok(b.indexOf('🇰🇷') < b.indexOf('🇯🇵') && b.indexOf('🇯🇵') < b.indexOf('🇨🇳') && b.indexOf('🇨🇳') < b.indexOf('⚠️'), 'after KR, before the warning'); }
console.log('submit-confirm-langs-check: PASS');
