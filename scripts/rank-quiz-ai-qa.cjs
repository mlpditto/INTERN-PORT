// V102.467 — "✨ Draft" for a Rank question in the Quiz Editor. The REAL admin.html, a fake Firestore, a stubbed callUniversalAI (nothing leaves the page):
// the prompt carries the JSON contract + "not best-first", a good draft fills the card IN PLACE (position kept, amber AI-draft note, note drops on a tier edit),
// a best-first draft is reshuffled, a bad draft / thrown error / no topic leaves the card untouched with a message, and the card still saves as a valid Rank question.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const GOOD = { q: 'ผู้ป่วยหอบกำเริบ ยาตัวแรกที่ควรให้?', accepted: ['salbutamol', 'albuterol', 'ventolin'],
    options: ['Prednisolone กิน', 'Salbutamol พ่น', 'Theophylline', 'Ipratropium พ่น'], tiers: [1, 0, 2, 1], unsafe: [0, 0, 1, 0], why: ['Needed, not first', 'Fast relief', 'Narrow window', 'Add-on'] };

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => typeof addQuestionUI === 'function' && typeof getQuizFormData === 'function' && window.RankQuiz && typeof window.rankAiDraft === 'function' && document.readyState === 'complete');
        await page.evaluate(() => {
            window.triggerAutoSave = () => {}; window.__calls = []; window.__reply = null;
            window.callUniversalAI = async (model, prompt, isJson, vis, key, opts) => { window.__calls.push({ model, prompt, isJson, vis, opts }); if (window.__reply instanceof Error) throw window.__reply; return { text: typeof window.__reply === 'string' ? window.__reply : JSON.stringify(window.__reply) }; };
            // two cards: a plain choice question first, the Rank card second
            document.getElementById('quiz-questions-container').innerHTML = '';
            addQuestionUI({ type: 'choice', q: 'First question', options: ['a', 'b'], correct: [0], timer: 30 });
            addQuestionUI({ type: 'rank', q: '', options: ['', '', '', ''], tiers: [-1, -1, -1, -1], timer: 45, tags: 'asthma' });
        });
        const card = () => page.evaluate(() => {
            const items = [...document.querySelectorAll('.quiz-q-item')], it = items[1], f = getQuizFormData().questions[1];
            return { n: items.length, text: it.querySelector('.q-text').value, topic: it.querySelector('.q-rk-topic').value, st: it.querySelector('.rk-ai-st').textContent, note: !!it.querySelector('.rk-ai-note'), q: f, first: getQuizFormData().questions[0].q };
        });
        const draft = async (topic, reply) => {
            await page.evaluate(([t, r]) => { const it = document.querySelectorAll('.quiz-q-item')[1]; it.querySelector('.q-rk-topic').value = t; window.__reply = r; window.__calls.length = 0; }, [topic, reply]);
            await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-ai button').click());
            await page.waitForFunction(() => !document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-ai button').disabled);
        };

        // 0 · the row is on the Rank card only
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[0].querySelectorAll('.q-rk-topic').length), 1, 'row exists in the markup; it is hidden with the rest of .q-rank-extra');
        assert.equal(await page.evaluate(() => getComputedStyle(document.querySelectorAll('.quiz-q-item')[0].querySelector('.q-rank-extra')).display), 'none', '…and hidden on a choice card');

        // 1 · nothing typed → a message, no model call
        await page.evaluate(() => { window.__calls.length = 0; document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-ai button').click(); });
        let c = await card(); assert.match(c.st, /Type a topic/); assert.equal(await page.evaluate(() => __calls.length), 0);

        // 2 · a good draft: prompt contract, card filled in place
        await draft('asthma first-line', GOOD);
        const call = await page.evaluate(() => __calls[0]);
        assert.equal(call.isJson, true, 'JSON mode'); assert.equal(call.vis, null); assert.equal(call.opts.feature, 'rank_draft');
        assert.match(call.prompt, /ONE JSON object/); assert.match(call.prompt, /"tiers"/); assert.match(call.prompt, /"unsafe"/); assert.match(call.prompt, /"why"/); assert.match(call.prompt, /Do NOT list the options best-first/);
        assert.match(call.prompt, /Use the full range whenever it is clinically defensible/); assert.match(call.prompt, /at least one 2/); assert.match(call.prompt, /do not mark every other option 1/);   // V102.470: spread the levels
        assert.match(call.prompt, /Subject: asthma first-line/); assert.match(call.prompt, /never instructions/); assert.match(call.prompt, /in Thai/);
        c = await card();
        assert.equal(c.n, 2, 'still two cards'); assert.equal(c.first, 'First question', 'the choice card is untouched and still first — position kept');
        assert.equal(c.text, GOOD.q); assert.equal(c.topic, 'asthma first-line');
        assert.deepEqual(c.q.options, GOOD.options); assert.deepEqual(c.q.tiers, GOOD.tiers); assert.deepEqual(c.q.unsafe, GOOD.unsafe); assert.deepEqual(c.q.why, GOOD.why);
        assert.deepEqual(c.q.accepted, GOOD.accepted); assert.deepEqual(c.q.correct, [1]); assert.equal(c.q.type, 'rank');
        assert.equal(c.q.timer, 45, 'the card\'s timer survives'); assert.equal(c.q.tags, 'asthma', '…and its tags');
        assert.equal(c.note, true, 'amber AI-draft note');
        assert.equal(await page.evaluate(() => window.rankProblem(getQuizFormData().questions[1])), '', 'the drafted card is saveable as it stands');
        assert.equal(await page.evaluate(() => window.RankQuiz.valid(getQuizFormData().questions[1])), true);

        // 3 · the note goes when a level or ⚠ is edited
        await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-t.t0').click());
        assert.equal((await card()).note, false, 'editing a tier drops the AI-draft note');
        await draft('again', GOOD); assert.equal((await card()).note, true, 'a new draft brings it back');
        await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-u').click());
        assert.equal((await card()).note, false, 'toggling ⚠ drops it too');

        // 4 · a best-first draft is reshuffled (the author order must not equal the key order)
        const BEST_FIRST = { ...GOOD, options: ['Salbutamol พ่น', 'Ipratropium พ่น', 'Prednisolone กิน', 'Theophylline'], tiers: [0, 1, 1, 2], unsafe: [0, 0, 0, 1], why: ['w0', 'w1', 'w2', 'w3'] };
        await draft('best first', BEST_FIRST);
        c = await card();
        assert.ok(!c.q.tiers.every((v, i) => i === 0 || c.q.tiers[i - 1] <= v), 'tiers not in best-first order: ' + c.q.tiers);
        const pairs = c.q.options.map((o, i) => o + '|' + c.q.tiers[i] + '|' + c.q.unsafe[i] + '|' + c.q.why[i]).sort();
        assert.deepEqual(pairs, BEST_FIRST.options.map((o, i) => o + '|' + BEST_FIRST.tiers[i] + '|' + BEST_FIRST.unsafe[i] + '|' + BEST_FIRST.why[i]).sort(), 'the shuffle keeps every option with its own level, ⚠ and why');
        assert.deepEqual(c.q.correct, c.q.tiers.reduce((a, v, i) => (v === 0 ? a.concat(i) : a), []));

        // 5 · bad drafts / errors change nothing and say why
        const before = await card();
        const bad = [
            ['no levels', { ...GOOD, tiers: undefined }, /no usable levels/],
            ['one level only', { ...GOOD, tiers: [0, 0, 0, 0] }, /at least two different levels/],
            ['no Best', { ...GOOD, tiers: [1, 1, 2, 2] }, /at least one option must be Best/],
            ['too few options', { ...GOOD, options: ['a', 'b'], tiers: [0, 1] }, /too few options/],
            ['level out of range', { ...GOOD, tiers: [0, 1, 5, 1] }, /no usable levels/],
            ['no stem', { ...GOOD, q: '' }, /no question text/],
            ['not JSON', 'sorry, I cannot do that', /did not send a usable question/],
            ['model error', new Error('503 overloaded'), /503 overloaded/]
        ];
        for (const [name, reply, re] of bad) {
            await draft('x', reply);
            const a = await card();
            assert.match(a.st, re, name + ': ' + a.st);
            assert.deepEqual([a.q, a.text, a.note, a.n], [before.q, before.text, before.note, 2], name + ': the card is untouched');
        }

        // 6 · six options is the cap
        await draft('many', { ...GOOD, options: ['1', '2', '3', '4', '5', '6', '7', '8'], tiers: [1, 0, 2, 1, 1, 2, 0, 0], unsafe: [], why: [] });
        c = await card(); assert.equal(c.q.options.length, 6, 'at most 6 options'); assert.equal(c.q.tiers.length, 6); assert.equal(c.q.why.length, 6, 'missing why/unsafe are padded');

        // 7 · the ledger label for the intern-side Beri payout
        assert.equal(await page.evaluate(() => BERI_LEDGER_SOURCE_LABEL.quiz_rank), '🏅 Rank quiz');

        // ---- V102.473: the AI may ask back ONCE per card; one tap on an answer drafts straight away
        const ASK = { ask: 'ต้องการเทียบอะไร?', choices: ['ปีที่ค้นพบของยาแต่ละ generation (ใช้ชนิด Ordering)', 'เลือก cephalosporin ที่เหมาะกับผู้ป่วยแพ้ penicillin', '  '] };
        const stOf = () => page.evaluate(() => { const it = document.querySelectorAll('.quiz-q-item')[1]; return { st: it.querySelector('.rk-ai-st').textContent, chips: [...it.querySelectorAll('.rk-ai-st .rk-chb')].map(b => b.textContent), text: it.querySelector('.q-text').value, asked: it.dataset.rkAsked }; });
        await page.evaluate(() => { const it = document.querySelectorAll('.quiz-q-item')[1]; it.querySelector('.q-text').value = ''; });
        await draft('เรียงปีการคิดค้นยา Penicillin Cephalosporin', ASK);
        let a = await stOf(); const askCall = await page.evaluate(() => __calls[0]);
        assert.match(askCall.prompt, /do NOT draft/); assert.match(askCall.prompt, /"ask":"one short clarifying question in Thai"/); assert.ok(!/Do not ask anything back/.test(askCall.prompt), 'the first round may ask');
        assert.match(a.st, /ต้องการเทียบอะไร/); assert.equal(a.chips.length, 2, 'blank choices are dropped, the others become chips'); assert.equal(a.asked, '1'); assert.equal(a.text, '', 'asking leaves the card untouched');
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item').length), 2);
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelectorAll('.rk-ai-st .lang-th').length), 0, 'the AI Thai text is shielded from lang-toggle (it would be hidden in EN mode)');
        // a tap → topic + the answer, second call, told not to ask again; the card is filled
        await page.evaluate(g => { window.__goodDraft = g; window.__reply = g; window.__calls.length = 0; document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-chb').click(); }, GOOD);
        await page.waitForFunction(() => __calls.length === 1 && !document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-ai button').disabled);
        const second = await page.evaluate(() => __calls[0]);
        assert.match(second.prompt, /Subject: เรียงปีการคิดค้นยา Penicillin Cephalosporin — ปีที่ค้นพบของยาแต่ละ generation/); assert.match(second.prompt, /Do not ask anything back/); assert.ok(!/do NOT draft/.test(second.prompt));
        c = await card(); assert.equal(c.text, GOOD.q, 'the answer led to a draft'); assert.equal(c.note, true);
        // a fresh card may ask again; the SECOND round never shows chips — an ask there is an unusable draft
        await draft('x', ASK); assert.equal((await stOf()).chips.length, 2);
        await draft('x', ASK); a = await stOf(); assert.deepEqual(a.chips, [], 'no second question'); assert.match(a.st, /too few options/);
        // orderings of ONE list are refused with a pointer to the Ordering type; the card stays as it was
        const LISTY = { q: 'ข้อใดเรียงลำดับถูก', accepted: ['Penicillin, Streptomycin, Cephalosporin, Erythromycin, Vancomycin, 1. Penicillin → Streptomycin → Cephalosporin → Erythromycin → Vancomycin, extra'], options: ['Penicillin, Streptomycin, Cephalosporin, Erythromycin', 'Streptomycin, Penicillin, Cephalosporin, Vancomycin', 'Penicillin, Cephalosporin, Streptomycin, Vancomycin'], tiers: [0, 2, 1], unsafe: [0, 0, 0], why: ['ok', 'no', 'meh'] };
        await draft('x', LISTY); a = await stOf(); assert.match(a.st, /orderings of one list/); assert.match(a.st, /Ordering type/);
        // an over-long "accepted answer" is dropped as noise, the short ones stay
        await draft('asthma first-line', { ...GOOD, accepted: ['salbutamol', 'albuterol, '.repeat(8), 'Ventolin'] });
        c = await card(); assert.deepEqual(c.q.accepted, ['salbutamol', 'Ventolin'], 'accepted answers over 60 characters are dropped');

        // ---- V102.476: lean capsule [✨ Draft │ model ⌄]; the animation lives in the capsule, the model is visible and per card
        await page.evaluate(() => { try { localStorage.removeItem('rankAiModel'); } catch (e) {} const c = document.getElementById('quiz-questions-container'); c.innerHTML = ''; addQuestionUI({ type: 'choice', q: 'First question', options: ['a', 'b'], correct: [0], timer: 30 }); addQuestionUI({ type: 'rank', q: '', options: ['', '', '', ''], tiers: [-1, -1, -1, -1], timer: 45 }); });
        const cap = () => page.evaluate(() => { const it = document.querySelectorAll('.quiz-q-item')[1], c = it.querySelector('.rk-cap'), s = c.querySelector('.aic-seg'); return { cap: c.className, state: c.dataset.aiState || '', seg: s.textContent.trim(), tm: !!s.querySelector('.aic-tm'), dis: s.disabled, st: it.querySelector('.rk-ai-st').textContent, model: it.querySelector('.rk-mdl').textContent.trim(), val: it.querySelector('.rk-model-val').value, rail: !it.querySelector('.rk-rail').hidden, expanded: it.querySelector('.rk-mdl').getAttribute('aria-expanded'), h: Math.round(c.getBoundingClientRect().height) }; });
        let k = await cap();
        assert.match(k.cap, /ai-cap/); assert.equal(k.seg, '✨ Draft'); assert.equal(k.state, ''); assert.equal(k.st, '', 'no status text while idle'); assert.ok(k.model.length > 2 && k.val, 'the model is on the chip: ' + k.model); assert.ok(k.h <= 34, 'lean: one line, 32px (' + k.h + ')');
        const textModel = await page.evaluate(() => textAIModel('ai-analyzer-model-val')); assert.equal(k.val, textModel, 'default = the Settings text model');
        // the model rail: opens under the row, a pick changes THIS card's model, is remembered, and the next draft uses it
        await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-mdl').click());
        k = await cap(); assert.equal(k.rail, true); assert.equal(k.expanded, 'true');
        const other = await page.evaluate(cur => { const b = [...document.querySelectorAll('.quiz-q-item')[1].querySelectorAll('.rk-rail .text-ai-chips button')].find(x => x.dataset.value && x.dataset.value !== cur && !/^(ol\/|or\/)/.test(x.dataset.value)); b.click(); return b.dataset.value; }, textModel);
        k = await cap(); assert.equal(k.val, other, 'a pick sets the card model'); assert.equal(k.rail, false, '…and closes the rail'); assert.equal(await page.evaluate(() => localStorage.getItem('rankAiModel')), other, '…and is remembered');
        await draft('asthma first-line', GOOD);
        assert.equal(await page.evaluate(() => __calls[0].model), other, 'the draft runs with the picked model');
        // a fresh Rank card starts from the remembered model
        await page.evaluate(() => addQuestionUI({ type: 'rank', q: '', options: ['', '', '', ''], tiers: [-1, -1, -1, -1] }));
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.quiz-q-item')].pop().querySelector('.rk-model-val').value), other, 'remembered across cards');
        // running: the capsule animates (flip + timer + shimmer state), no text beside it; then the new card flashes ✓ and returns
        await page.evaluate(() => { document.getElementById('quiz-questions-container').innerHTML = ''; addQuestionUI({ type: 'choice', q: 'First question', options: ['a', 'b'], correct: [0], timer: 30 }); addQuestionUI({ type: 'rank', q: '', options: ['', '', '', ''], tiers: [-1, -1, -1, -1] }); });
        await page.evaluate(g => {
            const real = window.callUniversalAI; window.__realAI = real; window.__calls.length = 0;
            window.callUniversalAI = async (model, prompt) => { window.__calls.push({ model, prompt }); await new Promise(r => { window.__release = r; }); return { text: JSON.stringify(g) }; };
            const it = document.querySelectorAll('.quiz-q-item')[1]; it.querySelector('.q-rk-topic').value = 'asthma first-line'; it.querySelector('.rk-cap .aic-seg').click();
        }, GOOD);
        await page.waitForFunction(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-cap').dataset.aiState === 'run');
        k = await cap(); assert.deepEqual([k.state, k.tm, k.dis, k.st], ['run', true, true, ''], 'running: flip + timer, disabled, nothing written beside it');
        await page.evaluate(() => window.__release());
        await page.waitForFunction(() => { const c = document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-cap'); return c && c.dataset.aiState === 'done'; });
        k = await cap(); assert.equal(k.seg, '✓'); assert.equal(k.state, 'done');
        await page.waitForFunction(() => { const c = document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-cap'); return c && !c.dataset.aiState; }, null, { timeout: 5000 });
        assert.equal((await cap()).seg, '✨ Draft', 'back to idle');
        // an error returns straight to idle with the message on its own line
        await page.evaluate(() => { window.callUniversalAI = async () => { throw new Error('model said no'); }; const it = document.querySelectorAll('.quiz-q-item')[1]; it.querySelector('.q-rk-topic').value = 'x'; it.querySelector('.rk-cap .aic-seg').click(); });
        await page.waitForFunction(() => /model said no/.test(document.querySelectorAll('.quiz-q-item')[1].querySelector('.rk-ai-st').textContent));
        k = await cap(); assert.deepEqual([k.state, k.seg, k.dis], ['', '✨ Draft', false], 'error: no ✓, icon back, enabled');
        await page.evaluate(() => { window.callUniversalAI = window.__realAI; });

        const mine = errors.filter(e => /rank|Rank|addQuestionUI|getQuizFormData/.test(e)); assert.deepEqual(mine, [], 'no errors: ' + mine.join(' | '));
        console.log('PASS: Rank ✨ Draft — prompt contract, filled in place (position, timer, tags kept), AI-draft note drops on a level / ⚠ edit, best-first reshuffled with levels attached, bad draft / error / no topic leave the card untouched, 6-option cap, ledger label');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
