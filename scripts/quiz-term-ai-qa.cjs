// V102.405 / V101.207: admin "✨ Mark terms" (local AI) + the intern runner using the saved list.
// Admin side: the REAL public/quiz-term-ai.js on the editor's markup (stubbed model + toast). Intern side: the REAL quiz-term-highlight.js.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = path.resolve(__dirname, '../public');
const admin = fs.readFileSync(path.join(dir, 'admin.html'), 'utf8'), index = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

// wiring
assert.ok(/<script src="quiz-term-ai\.js\?v=V102\.\d+" defer><\/script>/.test(admin), 'admin loads quiz-term-ai.js');
assert.ok(/class="qta-btn" onclick="QuizTermAI\.run\(this\)"[^>]*>✨ Mark terms<\/button><span class="qta-count"><\/span><input type="hidden" class="q-terms"/.test(admin), 'the button + hidden list sit in the stem Preview label');
assert.ok(/const qTerms = window\.QuizTermAI \? window\.QuizTermAI\.read\(item\) : \[\];[\s\S]{0,400}\.\.\.\(qTerms\.length \? \{ terms: qTerms \} : \{\}\)/.test(admin), 'save keeps the list; the key is left out when empty');
assert.ok(/terms: \(currentQuiz\.questions\[currentStep\] \|\| \{\}\)\.terms/.test(index), 'the runner passes the question terms');

const STEM = 'A 60-year-old driver with allergic rhinitis and BPH asks for chlorpheniramine. Baseline IPSS score is 16.';
const OPTS = ['Endorse chlorpheniramine for BPH.', 'Recommend a nasal corticosteroid.'];
const EXPL = 'First-generation antihistamines can cause urinary retention.';
const fixture = `
<div id="quiz-questions-container"><div class="quiz-q-item" id="item">
  <div class="q-text-split"><div class="q-text-pane"><div class="q-text-pane-label">👁️ Preview<button type="button" class="qta-btn" id="go" onclick="QuizTermAI.run(this)">✨ Mark terms</button><span class="qta-count"></span><input type="hidden" class="q-terms" value=""></div>
    <div class="q-text-preview" id="sp">${STEM}</div></div></div>
  <textarea class="q-text">${STEM}</textarea>
  <div class="q-opt-edit-wrap"><textarea class="q-opt">${OPTS[0]}</textarea><div class="q-opt-preview" id="o1" onclick="window.optClicked=(window.optClicked||0)+1">${OPTS[0]}</div></div>
  <div class="q-opt-edit-wrap"><textarea class="q-opt">${OPTS[1]}</textarea><div class="q-opt-preview" id="o2">${OPTS[1]}</div></div>
  <textarea class="q-explanation">${EXPL}</textarea>
</div></div>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://qta.test/**', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('https://qta.test/');
        await page.setContent(fixture);
        await page.evaluate(() => {
            window.toasts = []; window.showToast = m => toasts.push(m); window.calls = []; window.reply = null; window.fail = false;
            window.callUniversalAI = async (...a) => { calls.push(a); if (fail) throw new Error('connect refused'); return { text: JSON.stringify(reply) }; };
        });
        await page.addScriptTag({ content: fs.readFileSync(path.join(dir, 'quiz-term-ai.js'), 'utf8') });
        const texts = () => page.evaluate(() => [...document.querySelectorAll('textarea')].map(t => t.value));
        const before = await texts();
        const list = () => page.evaluate(() => { const v = document.querySelector('.q-terms').value; return v ? JSON.parse(v) : []; });
        const spans = sel => page.locator(sel + ' .qta-m').evaluateAll(els => els.map(e => [e.textContent, e.dataset.k]));

        // run → validated list, painted in the stem AND every option
        await page.evaluate(() => { reply = { terms: [
            { t: 'chlorpheniramine', k: 'dr' }, { t: 'allergic rhinitis', k: 'dx' }, { t: 'BPH', k: 'dx' }, { t: 'IPSS score', k: 'lb' },
            { t: 'nasal corticosteroid', k: 'dr' }, { t: 'warfarin', k: 'dr' } /* not in the text */, { t: 'urinary retention', k: 'bogus' } /* bad kind */, { t: 'BPH', k: 'dx' } /* duplicate */ ] }; });
        await page.click('#go');
        await page.waitForFunction(() => document.querySelector('.q-terms').value);
        assert.deepEqual((await list()).map(x => x.t + ':' + x.k), ['chlorpheniramine:dr', 'allergic rhinitis:dx', 'BPH:dx', 'IPSS score:lb', 'nasal corticosteroid:dr'], 'only real, valid, unique terms are kept');
        const call = await page.evaluate(() => calls[0].slice(0, 2).concat([calls[0][2]], [calls[0][5].feature]));
        assert.equal(call[0], 'ol/local', 'the LOCAL model'); assert.equal(call[2], true); assert.equal(call[3], 'quiz_terms');
        assert.ok(call[1].includes(STEM) && call[1].includes(OPTS[0]) && call[1].includes(OPTS[1]) && call[1].includes(EXPL), 'stem + options + explanation are sent, nothing else');
        assert.ok(/do not favour or skip any option/.test(call[1]), 'the prompt treats every option alike');
        assert.deepEqual(await spans('#sp'), [['allergic rhinitis', 'dx'], ['BPH', 'dx'], ['chlorpheniramine', 'dr'], ['IPSS score', 'lb']].sort((a, b) => STEM.indexOf(a[0]) - STEM.indexOf(b[0])));
        assert.deepEqual(await spans('#o1'), [['chlorpheniramine', 'dr'], ['BPH', 'dx']], 'the same terms in option 1');
        assert.deepEqual(await spans('#o2'), [['nasal corticosteroid', 'dr']], 'and in option 2');
        assert.equal(await page.locator('.qta-count').innerText(), '💊 2 · 🩺 2 · 🧪 1');
        assert.deepEqual(await texts(), before, 'the question text is never edited');

        // a click on a painted term opens its menu and does NOT edit the option underneath
        await page.locator('#o1 .qta-m').first().click();
        assert.equal(await page.evaluate(() => window.optClicked || 0), 0, 'the option onclick did not run');
        assert.equal(await page.locator('.qta-pop').count(), 1);
        await page.locator('.qta-pop button', { hasText: 'Lab' }).click();
        assert.equal((await list()).find(x => x.t === 'chlorpheniramine').k, 'lb', 'kind changed');
        assert.deepEqual(await spans('#o1'), [['chlorpheniramine', 'lb'], ['BPH', 'dx']]);
        await page.locator('#sp .qta-m', { hasText: 'BPH' }).click();
        await page.locator('.qta-pop button.rm').click();
        assert.equal((await list()).find(x => x.t === 'BPH').k, 'no', '"not a term" is remembered');
        assert.equal((await spans('#sp')).some(s => s[0] === 'BPH'), false, 'and no longer painted');

        // a re-run keeps the "not a term" decision
        await page.click('#go');
        await page.waitForFunction(() => !document.getElementById('go').disabled);
        assert.equal((await list()).find(x => x.t === 'BPH').k, 'no', 'a re-run does not bring it back');
        assert.equal((await list()).find(x => x.t === 'chlorpheniramine').k, 'dr', 'the AI list replaces the rest');

        // the preview is re-rendered by the editor on typing → painted again
        await page.evaluate(({ s }) => { document.getElementById('sp').innerHTML = '<p>' + s + '</p>'; }, { s: STEM });
        await page.waitForFunction(() => document.querySelectorAll('#sp .qta-m').length > 0, null, { timeout: 2000 });

        // local AI off → a message, the list and text untouched
        const keep = await list();
        await page.evaluate(() => { fail = true; toasts.length = 0; });
        await page.click('#go');
        await page.waitForFunction(() => toasts.length);
        assert.match(await page.evaluate(() => toasts[0]), /Local AI is not reachable/);
        assert.deepEqual(await list(), keep); assert.deepEqual(await texts(), before);
        assert.equal(await page.locator('#go').evaluate(el => el.classList.contains('bad')), true);

        // intern runner: the saved list wins, "no" silences the built-in list
        await page.setContent('<div id="r"><div class="md-render"><p>Take Foo-cillin 500 mg with metformin and warfarin. Check the Zed index.</p></div><div class="opt">Foo-cillin is fine</div></div>');
        await page.addScriptTag({ content: fs.readFileSync(path.join(dir, 'quiz-term-highlight.js'), 'utf8') });
        await page.evaluate(() => quizTermHighlight(document.getElementById('r'), { drugs: [], diseases: [], terms: [{ t: 'Foo-cillin', k: 'dr' }, { t: 'Zed index', k: 'lb' }, { t: 'metformin', k: 'no' }] }));
        const got = await page.evaluate(() => [...document.querySelectorAll('#r [class^=qzh-]')].map(e => e.className + ':' + e.textContent));
        assert.ok(got.includes('qzh-dr:Foo-cillin'), 'a term the dictionary does not know is drawn: ' + got);
        assert.ok(got.includes('qzh-lb:Zed index'));
        assert.ok(got.filter(x => x === 'qzh-dr:Foo-cillin').length === 2, 'in the options too');
        assert.ok(!got.some(x => /metformin/i.test(x)), '"not a term" silences the built-in list');
        assert.ok(got.includes('qzh-dr:warfarin'), 'the rest of the built-in list still works');
        await page.setContent('<div id="r"><div class="md-render"><p>Metformin 500 mg daily.</p></div></div>');
        await page.evaluate(() => quizTermHighlight(document.getElementById('r'), { drugs: [], diseases: [] }));
        assert.ok(await page.evaluate(() => !!document.querySelector('#r .qzh-dr')), 'no list → exactly as before');
        assert.deepEqual(errors, []);
        console.log('PASS: Mark terms — local model, validated list, painted in stem + options, menu (kind / not a term), re-run keeps decisions, local-off message, text untouched; runner uses the list.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
