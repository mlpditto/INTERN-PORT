// V101.279 (intern): self-service retake — the 0-score card's 🔄 Retake opens a reason sheet (4 chips or free text,
// ≥ 3 chars enables Retake now), the attempt flips straight to 'allowed' (allowedBy 'self', reason + count, merge)
// and the start card opens; Cancel writes nothing. Real markup + CSS + functions, Firestore stubbed.
// Admin half (V102.601): the pending row shows "🔄 Retake ×n · reason" when the attempt carries retakeReason.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r/g, '');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice: ' + a); return html.slice(i, j); };
const modal = slice('    <div id="retakeReasonModal"', '    <div id="quizModal" class="modal">');
const js = slice('        const RETAKE_REASON_CHIPS = [', '        // ===================================================================\n        // V95.22');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

// --- static: the card wires the new flow; the old admin-gated request stays only for Interrupted / real exam
assert.match(html, /onclick="requestRetakeWithReason\('\$\{q\.id\}'\)"[^>]*>🔄 Retake ขอสอบใหม่</, 'score-0 card → reason sheet');
assert.doesNotMatch(html, /Request Retake ขอสอบใหม่/, 'old label gone');
assert.equal((html.match(/requestLateQuiz\('\$\{q\.id\}', true\)/g) || []).length, 1, 'only the Interrupted card still asks admin');
assert.match(html, /attempt\.allowedBy === 'self'\s*\n\s*\? `<span class="assign-tag"[^`]*>🔄<\/span>`/, "'allowed' badge says retake, not late");
assert.match(html, /<title>Internship Portfolio \(V101\.279\)<\/title>/);
// admin: the pending row carries the reason, escaped, with the count
assert.match(admin, /const retakeNote = att\.retakeReason\s*\n\s*\? `<div class="lang-no-toggle"[^`]*🔄 Retake\$\{att\.retakeCount > 1 \? ' ×' \+ att\.retakeCount : ''\} · \$\{escapeHtml\(String\(att\.retakeReason\)\)\}<\/div>`/);
assert.match(admin, /\$\{oohNote\}\$\{retakeNote\}\$\{isPoll \?/, 'note rides above the Review / Approve buttons');
assert.match(admin, /<title>Nika Admin \(V102\.601\)<\/title>/);

async function open(browser) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://intern.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
    await page.goto('https://intern.test/');
    await page.addStyleTag({ content: styles });
    await page.evaluate(m => {
        document.body.insertAdjacentHTML('beforeend', m);
        window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        window.requireRegistered = () => true;
        window.userId = 'U1'; window.userProfile = { displayName: 'Bew', pictureUrl: 'p.png' };
        window.quizzesCache = [{ id: 'q1', title: 'Retail Pharmacy-2', shortTitle: 'Retail-2' }];
        window.quizAttemptsCache = { q1: { quizId: 'q1', userId: 'U1', status: 'pending', correctCount: 0, totalQuestions: 15 } };
        window.writes = []; window.started = []; window.alerts = [];
        window.alert = m => alerts.push(m);
        window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS', increment: n => ({ inc: n }) } } };
        window.db = { collection: c => ({ doc: id => ({ set: (data, opt) => { writes.push({ c, id, data, opt }); return window.failWrite ? Promise.reject(new Error('offline')) : Promise.resolve(); } }) }) };
        window.confirmRunQuiz = id => { started.push([id, JSON.parse(JSON.stringify(quizAttemptsCache[id]))]); return Promise.resolve(); };
    }, modal);
    await page.addScriptTag({ content: js + '\nwindow.requestRetakeWithReason = requestRetakeWithReason; window.retakeReasonPrompt = retakeReasonPrompt; window.RETAKE_REASON_CHIPS = RETAKE_REASON_CHIPS;' });
    return { page, errors };
}
const settle = page => page.evaluate(() => new Promise(r => setTimeout(r, 20)));

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors } = await open(browser);
        const m = page.locator('#retakeReasonModal'), ok = page.locator('#rrm-confirm'), ta = page.locator('#rrm-reason');
        assert.equal(await m.evaluate(e => getComputedStyle(e).display), 'none', 'closed at first');

        // open from the card: the quiz name heads the sheet, 4 chips, Retake now disabled until a reason is in
        await page.evaluate(() => { window.flow = requestRetakeWithReason('q1'); });
        await settle(page);
        assert.equal(await m.evaluate(e => getComputedStyle(e).display), 'flex', 'sheet opens');
        assert.equal(await page.locator('#rrm-quizname').innerText(), 'Retail Pharmacy-2');
        assert.equal(await page.locator('.rrm-chip').count(), 4);
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.rrm-chip')].map(c => c.textContent)), await page.evaluate(() => RETAKE_REASON_CHIPS));
        assert.equal(await ok.isDisabled(), true, 'disabled while empty');
        assert.equal(await page.locator('.rrm-note').innerText(), '▶ Starts right away เริ่มทำทันที');
        // touch targets on a phone
        for (const sel of ['.rrm-chip', '#rrm-cancel', '#rrm-confirm']) {
            const h = await page.locator(sel).first().evaluate(e => e.getBoundingClientRect().height);
            assert.ok(h >= 30, sel + ' height ' + h);
        }
        const box = await page.locator('.rrm').boundingBox();
        assert.ok(box.width <= 390 && box.x >= 0, 'sheet fits the phone width');

        // typing: 2 chars still disabled, 3 enables; a chip fills the box and lights up; editing the text unlights it
        await ta.fill('ab'); assert.equal(await ok.isDisabled(), true, '2 chars not enough');
        await ta.fill('abc'); assert.equal(await ok.isDisabled(), false, '3 chars enable');
        await page.locator('.rrm-chip').nth(1).click();
        assert.equal(await ta.inputValue(), '📶 Connection dropped เน็ตหลุด');
        assert.equal(await page.locator('.rrm-chip.on').count(), 1, 'the picked chip is lit');
        assert.equal(await ok.isDisabled(), false);
        await ta.fill('📶 Connection dropped เน็ตหลุด — twice');
        assert.equal(await page.locator('.rrm-chip.on').count(), 0, 'edited text = no chip lit');
        // the click does not pop the keyboard (no focus steal) — the box can still be edited by tapping it
        await page.locator('.rrm-chip').nth(0).click();
        assert.notEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'rrm-reason', 'chip tap leaves focus alone');

        // cancel: resolves empty, nothing written, nothing started, sheet closed
        await page.locator('#rrm-cancel').click();
        await page.evaluate(() => window.flow);
        assert.equal(await m.evaluate(e => getComputedStyle(e).display), 'none', 'closed');
        assert.deepEqual(await page.evaluate(() => [writes.length, started.length]), [0, 0], 'cancel = no write, no start');

        // confirm: one merge write → 'allowed' by self with the reason + count, cache updated first, then the start card
        await page.evaluate(() => { window.flow = requestRetakeWithReason('q1'); });
        await settle(page);
        assert.equal(await ta.inputValue(), '', 'box cleared on reopen');
        assert.equal(await ok.isDisabled(), true, 'disabled again on reopen');
        await page.locator('.rrm-chip').nth(0).click();
        await ok.click();
        await page.evaluate(() => window.flow);
        const w = await page.evaluate(() => writes);
        assert.equal(w.length, 1);
        assert.equal(w[0].c, 'quiz_attempts'); assert.equal(w[0].id, 'q1_U1'); assert.deepEqual(w[0].opt, { merge: true });
        assert.equal(w[0].data.status, 'allowed'); assert.equal(w[0].data.allowedBy, 'self');
        assert.equal(w[0].data.retakeReason, '⏱️ Ran out of time หมดเวลา');
        assert.deepEqual(w[0].data.retakeCount, { inc: 1 });
        assert.equal(w[0].data.allowedAt, 'TS'); assert.equal(w[0].data.retakeRequestedAt, 'TS');
        assert.equal(w[0].data.displayName, 'Bew');
        assert.ok(!('answers' in w[0].data) && !('correctCount' in w[0].data), 'merge: nothing of the old attempt is overwritten here');
        const s = await page.evaluate(() => started);
        assert.equal(s.length, 1); assert.equal(s[0][0], 'q1');
        assert.equal(s[0][1].status, 'allowed', 'runQuiz already sees allowed');
        assert.equal(s[0][1].retakeCount, 1); assert.equal(s[0][1].allowedBy, 'self');
        assert.equal(s[0][1].correctCount, 0, 'cache keeps the old fields until the listener repaints');
        assert.equal(await m.evaluate(e => getComputedStyle(e).display), 'none');

        // a failed write: one alert, no start, sheet closed
        await page.evaluate(() => { window.failWrite = true; window.flow = requestRetakeWithReason('q1'); });
        await settle(page);
        await ta.fill('เน็ตหลุด'); await ok.click(); await page.evaluate(() => window.flow);
        assert.deepEqual(await page.evaluate(() => [alerts.length, started.length]), [1, 1], 'error alerted, nothing started');
        assert.match(await page.evaluate(() => alerts[0]), /^Retake Error: /);

        // reason is capped at 300 chars (maxlength on the box + slice in code)
        await page.evaluate(() => { window.failWrite = false; window.flow = requestRetakeWithReason('q1'); });
        await settle(page);
        await page.evaluate(() => { const t = document.getElementById('rrm-reason'); t.value = 'x'.repeat(400); t.dispatchEvent(new Event('input')); });
        await ok.click(); await page.evaluate(() => window.flow);
        assert.equal(await page.evaluate(() => writes[writes.length - 1].data.retakeReason.length), 300);

        // not registered: nothing opens
        await page.evaluate(() => { window.requireRegistered = () => false; return requestRetakeWithReason('q1'); });
        assert.equal(await m.evaluate(e => getComputedStyle(e).display), 'none');

        // picture for the owner
        await page.evaluate(() => { window.requireRegistered = () => true; window.flow = requestRetakeWithReason('q1'); });
        await settle(page);
        await page.locator('.rrm-chip').nth(2).click();
        await page.waitForTimeout(600);   // the global button transition — the lit chip and the enabled button must have settled
        assert.equal(await page.locator('.rrm-chip.on').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(249, 115, 22)', 'lit chip is solid orange');
        assert.equal(await ok.evaluate(e => getComputedStyle(e).opacity), '1', 'enabled button at full strength');
        if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
        assert.deepEqual(errors, [], 'no page errors');
        console.log('retake-reason-qa: ok');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
