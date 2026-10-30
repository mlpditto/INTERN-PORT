// V102.541: Topic Map — pure logic (topic-map.js), the editor keeps the labels through Save, and the real review queue (topic-map-admin.js) on a fake db.
const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tmSrc = fs.readFileSync('public/topic-map.js', 'utf8'), adminSrc = fs.readFileSync('public/topic-map-admin.js', 'utf8'), html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const box = {}; vm.runInNewContext(tmSrc, { window: box, globalThis: box }); const TM = box.TopicMap;

// the 12 groups the owner approved; every id is unique
assert.equal(TM.GROUPS.length, 12, 'twelve groups');
const ids = TM.GROUPS.flatMap(g => g.topics.map(t => g.id + '.' + t[0]));
assert.equal(new Set(ids).size, ids.length, 'topic ids are unique'); assert.ok(ids.every(TM.isTopic) && !TM.isTopic('gi.nope') && !TM.isTopic(TM.OUT));

// the AI never sees the key
const quiz = { id: 'q1', title: 'T', isActive: true, questions: [{ q: 'Stem A', options: ['x', 'y'], correct: [1], explanation: 'SECRET-WHY', tags: 'GERD' }, { q: 'Stem B', options: ['p'], correct: [0] }] };
const rows = TM.rows([quiz, { id: 'd', isDraft: true, questions: [{ q: 'draft' }] }, { id: 'p', isPoll: true, questions: [{ q: 'poll' }] }, { id: 'r', quizType: 'read_only', questions: [{ q: 'read' }] }]);
assert.equal(rows.length, 2, 'drafts, polls and reading pages are left out');
const p = TM.prompt(rows); assert.ok(p.includes('Stem A') && p.includes('gi.gerd') && p.includes(TM.OUT)); assert.ok(!p.includes('SECRET-WHY') && !/"correct"/.test(p), 'no key and no explanation in the prompt');

// a bad reply changes nothing; only known ids, one per row, conf clamped
assert.equal(TM.readReply({ nope: 1 }, rows, 'm').length, 0);
const read = TM.readReply({ items: [{ n: 0, topic: 'gi.gerd', conf: 140 }, { n: 0, topic: 'gi.gerd', conf: 1 }, { n: 1, topic: 'made.up', conf: 50 }, { n: 9, topic: 'gi.gerd', conf: 50 }] }, rows, 'm');
assert.equal(read.length, 1); assert.equal(read[0].ai.conf, 100); assert.equal(read[0].ai.id, 'gi.gerd');

// marks: a question edited meanwhile is left alone; other fields survive; undo removes the label
const a = TM.applyMarks(quiz.questions, [{ i: 0, stem: 'Stem A', topicId: 'gi.gerd' }, { i: 1, stem: 'changed', topicId: 'gi.gerd' }]);
assert.equal(a.done, 1); assert.equal(a.skipped, 1); assert.equal(a.questions[0].topicId, 'gi.gerd'); assert.equal(a.questions[0].explanation, 'SECRET-WHY'); assert.deepEqual(a.questions[0].correct, [1]); assert.equal(quiz.questions[0].topicId, undefined, 'the input is not mutated');
assert.equal(TM.applyMarks(a.questions, [{ i: 0, stem: 'Stem A', topicId: '' }]).questions[0].topicId, undefined);

// states
assert.equal(TM.stateOf({}), 'new'); assert.equal(TM.stateOf({ ai: { conf: 79 } }), 'unsure'); assert.equal(TM.stateOf({ ai: { conf: 80 } }), 'review'); assert.equal(TM.stateOf({ topicId: 'gi.gerd', ai: { conf: 1 } }), 'ok'); assert.equal(TM.stateOf({ topicId: TM.OUT }), 'out');

// the editor rebuilds questions from the form — the labels must ride through it
assert.ok(/\.\.\.\(item\.dataset\.topicId \? \{ topicId: item\.dataset\.topicId \} : \{\}\), \.\.\.\(item\.dataset\.topicAi \? \{ topicAi: JSON\.parse\(item\.dataset\.topicAi\) \} : \{\}\)/.test(html), 'getQuizFormData keeps topicId + topicAi');
assert.ok(/div\.className = 'quiz-q-item';\n\s*if \(data && data\.topicId\) div\.dataset\.topicId = data\.topicId;[^\n]*\n\s*if \(data && data\.topicAi\) div\.dataset\.topicAi = JSON\.stringify\(data\.topicAi\);/.test(html), 'addQuestionUI puts them on the item');
const V = (html.match(/<title>Nika Admin \((V[\d.]+)\)/) || [])[1];
assert.ok(/<script src="topic-map\.js\?v=V[\d.]+"><\/script>/.test(html) && /<script src="topic-map-admin\.js\?v=V[\d.]+" defer><\/script>/.test(html), 'scripts loaded ' + V);
assert.ok(/id="quiz-topic-map"[^>]*ontoggle="TopicMapAdmin\.open\(\)"/.test(html));

const page_html = `<!doctype html><meta charset="utf-8"><style>body{font:14px sans-serif}.tm-row{display:block}</style>
<details id="quiz-topic-map" open><summary>m <span class="tm-sum"></span></summary><div class="tm-body"><div class="tm-top"><span class="tm-meter"><b></b></span><span class="tm-count"></span><button class="tm-ask" onclick="TopicMapAdmin.ask()"></button><button class="tm-bulk" onclick="TopicMapAdmin.confirmSure()"></button></div><input type="hidden" id="ai-topic-model" value="m1"><p class="tm-note"></p><div class="tm-chips"></div><div class="tm-list"></div></div></details>
<script>
window.__writes = []; window.__prompts = [];
window.quizzesData = [
 { id: 'q1', title: 'Q one', isActive: true, questions: [{ q: 'S0', options: ['a'], correct: [0] }, { q: 'S1', options: ['b'], correct: [0], topicAi: { id: 'gi.gerd', conf: 70, model: 'm' } }, { q: 'S2', options: ['c'], correct: [0], topicAi: { id: 'gi.gerd', conf: 95, model: 'm' } }, { q: 'S3', options: ['d'], correct: [0], topicAi: { id: '_out', conf: 95, model: 'm' } }] }];
var server = JSON.parse(JSON.stringify(window.quizzesData));
window.db = { collection: () => ({ doc: id => ({ id }) }), runTransaction: async fn => fn({ get: async ref => ({ exists: true, data: () => server.find(q => q.id === ref.id) }), update: (ref, d) => { window.__writes.push([ref.id, Object.keys(d)]); server.find(q => q.id === ref.id).questions = d.questions; } }) };
window.safeJsonParse = JSON.parse;
window.callUniversalAI = async (m, p, j) => { window.__prompts.push([m, j]); if (window.__fail) throw new Error('down'); return '{"items":[{"n":0,"topic":"skin.acne","conf":88}]}'; };
window.srv = () => server;
window.confirm = () => true;
</script><script>${tmSrc}</script><script>${adminSrc}</script>`;
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        await page.route('**/*', r => r.fulfill({ contentType: 'text/html', body: page_html }));
        await page.goto('https://qa.test/');
        await page.evaluate(() => TopicMapAdmin.open());
        const chips = () => page.$$eval('.tm-chip', c => c.map(x => x.textContent.trim()));
        assert.deepEqual(await chips(), ['⚠️ ไม่มั่นใจ 1', 'รอตรวจ 2', 'ยังไม่เสนอ 1', '✓ ยืนยันแล้ว 0', '🚫 ไม่เกี่ยวร้านยา 0']);
        assert.equal(await page.locator('.tm-row').count(), 1, 'starts on the unsure ones'); assert.equal(await page.locator('.tm-bulk').textContent(), '✓ ยืนยัน ≥ 90% (1)', 'the 🚫 proposal is never bulk-confirmed');
        // ✓ on the unsure row
        await page.click('.tm-row .tm-y'); await page.waitForFunction(() => srv()[0].questions[1].topicId === 'gi.gerd');
        assert.deepEqual(await page.evaluate(() => window.__writes[0]), ['q1', ['questions']], 'only the questions field is written');
        // bulk, then a 🚫 by hand, then undo
        await page.click('.tm-bulk'); await page.waitForFunction(() => srv()[0].questions[2].topicId === 'gi.gerd');
        await page.evaluate(() => TopicMapAdmin.filter('review')); await page.click('.tm-row button[aria-label="Not retail pharmacy"]'); await page.waitForFunction(() => srv()[0].questions[3].topicId === '_out');
        await page.evaluate(() => TopicMapAdmin.filter('out')); await page.click('.tm-row button[aria-label="Undo"]'); await page.waitForFunction(() => srv()[0].questions[3].topicId === undefined);
        // ✨ asks, stores a proposal only — no topicId
        await page.click('.tm-ask'); await page.waitForFunction(() => srv()[0].questions[0].topicAi);
        assert.deepEqual(await page.evaluate(() => [window.__prompts[0], srv()[0].questions[0].topicId === undefined, srv()[0].questions[0].topicAi.id, srv()[0].questions[0].correct]), [['m1', true], true, 'skin.acne', [0]], 'a proposal is not a label');
        // AI failure: message, nothing written
        await page.evaluate(() => { srv()[0].questions.push({ q: 'S4' }); window.quizzesData[0].questions.push({ q: 'S4' }); window.__fail = true; window.__writes.length = 0; TopicMapAdmin.filter('new'); });
        await page.click('.tm-ask'); await page.waitForFunction(() => /down/.test(document.querySelector('.tm-note').textContent));
        assert.equal(await page.evaluate(() => window.__writes.length), 0);
        // a stem with HTML is escaped
        await page.evaluate(() => { window.quizzesData[0].questions.push({ q: '<img src=x onerror=window.__x=1>', topicAi: { id: 'gi.gerd', conf: 50, model: 'm' } }); TopicMapAdmin.filter('unsure'); });
        assert.equal(await page.locator('.tm-stem img').count(), 0, 'stems are escaped');
        console.log('PASS: Topic Map — 12 groups, no key in the prompt, bad replies ignored, edited questions skipped, editor keeps labels, queue confirm / bulk / 🚫 / undo / ✨ / failure, only questions written');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
