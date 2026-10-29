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
console.log('submit-confirm-langs-check: PASS');
