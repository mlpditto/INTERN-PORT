const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const html = fs.readFileSync('public/admin.html', 'utf8');
        assert(html.includes('onclick="openQuizCurate()"'));
        assert(html.includes('src="quiz-curate.js?v=V99.94"'));
        await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="gpt-5.6-luna">');
        await page.addStyleTag({ path: 'public/quiz-curate.css' });
        await page.addScriptTag({ path: 'public/ai-model-ui.js' });
        await page.evaluate(() => {
            window.fixture = {
                title: 'Clinical assessment', targetGroup: 'Interns', totalPoints: 1.4,
                isPoll: false, quizType: 'mcq', caseContent: 'Shared clinical context',
                materials: [{ name: 'Reading', url: 'https://example.com/reading' }],
                blueprint: { learningObjective: 'Apply clinical reasoning' },
                startTime: '2026-09-01T09:00', deadline: '2026-09-30T09:00',
                questions: Array.from({ length: 14 }, (_, i) => ({
                    q: 'Clinical question ' + (i + 1), content: '', type: i === 2 ? 'ordering' : 'choice',
                    options: ['Option A', 'Option B'], correct: i === 2 ? 0 : [1], timer: 60, tags: 'Objective ' + i, explanation: 'Original explanation ' + i
                }))
            };
            window.original = structuredClone(fixture);
            for (let i = 0; i < 14; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; document.body.append(el); }
            window.getQuizFormData = () => structuredClone(fixture);
            window.shouldMarkQuestionMissingAnswer = item => Number(item.dataset.id) === window.missingKey;
            window.showToast = message => window.toast = message;
            window.safeJsonParse = JSON.parse;
            window.authOK = true;
            window.ensureAuthForQuizWrite = async () => { if (window.authEdit) fixture.title += ' changed'; return authOK; };
            window.calls = []; window.writes = []; window.docCount = 0; window.writeFail = false;
            window.callUniversalAI = (...args) => { calls.push(args); return new Promise((resolve, reject) => { window.aiResolve = resolve; window.aiReject = reject; }); };
            window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } };
            window.db = { collection: name => { if (name !== 'quizzes') throw Error('Unexpected collection'); return { doc: () => {
                const id = 'copy-' + ++docCount;
                return { set: async data => { writes.push({ id, data: structuredClone(data) }); if (writeFail) throw Error('Simulated uncertain write'); } };
            } }; } };
        });
        await page.addScriptTag({ path: 'public/quiz-curate.js' });
        const feedback = () => page.locator('#curate-feedback').innerText();
        const saveDisabled = () => page.locator('#curate-save').isDisabled();
        const open = () => page.evaluate(() => openQuizCurate());
        const close = async () => { await page.locator('.curate-close').click(); await page.waitForFunction(() => !document.querySelector('#quiz-curate-dialog').open); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
        const result = (keep = Array.from({ length: 10 }, (_, i) => i + 1)) => ({ questions: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, keep: keep.includes(i + 1), topic: i === 13 ? 'Unique topic' : 'Core', reason: 'Reason for Q' + (i + 1), reasonTh: 'เหตุผลสำหรับข้อ ' + (i + 1) })) });
        const resolve = async data => { await page.evaluate(data => aiResolve({ text: JSON.stringify(data) }), data); await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false'); };
        const suggest = async data => { await page.locator('#curate-suggest').click(); await resolve(data); };
        const row = id => page.locator('.curate-question').filter({ has: page.locator('.curate-number', { hasText: new RegExp('^Q' + id + '$') }) });

        await open();
        assert.equal(await page.locator('#curate-target').inputValue(), '10');
        assert.equal(await page.locator('.curate-question').count(), 14);
        assert(await saveDisabled());
        for (const value of ['0', '15', '2.5', '']) {
            await page.locator('#curate-target').fill(value); await page.locator('#curate-suggest').click();
            assert.equal(await page.evaluate(() => calls.length), 0); assert(await saveDisabled());
        }
        await page.locator('#curate-target').fill('10');
        await row(14).locator('.curate-pin').click();
        assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Pinned');
        assert(await row(14).locator('.curate-move').isDisabled());
        await page.locator('.curate-instructions summary').click();
        await page.locator('#curate-instructions').fill('Keep key objectives.');
        await page.locator('#curate-suggest').click();
        assert(await saveDisabled());
        assert(await page.locator('#curate-target').isDisabled());
        await page.evaluate(() => document.getElementById('curate-suggest').onclick());
        assert.equal(await page.evaluate(() => calls.length), 1, 'duplicate generation blocked');
        const request = await page.evaluate(() => calls[0]);
        assert.equal(request[0], 'gpt-5.6-luna');
        assert(request[1].includes('Mandatory keep IDs: [14]'));
        assert(request[1].includes('Keep key objectives.'));
        assert.equal(request[5].feature, 'quiz_curate');
        await resolve(result()); // Missing pinned Q14.
        assert.match(await feedback(), /did not respect/); assert(await saveDisabled());
        for (const mutate of [
            d => { d.questions[1].id = 1; },
            d => { d.questions[1].id = 99; },
            d => { d.questions.pop(); },
            d => { d.questions[1].reason = ''; },
            d => { delete d.questions[1].reasonTh; },
            d => { d.questions[1].reasonTh = ' '; },
            d => { d.questions[1].keep = 'true'; },
            d => { d.questions[1].keep = false; }
        ]) {
            const bad = result([1,2,3,4,5,6,7,8,9,14]); mutate(bad); await suggest(bad);
            assert.match(await feedback(), /Could not suggest/); assert(await saveDisabled());
        }
        const good = result([1,2,3,4,5,6,7,8,9,14]);
        good.questions[9].reason = '<img src=x onerror="window.injected=true">';
        good.questions[0].q = 'AI attempted rewrite';
        await suggest(good);
        assert.equal(await saveDisabled(), false);
        assert.equal(await page.locator('.curate-question').count(), 4);
        assert.match(await page.locator('#curate-coverage').innerText(), /2\/2 topics/);
        assert.equal(await page.locator('#curate-rows img').count(), 0);
        assert.match(await row(10).locator('[lang=th]').innerText(), /เหตุผลสำหรับข้อ 10/);
        assert.match(await row(10).locator('[lang=en]').innerText(), /<img/);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        await row(10).locator('.curate-move').click(); assert(await saveDisabled());
        await page.locator('[data-view="keep"]').click();
        assert.match(await row(14).locator('[lang=th]').innerText(), /เหตุผลสำหรับข้อ 14/);
        assert.match(await row(14).locator('[lang=en]').innerText(), /Reason for Q14/);
        await row(1).locator('.curate-move').click(); assert.equal(await saveDisabled(), false);
        for (const width of [320, 390, 736, 1024]) {
            await page.setViewportSize({ width, height: 850 });
            assert(await page.locator('#quiz-curate-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), 'horizontal overflow at ' + width);
            assert(await page.locator('#quiz-curate-dialog button').evaluateAll(bs => bs.every(b => {
                const r = b.getBoundingClientRect(), d = b.closest('dialog').getBoundingClientRect();
                return r.left >= d.left && r.right <= d.right + 1;
            })), 'button outside dialog at ' + width);
        }
        await page.setViewportSize({ width: 1000, height: 900 });
        await page.locator('[data-view="remove"]').click();
        await page.screenshot({ path: 'quiz-curate-qa.png' });
        await page.locator('#curate-save').click();
        await page.waitForFunction(() => document.getElementById('curate-save').textContent === 'Saved');
        await page.evaluate(() => document.getElementById('curate-save').onclick());
        const written = await page.evaluate(() => writes);
        assert.equal(written.length, 1);
        const copy = written[0].data;
        assert.equal(copy.isActive, false); assert.equal(copy.isTemplate, true);
        assert.equal(copy.startTime, null); assert.equal(copy.deadline, null);
        assert.equal(copy.targetGroup, 'Interns'); assert.equal(copy.totalPoints, 1.4);
        assert.equal(copy.curation.sourceQuizId, 'source-quiz');
        assert.deepEqual(copy.curation.originalQuestionNumbers, [2,3,4,5,6,7,8,9,10,14]);
        const original = await page.evaluate(() => original);
        assert.deepEqual(copy.questions, copy.curation.originalQuestionNumbers.map(id => original.questions[id - 1]));
        assert.deepEqual(copy.materials, original.materials); assert.deepEqual(copy.blueprint, original.blueprint);
        assert.equal(copy.caseContent, original.caseContent);
        assert.deepEqual(await page.evaluate(() => fixture), original, 'editor is unchanged');
        await close();

        // API error, missing key, auth failure, uncertain writes, and idempotent retry.
        await open(); await page.locator('#curate-suggest').click();
        await page.evaluate(() => aiReject(Error('Unavailable')));
        await page.waitForFunction(() => document.getElementById('curate-feedback').textContent.includes('Unavailable'));
        assert(await saveDisabled()); await close();
        await page.evaluate(() => window.missingKey = 1); await open(); await suggest(result());
        await page.locator('#curate-save').click(); assert.match(await feedback(), /answer key for Q1/); await close();
        await page.evaluate(() => { window.missingKey = null; authOK = false; });
        await open(); await suggest(result()); await page.locator('#curate-save').click();
        assert.match(await feedback(), /Sign in/); assert.equal(await page.evaluate(() => writes.length), 1);
        await page.evaluate(() => { authOK = true; writeFail = true; });
        await page.locator('#curate-save').click(); assert.match(await feedback(), /uncertain write/);
        await page.evaluate(() => writeFail = false); await page.locator('#curate-save').click();
        await page.waitForFunction(() => document.getElementById('curate-save').textContent === 'Saved');
        assert.deepEqual(await page.evaluate(() => writes.slice(1).map(w => w.id)), ['copy-2', 'copy-2']); await close();

        // Close during AI work, then reopen: old result must not affect the new session.
        await open(); await page.locator('#curate-suggest').click();
        await page.evaluate(() => window.oldResolve = aiResolve); await close(); await open();
        await page.evaluate(data => oldResolve({ text: JSON.stringify(data) }), result());
        assert(await saveDisabled()); assert.equal(await page.locator('.curate-question').count(), 14);
        await page.locator('#curate-suggest').click(); await page.evaluate(() => fixture.title += ' edited');
        await resolve(result()); assert.match(await feedback(), /editor changed/); assert(await saveDisabled()); await close();
        await page.evaluate(() => fixture = structuredClone(original)); await open(); await suggest(result());
        await page.evaluate(() => window.authEdit = true); await page.locator('#curate-save').click();
        assert.match(await feedback(), /editor changed/); assert.equal(await page.evaluate(() => writes.length), 3);
        await page.evaluate(() => document.addEventListener('keydown', e => { if (e.key === 'Escape') window.editorClosed = true; }));
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#quiz-curate-dialog').isVisible(), false);
        assert.equal(await page.evaluate(() => window.editorClosed), undefined, 'Escape preserves the editor');
        assert.deepEqual(errors, []);
        console.log('PASS: Curate responsive 320–1024px, model routing, ID/count/pin validation, manual review, safe text rendering, inactive copy with original answers/settings, auth/stale guards, duplicate-write retry and async session isolation');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
