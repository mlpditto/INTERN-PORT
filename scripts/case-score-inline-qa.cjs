// V102.572: the Score card of Edit Case Note is the review: one tap = one award, a new score reverts the old one first, colour says saved, Undo, a dirty note is saved first, folded cases stay read-only, the most used scores become the chips.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i > 0 && j > i, a); return html.slice(i, j); };
const block = cut('        const ECN_SCORES = ', '        window.caseOpenDecide = function');
const css = cut('        .ecn-score { background', '        #ecn-review-slot #case-review-reply');
assert.ok(!/id="edit-case-decide"/.test(html) && !/caseOpenDecide\('review'\)/.test(html), 'the Review button is gone');
const updateFn = (() => { const a = html.indexOf('        async function updateCaseStatus('); let d = 0, i = html.indexOf('opts = {}) {', a) + 'opts = {}) '.length; for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}' && --d === 0) break; } return html.slice(a, i + 1); })();

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 800 } }), errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.route('https://qa.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="toast"></div><div id="caseReviewScoreModal"><div class="modal-content"><span id="case-review-ai-head"></span><div id="case-review-ai"></div><div id="case-review-reply"><textarea id="case-review-reply-text"></textarea></div></div></div><input id="edit-case-note-id"><div id="ecn-score"><div id="edit-case-note-score"></div><div id="ecn-score-rail" hidden></div></div><textarea id="edit-case-note-text"></textarea><input id="edit-case-note-ref"><input id="edit-case-note-customer"><input id="edit-case-taxonomy-system"><div id="ecn-review-slot"></div>` }));
        await page.goto('https://qa.test/a.html');
        await page.evaluate(() => {
            window.__w = { users: {}, logs: [], cases: [], saved: 0 }; window.alert = m => { throw new Error('alert: ' + m); };
            const D = { serverTimestamp: () => 'ts', delete: () => '__del', increment: n => ({ inc: n }) };
            window.firebase = { firestore: { FieldValue: D } };
            window.db = { collection: n => ({ doc: id => ({ n, id: id || 'log' + (__w.logs.length + 1) }) }), batch: () => { const ops = []; const add = (r, f) => ops.push([r, f]); return { update: add, set: add, commit: async () => ops.forEach(([r, f]) => { if (r.n === 'users') __w.users[r.id] = (__w.users[r.id] || 0) + f.score.inc; else if (r.n === 'checkin_logs') __w.logs.push(f); else if (r.n === 'cases') __w.cases.push(f); }) }; } };
            window.ALLOWED_EMAIL = 'a@x'; window.stageSubmissionMirror = async () => 1; window.submissionReviewedFields = () => ({}); window.showToast = m => { window.__toast = m; };
            window.inferAlabastaTaxonomyKey = () => 'skin'; window.getAlabastaPrimarySystemLabel = () => 'Skin'; window.buildAlabastaReviewLogNote = () => 'n'; window.getEditCaseSelectedTags = () => [];
            window.renderAlabastaCases = () => {}; window.toggleCaseReviewReply = () => {}; window.syncCaseReviewReply = () => {};
            window.saveEditedCaseNote = async () => { __w.saved++; casesData[0] = { ...casesData[0], note: document.getElementById('edit-case-note-text').value }; return true; };
            window.casesData = [{ id: 'a', userId: 'u', caseId: '1', customer: '', note: 'n', status: 'pending', adminBonus: 0 }, { id: 'b', userId: 'u', caseId: '2', customer: '', note: 'n', status: 'reviewed', adminBonus: 0, duplicateOf: 'a' }];
            window.__fill = c => { document.getElementById('edit-case-note-id').value = c.id; document.getElementById('edit-case-note-text').value = c.note; document.getElementById('edit-case-note-ref').value = c.caseId; document.getElementById('edit-case-note-customer').value = c.customer; document.getElementById('edit-case-taxonomy-system').value = 'skin'; };
        });
        await page.addScriptTag({ content: block + '\n' + updateFn + '\nObject.assign(window, { ecnScoreOpen, ecnScoreClose, ecnScoreSet, ecnScorePaint, ecnTopScores, updateCaseStatus });' });
        const open = i => page.evaluate(n => { __fill(casesData[n]); ecnScoreOpen(casesData[n]); }, i);
        const state = () => page.evaluate(() => ({ user: __w.users.u || 0, logs: __w.logs.length, c: casesData[0].status, b: casesData[0].adminBonus, ok: document.getElementById('ecn-score').classList.contains('ok'), on: [...document.querySelectorAll('#ecn-score-rail button.on')].map(x => x.textContent) }));

        await open(0);
        assert.equal(await page.locator('#ecn-review-slot #case-review-reply').count(), 1, 'reply moved in');
        assert.deepEqual(await page.locator('.case-score-chip').allInnerTexts(), ['0.1', '0.2', '0.5', '1']);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.click('.case-score-chip[data-score="0.5"]');
        await page.waitForFunction(() => casesData[0].status === 'reviewed');
        let s = await state();
        assert.deepEqual([s.user, s.logs, s.b, s.ok, s.on], [0.5, 1, 0.5, true, ['0.5']], 'one tap = one award, green');
        await page.click('.case-score-chip[data-score="0.5"]'); await page.waitForTimeout(80);
        assert.equal((await state()).user, 0.5, 'the same score again changes nothing');
        await page.click('.case-score-chip[data-score="1"]');
        await page.waitForFunction(() => casesData[0].adminBonus === 1);
        s = await state();
        assert.deepEqual([s.user, s.on], [1, ['1']], 'a new score replaces the old one, points do not stack');
        await page.click('#toast .toast-undo');
        await page.waitForFunction(() => casesData[0].adminBonus === 0.5);
        assert.equal((await state()).user, 0.5, 'Undo goes back to the earlier score');
        await page.click('#toast .toast-undo').catch(() => {});
        await page.evaluate(() => { __fill(casesData[0]); });
        await page.fill('#ecn-score-input', '-1'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
        assert.equal((await state()).user, 0.5, 'a bad score writes nothing');
        await page.fill('#edit-case-note-text', 'edited');
        await page.fill('#ecn-score-input', '0.7'); await page.keyboard.press('Enter');
        await page.waitForFunction(() => casesData[0].adminBonus === 0.7);
        s = await state();
        assert.equal(s.user, 0.7); assert.equal(await page.evaluate(() => __w.saved), 1, 'a changed note is saved first');
        assert.ok(await page.locator('#ecn-score-input.on').count(), 'a typed score shows green');
        await page.evaluate(() => { localStorage.setItem('case_score_counts', JSON.stringify({ 0.3: 9, 0.7: 5, 0.1: 1, 1: 2 })); });
        assert.deepEqual(await page.evaluate(() => ecnTopScores()), [0.1, 0.3, 0.7, 1], 'the most used scores become the chips');
        await open(1);
        assert.equal(await page.locator('#ecn-score-rail').isHidden(), true, 'a folded case stays read-only');
        assert.deepEqual(errs, []);
        console.log('case-score-inline-qa OK');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
