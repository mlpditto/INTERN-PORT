// V102.427: Case Card Studio — the status pill counts the seconds while an image is generating and keeps the total once it is ready.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const i = html.indexOf('function setAlabastaCaseCardImageLoadingState('); assert.ok(i > 0);
const end = html.slice(i).search(/\r?\n {8}\}\r?\n/); assert.ok(end > 0);
const src = html.slice(i, i + end + 10);

let now = 1_000_000, ticks = [];
const pill = { className: '', innerHTML: '', querySelector: () => { const m = pill.innerHTML.match(/cc-gen-time[^>]*>([^<]*)</); return m ? { set textContent(v) { pill.innerHTML = pill.innerHTML.replace(/(cc-gen-time[^>]*>)[^<]*/, '$1' + v); } } : null; } };
const els = { 'alabasta-case-card-image-status': pill };
const win = {};
const ctx = { window: win, document: { getElementById: id => els[id] || null }, Date: { now: () => now },
    setInterval: fn => { ticks.push(fn); return ticks.length; }, clearInterval: id => { if (id) ticks[id - 1] = null; }, Math, String };
vm.createContext(ctx); vm.runInContext(src + '; this.set = setAlabastaCaseCardImageLoadingState;', ctx);
const tick = s => { now += s * 1000; ticks.filter(Boolean).forEach(f => f()); };
const text = () => pill.innerHTML.replace(/<[^>]+>/g, '').trim();

ctx.set(true, 'GPT Image 2.5 Sunburst');
assert.equal(text(), 'Generating 0:00', 'starts at 0:00');
tick(12); assert.equal(text(), 'Generating 0:12', 'counts up each second');
tick(53); assert.equal(text(), 'Generating 1:05', 'minutes:seconds past a minute');
ctx.set(false, 'GPT Image 2.5 Sunburst');
assert.equal(text(), 'Ready · 1:05', 'done → Ready keeps the total');
assert.equal(ticks.filter(Boolean).length, 0, 'the counter stops');
tick(5); assert.equal(text(), 'Ready · 1:05', 'and no longer changes');
ctx.set(true, 'x'); tick(3); assert.equal(text(), 'Generating 0:03', 'a second run starts from zero');
ctx.set(false, ''); ctx.set(false, ''); assert.equal(text(), 'Ready', 'a stray second stop shows no stale time');
console.log('casecard-gen-timer-qa: all checks passed');
