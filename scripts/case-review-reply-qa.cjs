// V102.423: Review Case Score — lean (2 rows) + the admin's REPLY to the intern. The real modal markup / CSS, the real open / close / toggle functions
// and submissionReviewedFields cut from public/admin.html; the save path is pinned in the source of updateCaseStatus.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = admin.indexOf(a); assert.ok(i > 0, a); return admin.slice(i, admin.indexOf(b, i)); };
const modal = admin.match(/<div id="caseReviewScoreModal"[\s\S]*?\n    <\/div>\r?\n/)[0];
const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
const fns = cut('        window.toggleCaseReviewReply = function', '        async function updateCaseStatus(');

// ---- the save path (static): the reply goes on the case AND the intern's mirror; none → nothing is overwritten
const upd = cut('        async function updateCaseStatus(', 'const previousBonus = parseFloat(caseItem.adminBonus)');
assert.ok(/const replyText = String\(window\.caseReviewLastReply \|\| ''\)\.trim\(\);/.test(upd), 'reads the reply right after the modal resolves');
assert.ok(/\.\.\.\(replyText \? \{ adminComment: replyText, adminCommentAt: [^}]*adminCommentBy: ALLOWED_EMAIL \|\| 'admin' \} : \{\}\)/.test(upd), 'on the case: only when there is a reply');
assert.ok(upd.includes('submissionReviewedFields(bonus, replyText)'), 'and on the intern mirror (its History shows adminComment)');
assert.ok(upd.includes("(replyText ? ' · reply sent' : '')"), 'the toast says so');
const rf = new Function('firebase', cut('        function submissionReviewedFields(', '        // V95.98: per-source') + '; return submissionReviewedFields;')({ firestore: { FieldValue: { serverTimestamp: () => 'TS' } } });
assert.deepEqual(Object.keys(rf(0.5, 'ดีมาก')).sort(), ['adminBonus', 'adminComment', 'pointsAmount', 'pointsAwarded', 'reviewedAt', 'score', 'status'], 'a reply → adminComment');
assert.equal('adminComment' in rf(0.5), false, 'no reply → the key is left out (an older reply is never wiped)');
assert.equal(rf(0.5, 'x').adminComment, 'x');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><style>.modal{display:none;position:static!important}</style>${modal}`);
        await page.evaluate(() => { window.escapeHtml = s => String(s); window.calls = []; window.callUniversalAI = async () => ({ text: '{}' }); });
        await page.addScriptTag({ path: 'public/case-review-ai.js' });
        await page.addScriptTag({ content: `
            window.forceShowModal = id => { document.getElementById(id).style.display = 'flex'; };
            window.forceHideModal = id => { document.getElementById(id).style.display = 'none'; };
            window.syncCaseReviewScoreChips = () => {};
            window.setCaseReviewScoreValue = v => { document.getElementById('case-review-score-input').value = Number(v).toFixed(1); };
            ${fns}
            window.closeCaseReviewScoreModal = closeCaseReviewScoreModal; window.openCaseReviewScoreModal = openCaseReviewScoreModal;
            window.hold = () => {};
        ` });
        const open = (item) => page.evaluate(item => { window.result = undefined; openCaseReviewScoreModal(item).then(v => { window.result = { v }; }); }, item);
        const vis = sel => page.locator(sel).isVisible();

        // 1. a single case: the lean modal — chip + 🔍 on the title row, chips + Custom + 💬 Reply + Save on ONE row, the reply box closed
        await open({ id: 'c1', userId: 'U1', caseId: '26955', adminBonus: 0, note: 'hi' });
        const shell = await page.locator('.case-score-modal-shell').boundingBox();
        assert.ok(shell.width <= 600 && shell.height <= 160, 'width fits the content, ~2 rows: ' + JSON.stringify(shell));
        const ys = await page.evaluate(() => ['.case-score-chip', '#case-review-score-input', '#case-review-reply-toggle', '.csr-save'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top)));
        assert.ok(Math.max(...ys) - Math.min(...ys) < 12, 'chips · Custom · 💬 Reply · Save on ONE row: ' + ys);
        assert.equal(await vis('#case-review-reply'), false, 'the reply box is closed by default');
        assert.equal(await vis('#case-review-reply-toggle'), true);
        assert.equal(await page.locator('button', { hasText: /^Cancel$/ }).count(), 0, 'Cancel is gone (× and Esc remain)');
        // 2. 💬 opens it; typing counts; the cap is 500
        await page.click('#case-review-reply-toggle');
        assert.equal(await vis('#case-review-reply'), true); assert.equal(await page.getAttribute('#case-review-reply-toggle', 'aria-expanded'), 'true');
        await page.fill('#case-review-reply-text', '  ขอเพิ่มประวัติแพ้ยาด้วยนะ  ');
        assert.equal(await page.textContent('#case-review-reply-count'), '29 / 500'.replace('29', String('  ขอเพิ่มประวัติแพ้ยาด้วยนะ  '.length)));
        assert.equal(await page.getAttribute('#case-review-reply-text', 'maxlength'), '500');
        assert.equal(await page.$eval('#case-review-reply-toggle', e => e.classList.contains('has-text')), true, 'a dot on 💬 when there is text');
        // 3. Save → the score string resolves; the reply (trimmed) is kept for updateCaseStatus
        await page.fill('#case-review-score-input', '0.5');
        await page.click('.csr-save');
        await page.waitForFunction(() => window.result);
        assert.equal(await page.evaluate(() => window.result.v), '0.5');
        assert.equal(await page.evaluate(() => window.caseReviewLastReply), 'ขอเพิ่มประวัติแพ้ยาด้วยนะ', 'trimmed reply');
        assert.equal(await vis('.case-score-modal-shell'), false, 'the modal closed');
        // 4. × / Esc cancel: no score, no reply
        await open({ id: 'c1', userId: 'U1', caseId: '26955', adminBonus: 0 });
        await page.click('#case-review-reply-toggle'); await page.fill('#case-review-reply-text', 'will not be sent');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => window.result);
        assert.equal(await page.evaluate(() => [window.result.v, window.caseReviewLastReply].join('|')), '|', 'Esc → null result, empty reply');
        // 5. a saved reply opens pre-filled and expanded
        await open({ id: 'c1', userId: 'U1', caseId: '26955', adminBonus: 0.2, adminComment: 'เดิม: เขียนดีมาก' });
        assert.equal(await vis('#case-review-reply'), true); assert.equal(await page.inputValue('#case-review-reply-text'), 'เดิม: เขียนดีมาก');
        await page.click('#case-review-reply-toggle');   // collapse + reopen keeps the text
        await page.click('#case-review-reply-toggle');
        assert.equal(await page.inputValue('#case-review-reply-text'), 'เดิม: เขียนดีมาก');
        await page.click('.csr-x'); await page.waitForFunction(() => window.result);
        // 6. bulk / product reviews (no id + userId): no reply control, nothing stale
        await open({ caseId: '3 selected' });
        assert.equal(await vis('#case-review-reply-toggle'), false, 'no reply for a bulk review');
        assert.equal(await vis('#case-review-reply'), false); assert.equal(await page.inputValue('#case-review-reply-text'), '');
        await page.click('.csr-save'); await page.waitForFunction(() => window.result);
        assert.equal(await page.evaluate(() => window.caseReviewLastReply), '', 'no reply leaks into a bulk save');
        await page.close();
        console.log('PASS: Review Case Score lean (one control row, ~2 rows) + reply to the intern — saved on the case and its History mirror, Esc / × send nothing, a saved reply reopens, none for bulk, an old reply is never wiped.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
