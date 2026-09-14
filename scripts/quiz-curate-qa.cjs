const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('https://curate.test/', r => r.fulfill({body:'<html></html>', contentType:'text/html'}));
        await page.goto('https://curate.test/');
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const html = fs.readFileSync('public/admin.html', 'utf8');
        assert(html.includes('onclick="openQuizCurate()"'));
        assert(html.includes('src="quiz-curate.js?v=V100.09"'));
        await page.setContent([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="source-quiz"><input id="ai-analyzer-model-val" value="gpt-5.6-luna">');
        await page.addStyleTag({ path: 'public/quiz-curate.css' });
        await page.addStyleTag({ path: 'public/text-ai-chips.css' });
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
            fixture.questions[9].q += ' ผู้เรียนต้องวิเคราะห์สถานการณ์และเลือกคำตอบที่เหมาะสม โดยพิจารณาข้อมูลทั้งหมดในโจทย์และเปรียบเทียบเหตุผลของแต่ละตัวเลือก ก่อนสรุปคำตอบจากหลักฐานที่กำหนดไว้ในกรณีศึกษา';
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
            window.db = { collection: name => { if (name !== 'quizzes') throw Error('Unexpected collection'); return { doc: requestedId => {
                const id = requestedId || 'copy-' + ++docCount;
                return { id, get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async data => { writes.push({ id, data: structuredClone(data) }); if (writeFail) throw Error('Simulated uncertain write'); } };
            } }; } };
        });
        await page.evaluate(() => { window.curateHistory = { key: async v => JSON.stringify(v), load: async () => [], save: async () => {} }; });
        await page.addScriptTag({ path: 'public/quiz-curate.js' });
        const feedback = () => page.locator('#curate-feedback').innerText();
        const saveDisabled = () => page.locator('#curate-save').isDisabled();
        const open = async () => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.evaluate(() => openQuizCurate()); };
        const close = async () => { await page.locator('.curate-close').click(); await page.waitForFunction(() => !document.querySelector('#quiz-curate-dialog').open); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
        const result = (keep = Array.from({ length: 10 }, (_, i) => i + 1)) => ({ questions: Array.from({ length: 14 }, (_, i) => ({ id: i + 1, keep: keep.includes(i + 1), topic: i === 13 ? 'Unique topic' : 'Core', reason: 'Reason for Q' + (i + 1), reasonTh: 'เหตุผลสำหรับข้อ ' + (i + 1), detail: 'Detailed source evidence', detailTh: 'รายละเอียดจากต้นฉบับ', impact: 'Coverage remains', impactTh: 'ยังครอบคลุมหัวข้อ', reasonType: 'quality', related: [] })) });
        const resolve = async data => { await page.evaluate(data => aiResolve({ text: JSON.stringify(data) }), data); await page.waitForFunction(() => document.querySelector('#quiz-curate-dialog').getAttribute('aria-busy') === 'false'); };
        const suggest = async data => { const before = await page.evaluate(() => calls.length); await page.locator('#curate-suggest').click(); await page.waitForFunction(n => calls.length > n, before); await resolve(data); };
        const row = id => page.locator('.curate-question').filter({ has: page.locator('.curate-number', { hasText: new RegExp('^Q' + id + '$') }) });

        await open();
        assert.equal(await page.locator('#curate-target').inputValue(), '10');
        assert.equal(await page.locator('.curate-question').count(), 14);
        assert(await saveDisabled());
        assert.equal(await page.locator('#curate-models button').count(), 9);
        await page.locator('[data-model="claude-haiku-4-5"]').click();
        assert.match(await page.locator('#curate-model').innerText(), /Claude Haiku/);
        for (const value of ['0', '15', '2.5', '']) {
            await page.locator('#curate-target').fill(value); await page.locator('#curate-suggest').click();
            assert.equal(await page.evaluate(() => calls.length), 0); assert(await saveDisabled());
        }
        await page.locator('#curate-target').fill('10');
        await row(14).locator('.curate-pin').click();
        assert.equal(await page.evaluate(() => document.activeElement.textContent), '📌 Must keep');
        assert(await row(14).locator('.curate-move').isDisabled());
        await page.locator('.curate-instructions summary').click();
        await page.locator('#curate-instructions').fill('Keep key objectives.');
        await page.locator('#curate-suggest').click();
        assert(await saveDisabled());
        assert(await page.locator('#curate-target').isDisabled());
        await page.evaluate(() => document.getElementById('curate-suggest').onclick());
        assert.equal(await page.evaluate(() => calls.length), 1, 'duplicate generation blocked');
        const request = await page.evaluate(() => calls[0]);
        assert.equal(request[0], 'claude-haiku-4-5');
        assert.match(await page.locator('#curate-suggest').innerText(), /Processing · 00:00/);
        assert.equal(await page.locator('#curate-progress').count(), 0);
        await page.waitForTimeout(1100);
        assert.match(await page.locator('#curate-suggest').innerText(), /Processing · 00:01/);
        assert(await page.locator('#curate-models button').first().isDisabled());
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
        good.questions[9].related = [{ id: 14, shared: 'Shared objective', sharedTh: 'วัตถุประสงค์เดียวกัน', difference: 'Different wording', differenceTh: 'ถ้อยคำต่างกัน', preference: 'Prefer Q14 for clarity', preferenceTh: 'เก็บ Q14 เพราะชัดเจนกว่า', evidence: [{ id: 10, quote: 'Clinical question 10' }, { id: 14, quote: 'Option B' }] }];
        for (const mutate of [
            d => { d.questions[9].related[0].id = 10; },
            d => { d.questions[9].related[0].id = 99; },
            d => { d.questions[9].related[0].evidence[0].quote = 'Invented source'; },
            d => { d.questions[9].related[0].evidence.pop(); },
            d => { d.questions[9].related[0].preferenceTh = ''; },
            d => { delete d.questions[9].impactTh; }
        ]) { const bad = structuredClone(good); mutate(bad); await suggest(bad); assert.match(await feedback(), /Could not suggest/); assert(await saveDisabled()); }

        await suggest(good);
        const completedLabel = await page.locator('#curate-suggest').innerText();
        assert.equal(completedLabel, 'Run again');
        assert.match(await page.locator('#curate-history-status').innerText(), /Done · \d{2}:\d{2}/);
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('#curate-suggest').innerText(), completedLabel, 'completed elapsed time stops');
        assert.equal(await saveDisabled(), false);
        assert.equal(await page.locator('.curate-question').count(), 4);
        assert.match(await page.locator('#curate-coverage').innerText(), /2\/2 topics/);
        assert.equal(await page.locator('#curate-rows img').count(), 0);
        assert.match(await row(10).locator('[lang=th]').first().innerText(), /เหตุผลสำหรับข้อ 10/);
        assert.match(await row(10).locator('[lang=en]').first().innerText(), /<img/);
        assert.equal(await page.evaluate(() => window.injected), undefined);
        assert.equal(await row(10).locator('.curate-stem').count(), 1);
        assert.equal(await row(11).locator('.curate-badge').innerText(), 'AI suggests removal');
        await page.waitForFunction(() => document.querySelector('[data-question-id="10"] .curate-expand').hidden);
        assert.equal(await row(11).locator('.curate-expand').isVisible(), false, 'short question does not need More');
        const choicesToggle = row(10).getByRole('button', { name: /^Choices · 2/ });
        const explanationToggle = row(10).getByRole('button', { name: /^Explanation/ });
        const choicesBox = await choicesToggle.boundingBox(), explanationBox = await explanationToggle.boundingBox();
        assert.equal(choicesBox.y, explanationBox.y, 'source controls share one row');
        await choicesToggle.focus(); await page.keyboard.press('Enter');
        assert.equal(await choicesToggle.getAttribute('aria-expanded'), 'true');
        const choicesPanel = page.locator('#' + await choicesToggle.getAttribute('aria-controls'));
        assert.equal(await choicesPanel.locator('.curate-choice').count(), 2);
        assert(await choicesPanel.isVisible());
        await explanationToggle.click();
        assert.match(await page.locator('#' + await explanationToggle.getAttribute('aria-controls')).innerText(), /Original explanation 9/);
        await row(10).locator('.curate-reason-details summary').focus(); await page.keyboard.press('Enter');
        assert.equal(await row(10).locator('.curate-reason-details').getAttribute('open'), '');
        await page.setViewportSize({ width: 390, height: 850 });
        await row(10).locator('.curate-expand').click();
        assert.equal(await row(10).locator('.curate-expand').getAttribute('aria-expanded'), 'true');
        assert.equal(await row(10).locator('.curate-stem').innerText(), await page.evaluate(() => fixture.questions[9].q));
        assert.equal(await row(11).locator('.curate-compare').count(), 0);
        await row(10).locator('.curate-compare').click();
        assert.equal(await page.locator('.curate-compare-card').count(), 2);
        assert.equal(await page.locator('.curate-compare-card mark').count(), 2);
        assert.equal(await page.locator('.curate-compare-card .curate-key').count(), 2);
        assert(await page.getByRole('button', { name: 'Keep Q10', exact: true }).isDisabled(), 'cannot remove pinned Q14');
        for (const width of [320, 390, 736, 1024]) {
            await page.setViewportSize({ width, height: 900 });
            assert(await page.locator('#quiz-curate-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), 'comparison overflow at ' + width);
            const cols = await page.locator('.curate-compare-card').evaluateAll(cs => cs.map(c => {const r=c.getBoundingClientRect();return {x:r.x,y:r.y};}));
            assert(width <= 700 ? cols[0].y < cols[1].y : cols[0].x < cols[1].x);
        }
        await page.getByRole('button', { name: 'Keep both', exact: true }).click(); assert(await saveDisabled());
        assert.match(await feedback(), /11 selected/);
        await page.getByRole('button', { name: 'Keep Q14', exact: true }).click(); assert.equal(await saveDisabled(), false);
        await page.screenshot({path:'quiz-curate-compare-qa.png'});
        await page.keyboard.press('Escape');
        assert(await page.locator('#quiz-curate-dialog').isVisible());
        assert.equal(await page.locator('#curate-comparison').isVisible(), false);
        await row(10).locator('.curate-move').click(); assert(await saveDisabled());
        await page.locator('[data-view="keep"]').click();
        assert.match(await row(14).locator('[lang=th]').first().innerText(), /เหตุผลสำหรับข้อ 14/);
        assert.match(await row(14).locator('[lang=en]').first().innerText(), /Reason for Q14/);
        await row(1).locator('.curate-move').click(); assert.equal(await saveDisabled(), false);
        for (const width of [320, 390, 736, 1024]) {
            await page.setViewportSize({ width, height: 850 });
            await page.waitForTimeout(250);
            assert(await page.locator('#quiz-curate-dialog').evaluate(d => d.scrollWidth <= d.clientWidth + 1), 'horizontal overflow at ' + width);
            assert(await page.locator('#quiz-curate-dialog button:not([data-model]):visible').evaluateAll(bs => bs.every(b => {
                const r = b.getBoundingClientRect(), d = b.closest('dialog').getBoundingClientRect();
                return r.left >= d.left && r.right <= d.right + 1;
            })), 'button outside dialog at ' + width);
        }
        await page.setViewportSize({ width: 1000, height: 900 });
        await page.locator('[data-view="remove"]').click();
        assert.match(await page.locator('#curate-apply').innerText(), /Remove 4 from original/);
        assert(await page.locator('#curate-apply').evaluate(b => {
            const r = b.getBoundingClientRect(), d = b.closest('dialog').getBoundingClientRect();
            return r.top >= d.top && r.bottom <= d.bottom;
        }), 'original action remains visible while reviewing');
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

        await open(); await suggest(result());
        await page.locator('[data-model="gpt-5.6-terra"]').click();
        assert(await saveDisabled(), 'changing model requires a fresh proposal');
        assert.equal(await page.locator('#curate-suggest').innerText(), '✦ Suggest');
        await suggest(result());
        assert.equal(await page.evaluate(() => calls.at(-1)[0]), 'gpt-5.6-terra');
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
        // Apply uses an atomic backup/update and refuses live or historical quizzes.
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.evaluate(() => {
            fixture = structuredClone(original); authOK = true; window.authEdit = false;
            window.convertDate = value => value || null;
            firebase.firestore.FieldValue.delete = () => '__DELETE__';
            window.stored = { ...structuredClone(fixture), isActive: false, lastAiAnalysis: { old: true }, lastAiAudit: { old: true }, translations: { en: ['old'] } };
            window.records = { 'source-quiz': structuredClone(stored) }; window.atomicWrites = 0;
            window.hasAttempts = false; window.hasSessions = false; window.txFail = false; window.txUncertain = false;
            const doc = id => ({ id: id || 'backup-' + ++docCount, get: async function () {
                const data = structuredClone(records[this.id]); return { exists: !!data, data: () => data };
            } });
            window.db = {
                collection: name => name === 'quizzes' ? { doc } : { where: (field, op, value) => {
                    if (value !== 'source-quiz' || field !== (name === 'quiz_attempts' ? 'quizId' : 'examId')) throw Error('Wrong history query');
                    return { get: async () => { const present = name === 'quiz_attempts' ? hasAttempts : hasSessions; const id = name === 'quiz_attempts' ? 'old-attempt' : 'old-session'; return { empty: !present, docs: present ? [{ ref: doc(id), data: () => structuredClone(records[id] || {}) }] : [] }; } };
                } },
                runTransaction: async callback => {
                    const pending = [];
                    await callback({ get: ref => ref.get(), set: (ref, value) => pending.push([ref.id, value]), update: (ref, value) => pending.push([ref.id, { ...records[ref.id], ...value }]) });
                    if (txFail) throw Error('Atomic write failed');
                    for (const [id, value] of pending) { records[id] = structuredClone(value); for (const key of Object.keys(records[id])) if (records[id][key] === '__DELETE__') delete records[id][key]; }
                    atomicWrites += pending.length;
                    if (txUncertain) throw Error('Write response lost');
                }
            };
        });
        const apply = async () => { assert.equal(await page.locator('#curate-apply').isDisabled(), false, await feedback()); await page.locator('#curate-apply').click(); };
        for (const flag of ['active']) {
            await page.evaluate(flag => { records['source-quiz'] = structuredClone(stored); records['source-quiz'].isActive = flag === 'active'; hasAttempts = flag === 'attempts'; hasSessions = flag === 'sessions'; }, flag);
            await open(); await suggest(result()); await apply();
            assert.match(await feedback(), flag === 'active' ? /quiz is active/ : /attempts or exam sessions/);
            assert.equal(await page.evaluate(() => atomicWrites), 0); await close();
        }
        await page.evaluate(() => { records['source-quiz'] = structuredClone(stored); hasAttempts = false; hasSessions = false; });
        await open(); await suggest(result());
        await page.evaluate(() => records['source-quiz'].title = 'Concurrent edit'); await apply();
        assert.match(await feedback(), /stored quiz changed/); await close();
        await page.evaluate(() => records['source-quiz'] = structuredClone(stored));
        await open(); await suggest(result());
        page.once('dialog', d => { assert.match(d.message(), /Q11, Q12, Q13, Q14/); d.dismiss(); });
        await apply(); assert.match(await feedback(), /cancelled/); assert.equal(await page.evaluate(() => atomicWrites), 0);
        await page.evaluate(() => txFail = true); page.once('dialog', d => d.accept()); await apply();
        assert.match(await feedback(), /Atomic write failed/); assert.equal(await page.evaluate(() => Object.keys(records).length), 1);
        await page.evaluate(() => { txFail = false; txUncertain = true; }); page.once('dialog', d => d.accept()); await apply();
        assert.match(await feedback(), /Write response lost/);
        await page.evaluate(() => txUncertain = false); await apply();
        await page.waitForFunction(() => !document.getElementById('quiz-curate-dialog').open);
        assert.equal(await page.locator('#quiz-curate-dialog').isVisible(), false);
        const applied = await page.evaluate(() => records);
        const current = applied['source-quiz'], backup = applied[current.curation.backupQuizId];
        assert.equal(current.questions.length, 10); assert.equal(current.isActive, false);
        assert.deepEqual(backup.questions, original.questions); assert.equal(backup.isActive, false);
        assert.equal(backup.curationBackup.sourceQuizId, 'source-quiz');
        assert.equal(current.lastAiAnalysis, undefined); assert.equal(current.lastAiAudit, undefined); assert.equal(current.translations, undefined);
        assert.equal(await page.evaluate(() => atomicWrites), 2, 'retry cannot duplicate backup or update');
        await page.evaluate(() => { records = { 'source-quiz': structuredClone(stored) }; atomicWrites = 0; });
        await open(); await suggest(result());
        await page.locator('#curate-create-backup').uncheck();
        page.once('dialog', d => { assert.match(d.message(), /No backup will be created/); d.accept(); });
        await apply();
        await page.waitForFunction(() => !document.getElementById('quiz-curate-dialog').open);
        assert.equal(await page.evaluate(() => Object.keys(records).length), 1);
        assert.equal(await page.evaluate(() => records['source-quiz'].questions.length), 10);
        assert.equal(await page.evaluate(() => records['source-quiz'].curation.backupQuizId), null);
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await page.evaluate(() => {
            records = { 'source-quiz': structuredClone(stored),
                'old-attempt': { quizId: 'source-quiz', answers: [0,1], score: 7, status: 'approved' },
                'old-session': { examId: 'source-quiz', state: 'done', finalAnswers: {0:1} } };
            hasAttempts = hasSessions = true; atomicWrites = 0;
        });
        await open(); await suggest(result());
        await page.locator('#curate-create-backup').uncheck();
        await page.evaluate(() => txFail = true);
        page.once('dialog', d => d.accept()); await apply();
        assert.equal(await page.evaluate(() => records['old-attempt'].quizRevisionId), undefined);
        assert.equal(await page.evaluate(() => records['source-quiz'].questions.length), 14);
        assert(await page.locator('#quiz-curate-dialog').isVisible());
        await page.evaluate(() => txFail = false);
        page.once('dialog', d => d.accept()); await apply();
        await page.waitForFunction(() => !document.getElementById('quiz-curate-dialog').open);
        const historical = await page.evaluate(() => records);
        const revisionId = historical['source-quiz'].curation.backupQuizId;
        assert.equal(historical['old-attempt'].quizRevisionId, revisionId);
        assert.equal(historical['old-session'].quizRevisionId, revisionId);
        assert.deepEqual(historical['old-attempt'].answers, [0,1]);
        assert.equal(historical['old-attempt'].score, 7);
        assert.equal(historical[revisionId].questions.length, 14);
        assert.equal(historical[revisionId].isHistoryRevision, true);
        assert.equal(historical['source-quiz'].questions.length, 10);
        assert.deepEqual(historical['old-session'].finalAnswers, {0:1});
        await page.addScriptTag({ path: 'public/quiz-revision.js' });
        assert.equal(await page.evaluate(() => quizForAttempt(records['source-quiz'], records['old-attempt'], Object.entries(records).map(([id,q]) => ({...q,id}))).questions.length), 14);
        await page.evaluate(() => { records = { 'source-quiz': structuredClone(stored) }; atomicWrites = 0; hasAttempts = hasSessions = false; });
        const split = () => page.locator('#curate-split').click();
        for (const flag of ['active', 'attempts', 'sessions']) {
            await page.evaluate(flag => { records['source-quiz'].isActive = flag === 'active'; hasAttempts = flag === 'attempts'; hasSessions = flag === 'sessions'; }, flag);
            await open(); await suggest(result()); await split();
            assert.match(await feedback(), flag === 'active' ? /quiz is active/ : /attempts or exam sessions/); await close();
        }
        await page.evaluate(() => { hasSessions = false; records['source-quiz'] = structuredClone(stored); });
        await open(); await suggest(result());
        page.once('dialog', d => { assert.match(d.message(), /Original keeps 10/); assert.match(d.message(), /New inactive quiz receives 4: Q11, Q12, Q13, Q14/); d.dismiss(); });
        await split(); assert.match(await feedback(), /cancelled/); assert.equal(await page.evaluate(() => atomicWrites), 0);
        await page.evaluate(() => txFail = true); page.once('dialog', d => d.accept()); await split();
        assert.equal(await page.evaluate(() => Object.keys(records).length), 1, 'failed split leaves all three documents untouched');
        await page.evaluate(() => { txFail = false; txUncertain = true; }); page.once('dialog', d => d.accept()); await split();
        assert.match(await feedback(), /Write response lost/);
        await page.evaluate(() => txUncertain = false); await split();
        assert.match(await feedback(), /Split complete: original keeps 10, new inactive quiz contains 4/);
        const splitData = await page.evaluate(() => records), keptQuiz = splitData['source-quiz'];
        const removedQuiz = splitData[keptQuiz.curation.splitQuizId], splitBackup = splitData[keptQuiz.curation.backupQuizId];
        assert.deepEqual(keptQuiz.questions, original.questions.slice(0, 10));
        assert.deepEqual(removedQuiz.questions, original.questions.slice(10));
        assert.deepEqual(splitBackup.questions, original.questions);
        assert.match(splitBackup.title, /Before Split/);
        assert.equal(removedQuiz.isActive, false); assert.equal(removedQuiz.startTime, null); assert.equal(removedQuiz.deadline, null);
        assert.equal(removedQuiz.targetGroup, original.targetGroup); assert.equal(removedQuiz.totalPoints, original.totalPoints);
        assert.equal(removedQuiz.translations, undefined);
        assert.deepEqual(removedQuiz.curation.originalQuestionNumbers, [11, 12, 13, 14]);
        assert.equal(await page.evaluate(() => atomicWrites), 3, 'split retry creates no duplicate quizzes');
        await close();
        await page.evaluate(() => {
            records = { 'source-quiz': structuredClone(stored) }; fixture = structuredClone(original);
            window.savedRuns = [];
            curateHistory.save = async (id, run) => { savedRuns.unshift(structuredClone(run)); };
            curateHistory.load = async () => structuredClone(savedRuns);
        });
        await open(); await suggest(result());
        const callsBeforeCache = await page.evaluate(() => calls.length);
        await close(); await open();
        await page.waitForFunction(() => document.getElementById('curate-history-status').textContent.includes('Saved result'));
        assert.equal(await page.evaluate(() => calls.length), callsBeforeCache);
        assert.equal(await saveDisabled(), false);
        await page.locator('#curate-history > summary').click();
        assert.equal(await page.locator('#curate-history-list > details').count(), 1);
        await suggest(result());
        assert.equal(await page.evaluate(() => calls.length), callsBeforeCache + 1);
        await close();
        await page.evaluate(() => fixture.questions[0].q += ' changed');
        await open();
        await page.waitForFunction(() => document.getElementById('curate-history-status').textContent.includes('differ'));
        assert.equal(await saveDisabled(), true);
        await close();
        assert.deepEqual(errors, []);
        console.log('PASS: Curate responsive 320–1024px, model routing, ID/count/pin validation, manual review, safe text rendering, inactive copy with original answers/settings, auth/stale guards, duplicate-write retry and async session isolation');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
