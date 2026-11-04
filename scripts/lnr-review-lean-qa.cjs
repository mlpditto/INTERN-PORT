// V102.584 (owner pick B): the Learning Note Review column in Chromium — row order, no pre-picked score (Save & Award faded + "Pick pts"),
// inline errors instead of alerts, emoji quick-feedback chips, Feature / Escalate / follow-up beside the buttons, the message count on the folded summary.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
function grabDiv(marker) {
    const start = html.indexOf(marker), re = /<div\b|<\/div>/g; let depth = 0; re.lastIndex = start;
    for (let m; (m = re.exec(html));) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) return html.slice(start, re.lastIndex); }
    throw new Error('no ' + marker);
}
function grabFn(head) {
    const start = html.indexOf(head); assert.ok(start > 0, head); let depth = 0;
    for (let i = html.indexOf('{', start); i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1); }
}
const fns = ['function syncLearningNoteReviewChips(', 'function setLearningNoteReviewScore(', 'async function _lnrCommitReview(', 'async function requestLearningNoteRevision(', 'async function saveLearningNoteReview(', 'function lnrAppendTemplate(', 'function toggleLnrFeature(', 'function toggleLnrEscalate(', 'function lnrRenderToggles(', 'function setLearningNoteStars(', 'function lnrRenderStars('].map(grabFn).join('\n');
const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><style>#learningNoteReviewModal{display:flex!important}</style>${grabDiv('<div id="learningNoteReviewModal"')}<script>window.__alerts=[];window.alert=m=>__alerts.push(m);${fns}</script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1280, 390]) {
            const p = await browser.newPage({ viewport: { width, height: 860 } }), errs = [];
            p.on('pageerror', e => errs.push(e.message));
            await p.setContent(page);
            await p.evaluate(() => { window._lnrCurrent = { id: 'n1' }; window._lnrStars = 0; syncLearningNoteReviewChips(); lnrRenderToggles(); });
            const m = '#learningNoteReviewModal';

            assert.deepEqual(await p.locator(m + ' .lnr-controls > .lnr-row > .lnr-mini').evaluateAll(e => e.map(x => x.childNodes[0].textContent.trim())), ['Pts', 'Quality', 'Comment', 'Tags'], 'score first, tags last');
            assert.equal(await p.locator(m + ' .lnr-row-tags details.lnr-taxonomy').count(), 1, 'the taxonomy stays folded in the tags row');
            assert.equal(await p.locator(m + ' details.lnr-taxonomy').evaluate(d => d.open), false);

            // nothing pre-picked: Save & Award faded, "Pick pts" shown
            assert.equal(await p.locator(m + ' .lnr-chip.active').count(), 0);
            assert.equal(await p.locator(m + ' .lnr-need').isVisible(), true);
            assert.equal(await p.locator(m + ' .lnr-save').evaluate(b => getComputedStyle(b).opacity), '0.55');
            await p.click(m + ' .lnr-save');
            assert.equal(await p.locator('#lnr-score-row.lnr-invalid').count(), 1, 'Save & Award without pts marks the row');
            assert.deepEqual(await p.evaluate(() => __alerts), [], 'no alert');
            await p.click(m + ' .lnr-chip[data-score="1.0"]');
            assert.deepEqual([await p.locator(m + ' .lnr-need').isVisible(), await p.locator('#lnr-score-row.lnr-invalid').count(), await p.locator(m + ' .lnr-save').evaluate(b => getComputedStyle(b).opacity)], [false, 0, '1'], 'a pick clears it');
            await p.fill('#lnr-score-input', '3');
            assert.equal(await p.locator(m + ' .lnr-need').isVisible(), true, 'out of range = not scored');
            await p.fill('#lnr-score-input', '0.3');
            assert.equal(await p.locator(m + ' .lnr-need').isVisible(), false, 'a custom value counts');

            // Request Revision without a comment: red box + line, cursor in the box, no alert
            await p.locator(m + ' .lnr-footer button', { hasText: 'Request Revision' }).click();
            assert.equal(await p.locator('#lnr-comment-row.lnr-invalid .lnr-err').isVisible(), true);
            assert.equal(await p.evaluate(() => document.activeElement.id), 'lnr-comment');
            assert.deepEqual(await p.evaluate(() => __alerts), []);
            await p.keyboard.type('x');
            assert.equal(await p.locator('#lnr-comment-row.lnr-invalid').count(), 0, 'typing clears it');

            // quick feedback: 7 emoji chips, the name in title / aria-label, a tap still appends the sentence
            const tpl = p.locator(m + ' .lnr-tpl-row .lnr-tpl');
            assert.equal(await tpl.count(), 7);
            assert.equal(await tpl.evaluateAll(b => b.filter(x => /[A-Za-z]/.test(x.textContent)).length), 0, 'no words on the chips');
            assert.equal(await tpl.first().getAttribute('aria-label'), 'Great structure');
            await p.fill('#lnr-comment', ''); await tpl.first().click();
            assert.equal(await p.inputValue('#lnr-comment'), 'Great structure! 👍');

            // Feature / Escalate / follow-up beside the buttons, still one at a time
            const after = m + ' .lnr-footer .lnr-after';
            assert.equal(await p.locator(after + ' #lnr-feature-toggle, ' + after + ' #lnr-escalate-toggle, ' + after + ' #lnr-followup-date').count(), 3);
            await p.click('#lnr-feature-toggle'); await p.click('#lnr-escalate-toggle');
            assert.deepEqual(await p.evaluate(() => [window._lnrFeature, window._lnrEscalate, document.getElementById('lnr-escalate-toggle').classList.contains('active')]), [false, true, true]);
            await p.fill('#lnr-followup-date', '2026-12-01'); await p.click(m + ' .lnr-fu button');
            assert.equal(await p.inputValue('#lnr-followup-date'), '', '✕ clears the date');
            assert.equal(await p.locator(after + ' .lnr-tw').first().isVisible(), width > 760, 'icons only on a phone');

            // the count is on the folded summary
            assert.equal(await p.locator(m + ' details.lnr-conversation > summary #lnr-thread-count').count(), 1);
            assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no side scroll');
            assert.deepEqual(errs, []);
            await p.close();
        }
        console.log('PASS: Learning Note Review lean B — order Pts·Quality·Comment·Tags, taxonomy folded, no pre-picked pts (faded Save + "Pick pts"), inline errors not alerts, 7 emoji feedback chips, Feature/Escalate/⏰ by the buttons (icons on a phone), count on the summary');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
