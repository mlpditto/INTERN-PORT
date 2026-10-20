// V102.347: the clip prompt's spoken language follows the narration line — Thai text → "(Thai, …, do not translate)",
// anything else stays "(English, …)". Runs the REAL glcEpisodePrompt from public/admin.html in a vm.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

const marker = 'window.glcEpisodePrompt = function(e) {';
const start = html.indexOf(marker);
assert.ok(start > 0, 'glcEpisodePrompt found');
let k = html.indexOf('{', start + marker.length - 1), depth = 0;
for (; k < html.length; k++) { if (html[k] === '{') depth++; else if (html[k] === '}') { depth--; if (!depth) break; } }
const ctx = vm.createContext({ window: { glcSeconds: () => 8, GM_STYLE_SAFE: 'original characters only', _glcSeries: { style: 'clean 3D', episodes: [{}] } } });
vm.runInContext(html.slice(start, k + 1), ctx);
const prompt = narration => ctx.window.glcEpisodePrompt({ n: 1, visual: 'A pharmacist at a counter', narration, fact: 'Take before breakfast' });
const spoken = p => p.split('\n').find(l => l.startsWith('Spoken narration'));

const th = spoken(prompt('อีโลบิกซิแบท ยาท้องผูกชนิดใหม่ ทานวันละห้ามิลลิกรัม ก่อนอาหารเช้า'));
assert.match(th, /^Spoken narration \(Thai, natural Thai pronunciation and tones/, 'a Thai line is spoken in Thai: ' + th);
assert.match(th, /do not translate\): "อีโลบิกซิแบท ยาท้องผูกชนิดใหม่ ทานวันละห้ามิลลิกรัม ก่อนอาหารเช้า"$/, 'the Thai line is passed as written');
assert.ok(!/English/.test(th), 'no "English" in a Thai narration line');

const mixed = spoken(prompt('Elobixibat อีโลบิกซิแบท 5 mg'));
assert.match(mixed, /^Spoken narration \(Thai,/, 'any Thai character → Thai');

const en = spoken(prompt('Elobixibat is taken once a day before breakfast.'));
assert.equal(en, 'Spoken narration (English, calm teacher voice, clear): "Elobixibat is taken once a day before breakfast."', 'an English line is unchanged');

const empty = spoken(prompt(''));
assert.match(empty, /^Spoken narration \(English,/, 'empty → English (as before)');

assert.ok(/No on-screen text, captions, letters or logos\./.test(prompt('ทดสอบ')), 'the no-text rule is still there');
console.log('PASS: clip prompt language follows the narration — Thai line → Thai (as written, no translation), English / empty → English unchanged');
