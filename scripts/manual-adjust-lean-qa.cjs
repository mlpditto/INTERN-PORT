// V102.254 — Edit Manual Adjustment, lean. The REAL modal markup + openManualAdjustEditModal / maEdit* helpers from public/admin.html in Chromium with a fake Firestore.
// Covers: the row's kind / quiz / the user's score as pills, a feedback-revert warning with ↩️ undo (amount → 0 + reason), live "→ ⭐ score after" with the delta, 0 / ↺ / reason chips,
// the reason is still required, the save path still gets the same ids, the card is short (the old sheet was full-height) and fits at 360px.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8').replace(/\r\n/g, '\n');
const a = html.indexOf('<div id="manualAdjustEditModal"'), b = html.indexOf('<div id="pollResultModal"');
assert.ok(a > 0 && b > a, 'modal markup found');
const modal = html.slice(a, b);
function grab(head) { const i = html.indexOf(head); if (i < 0) throw new Error('missing ' + head); let d = 0; for (let k = html.indexOf('{', i + head.length - 1); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } }
const fns = ['window.openManualAdjustEditModal = async function(logId)', 'window.manualAdjustRenderHistory = function(history)', 'window.maEditRefresh = function()'].map(grab).join(';\n') + ';\n'
    + ['window.maEditSetAmount =', 'window.maEditReset =', 'window.maEditReason =', 'window.maEditUndoRevert ='].map(h => html.slice(html.indexOf(h), html.indexOf('\n', html.indexOf(h)))).join('\n');
for (const id of ['ma-edit-meta', 'ma-edit-amount', 'ma-edit-amount-orig', 'ma-edit-note', 'ma-edit-reason', 'ma-edit-reason-error', 'ma-edit-status', 'ma-edit-save-btn', 'ma-edit-history-list', 'ma-edit-history-count']) assert.ok(modal.includes('id="' + id + '"'), 'id kept for the save path: ' + id);
assert.ok(/onclick="manualAdjustSaveEdit\(\)"/.test(modal), 'Save still calls manualAdjustSaveEdit');

const file = path.resolve('public/_ma_lean_qa.html');
const row = (id, o) => JSON.stringify(Object.assign({ type: 'manual_adjust', amount: -0.9, note: "Revert: Quiz Feedback deleted via Panel — 'PRETEST-1.1'", editHistory: [], timestamp: '__TS__', createdByEmail: 'medlifeplus@gmail.com' }, o || {}));
fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>.modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);align-items:center;justify-content:center}.modal-content{background:#fff}</style>${modal}
<script>
window._currentPopupUser = 'U1'; var usersData = [{ id: 'U1', score: 0.01 }];
var LOGS = { L1: ${row('L1')}, L2: ${row('L2', { amount: 0.5, note: 'good answer' })} };
var db = { collection: () => ({ doc: id => ({ get: async () => ({ exists: !!LOGS[id], data: () => Object.assign({}, LOGS[id], { timestamp: { toDate: () => new Date('2026-10-15T14:32:26') } }) }) }) }) };
${fns}
</script>`);

(async () => {
    const browser = await chromium.launch();
    try {
        for (const [w, label] of [[900, 'desktop'], [360, 'phone']]) {
            const page = await browser.newPage({ viewport: { width: w, height: 800 } });
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(pathToFileURL(file).href);
            await page.evaluate(() => openManualAdjustEditModal('L1'));
            const t = await page.evaluate(() => ({
                shown: getComputedStyle(document.getElementById('manualAdjustEditModal')).display, score: document.getElementById('ma-edit-score').textContent, kind: document.getElementById('ma-edit-kind').textContent,
                quiz: [document.getElementById('ma-edit-quiz').hidden, document.getElementById('ma-edit-quiz').textContent], warn: !document.getElementById('ma-edit-warn').hidden, amt: document.getElementById('ma-edit-amount').value,
                orig: document.getElementById('ma-edit-amount-orig').textContent, delta: document.getElementById('ma-edit-delta').textContent, meta: document.getElementById('ma-edit-meta').textContent, metaTitle: document.getElementById('ma-edit-meta').title,
                h: Math.round(document.querySelector('#manualAdjustEditModal .ma-card').getBoundingClientRect().height), over: document.querySelector('#manualAdjustEditModal .ma-card').scrollWidth > document.querySelector('#manualAdjustEditModal .ma-card').clientWidth + 1,
            }));
            assert.strictEqual(t.shown, 'flex'); assert.strictEqual(t.score, '⭐ 0.01'); assert.strictEqual(t.kind, '↩️ feedback revert');
            assert.deepStrictEqual(t.quiz, [false, '📝 PRETEST-1.1'], 'the quiz is read from the note');
            assert.ok(t.warn, 'a feedback revert shows the ⚠️ row'); assert.strictEqual(t.amt, '-0.90'); assert.strictEqual(t.orig, '-0.90'); assert.strictEqual(t.delta, '→ ⭐ 0.01', 'unchanged amount = the score as it is');
            assert.ok(/🕒 .*10.*· 👤 medlifeplus · ✏️ 0/.test(t.meta) && /Log ID L1/.test(t.metaTitle) && /medlifeplus@gmail.com/.test(t.metaTitle), 'one grey line, the long text on hover: ' + t.meta);
            assert.ok(t.h <= 330, label + ': the card is short (' + t.h + 'px; the old sheet filled the screen)'); assert.ok(!t.over, label + ': nothing overflows');
            // ↩️ undo → 0 + reason, the delta says the user gets 0.90 back
            await page.click('#ma-edit-warn button');
            const u = await page.evaluate(() => ({ amt: document.getElementById('ma-edit-amount').value, reason: document.getElementById('ma-edit-reason').value, delta: document.getElementById('ma-edit-delta').textContent, neg: document.getElementById('ma-edit-delta').classList.contains('neg') }));
            assert.deepStrictEqual([u.amt, /quiz points restored/.test(u.reason), u.delta, u.neg], ['0.00', true, '→ ⭐ 0.91', false], 'undo = amount 0, reason filled, score would become 0.91');
            // typing a more negative amount shows a red delta; ↺ restores
            await page.fill('#ma-edit-amount', '-1.5');
            const n = await page.evaluate(() => ({ delta: document.getElementById('ma-edit-delta').textContent, neg: document.getElementById('ma-edit-delta').classList.contains('neg') }));
            assert.deepStrictEqual([n.delta, n.neg], ['→ ⭐ -0.59', true]);
            await page.click('.ma-row .ma-qc[title="Back to the original amount"]');
            assert.strictEqual(await page.inputValue('#ma-edit-amount'), '-0.90', '↺ restores the original');
            await page.click('.ma-row .ma-qc[title="Set to 0 = cancel this row\'s effect"]');
            assert.strictEqual(await page.inputValue('#ma-edit-amount'), '0.00', '0 chip');
            // reason chip fills the field
            await page.click('.ma-row .ma-qc[title="Adjust to actual"]');
            assert.strictEqual(await page.inputValue('#ma-edit-reason'), 'Adjust to actual');
            // a normal manual row: no warning, kind ⚙️, no quiz pill
            await page.evaluate(() => openManualAdjustEditModal('L2'));
            const m = await page.evaluate(() => ({ warn: !document.getElementById('ma-edit-warn').hidden, kind: document.getElementById('ma-edit-kind').textContent, quizHidden: document.getElementById('ma-edit-quiz').hidden, delta: document.getElementById('ma-edit-delta').textContent }));
            assert.deepStrictEqual(m, { warn: false, kind: '⚙️ manual', quizHidden: true, delta: '→ ⭐ 0.01' }, 'a plain manual row has no warning');
            // the history <details> is collapsed and lists nothing yet
            assert.strictEqual(await page.evaluate(() => document.querySelector('#manualAdjustEditModal details.ma-hist').open), false);
            assert.strictEqual(await page.evaluate(() => document.getElementById('ma-edit-history-count').textContent), '0');
            assert.deepStrictEqual(errs, [], 'no page errors: ' + errs.join('; '));
            await page.close();
        }
        console.log('PASS: Edit Manual Adjustment lean — pills (⭐ kind 📝 quiz), ⚠️ + ↩️ undo for a feedback revert, live → ⭐ score, 0 / ↺ / reason chips, short card (≤330px) on desktop and 360px, same ids for the save path');
    } finally { await browser.close(); try { fs.unlinkSync(file); } catch (e) { /* gone */ } }
})().catch(e => { try { fs.unlinkSync(file); } catch (x) { /* ok */ } console.error(e); process.exit(1); });
