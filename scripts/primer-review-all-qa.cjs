// V102.512 — 📖 All in the Read first label row: every question's Read first in ONE popup with a local duplicate check (no AI). The REAL admin.html
// (file://, network blocked, Firebase = Proxy; the module script's @google/generative-ai import stubbed so the Read first helpers load).
// Checks: the button sits after ✨ All with EN + TH + KO tooltips; the popup reads the editor as it is (unsaved edits); counts in the header;
// "Estetrol (E4)" / "E4 (Estetrol)" are one repeated term, a heading in bold is not a term, a verbatim line repeated across questions gets "= Qn",
// an empty Read first is shown as such; Repeated-only hides unique cards; a term chip outlines its marks; ✎ Qn closes, moves the pager to that
// question and focuses its Read first box; Esc closes; no page errors.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/class="q-primer-ai q-primer-review" onclick="_qPrimerReviewAll\(\)"[^>]*data-th-title="[^"]*Read first[^"]*"[^>]*data-kr-title="[^"]*Read first[^"]*"[^>]*aria-label="Review all Read first">📖 All<\/button>/.test(admin), '📖 All button with EN / TH / KO tooltips');

const Q = (q, primer) => ({ q, type: 'choice', options: ['a', 'b'], correct: [0], primer });
const P1 = '**ความรู้พื้นฐาน**\nEstetrol is a native estrogen.\n\n**ศัพท์สำคัญ**\n- **Estetrol (E4)** — a native estrogen made by the fetal liver\n- **SHBG** — sex hormone-binding globulin';
const P2 = '**ศัพท์สำคัญ**\n- **E4 (Estetrol)** — natural estrogen with selective tissue activity\n- **VTE** — venous thromboembolism\nThis exact sentence appears in two questions for the check.';
const P3 = '**ศัพท์สำคัญ**\n- **HPO axis** — hypothalamic-pituitary-ovarian axis\nThis exact sentence appears in two questions for the check.';

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && typeof _qPrimerReviewAll === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);

        await page.evaluate(([P1, P2, P3, Q]) => {
            window.showToast = () => {};
            document.getElementById('quizManageModal').style.display = 'block';   // the editor is open in real use; a box inside a hidden modal cannot take focus
            const dash = document.getElementById('dashboard-container'); if (dash) dash.style.display = 'block';   // signed-in page: the dashboard (which holds the editor) is visible
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            const mk = new Function('return ' + Q)();
            [mk('Which estrogen is E4?', P1), mk('A 52-year-old woman using a twice-weekly transdermal estradiol patch for menopausal symptoms reports that the patch keeps lifting at the edges after showering and asks whether she should apply a second patch to make up for it — which counselling point is MOST appropriate and why does it matter for her VTE risk with E4/DRSP?', P2), mk('How does a COC stop ovulation?', P3), mk('Empty one?', '')].forEach(d => addQuestionUI(d));
            // an unsaved edit must be read too
            document.querySelectorAll('.quiz-q-item')[2].querySelector('.q-primer').value += '\n- **Estetrol (E4)** — said a third time';
            document.getElementById('quiz-title').value = 'E4 sample';
        }, [P1, P2, P3, Q.toString()]);

        // the button
        const b = page.locator('.quiz-q-item .q-primer-review').first();
        assert.equal(await b.evaluate(x => x.previousElementSibling.classList.contains('q-primer-all')), true, 'sits right after ✨ All');
        await page.evaluate(() => { const it = document.querySelectorAll('.quiz-q-item')[0]; it.style.display = 'block'; });
        await page.evaluate(() => document.querySelector('.quiz-q-item .q-primer-review').click());
        const ov = page.locator('#praOverlay');
        assert.equal(await ov.count(), 1, 'the popup opens');

        // header
        const sum = (await ov.locator('.pra-sum').innerText()).replace(/\s+/g, ' ');
        assert.match(sum, /^E4 sample · 4 Q · 🔤 4 · ⚠️ 1 in 3 Q · ≡ 1$/, 'header counts (compact): ' + sum);
        const cards = await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => ({ q: c.dataset.q, dup: c.classList.contains('has-dup'), pill: c.querySelector('.pra-pill').textContent.trim(), pillTitle: c.querySelector('.pra-pill').title, marks: [...c.querySelectorAll('mark.pra-dup')].map(m => m.querySelector('strong').textContent + '|' + m.querySelector('i').textContent), eq: [...c.querySelectorAll('.pra-eq')].map(e => e.textContent), empty: c.classList.contains('is-empty') && !c.querySelector('.pra-md'), stem: c.querySelector('.pra-stem').textContent })));
        assert.deepEqual(cards.map(c => [c.q, c.dup, c.pill, c.marks, c.eq, c.empty]), [
            ['0', true, '⚠️ 1', ['Estetrol (E4)|Q2 Q3'], [], false],
            ['1', true, '⚠️ 2', ['E4 (Estetrol)|Q1 Q3'], ['= Q3'], false],
            ['2', true, '⚠️ 2', ['Estetrol (E4)|Q1 Q2'], ['= Q2'], false],
            ['3', false, '⚪', [], [], true],
        ], 'cards: ' + JSON.stringify(cards));
        assert.equal(cards[1].pillTitle, '1 term repeated · 1 line identical', 'V102.517: the breakdown lives in the pill tooltip');
        // V102.517: some questions still empty → a strip above the cards with ✨ All
        assert.equal((await ov.locator('.pra-strip').innerText()).replace(/\s+/g, ' ').trim(), '⚪ 1 of 4 empty ✨ All', 'the strip counts the empty ones');
        assert.equal(await ov.locator('.pra-none').count(), 0, 'no empty state while some have a Read first');
        assert.equal(await ov.locator('.pra-chip[data-f="dup"]').isDisabled(), false, 'Repeated only is live when something repeats');
        assert.ok(!cards[0].marks.some(m => /ศัพท์สำคัญ|ความรู้พื้นฐาน/.test(m)), 'bold headings are not terms');
        assert.equal(cards[3].stem, 'Empty one?');
        const chips = await ov.locator('.pra-tchip').evaluateAll(cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(chips, ['Estetrol (E4) ×3Q1 Q2 Q3'], 'one repeated-term chip (the alias forms merged): ' + JSON.stringify(chips));

        // filter + term chip
        await ov.locator('.pra-chip[data-f="dup"]').click();
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, true], 'Repeated only hides the unique / empty card');
        await ov.locator('.pra-chip[data-f="all"]').click();
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, false]);
        await ov.locator('.pra-tchip').first().evaluate(b => b.click());
        assert.equal(await ov.locator('mark.pra-dup.on').count(), 3, 'the term chip outlines its three marks');
        await ov.locator('.pra-tchip').first().evaluate(b => b.click());
        assert.equal(await ov.locator('mark.pra-dup.on').count(), 0, 'and toggles off');

        // ✎ Q3 → the pager shows Q3, the box is focused, the popup is gone
        await ov.locator('.pra-card[data-q="2"] .pra-go').evaluate(b => b.click());   // the handler is what is under test; pointer geometry inside the fixed overlay is flaky headless
        assert.equal(await page.locator('#praOverlay').count(), 0, 'closed');
        const after = await page.evaluate(() => ({ idx: quizQPageIndex, shown: [...document.querySelectorAll('.quiz-q-item')].map(it => it.style.display !== 'none'), focused: document.activeElement && document.activeElement.classList.contains('q-primer') && document.activeElement.closest('.quiz-q-item') === document.querySelectorAll('.quiz-q-item')[2] }));
        assert.equal(after.idx, 2); assert.deepEqual(after.shown, [false, false, true, false], 'only Q3 is on the page'); assert.equal(after.focused, true, 'its Read first box has the focus');

        // V102.517: a card header never pushes the pill / ✎ out — a very long stem gets the ellipsis, at 390 px too
        await page.setViewportSize({ width: 390, height: 800 });
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item')[0].querySelector('.q-text').value = 'A very long question stem that keeps going and going about combined oral contraceptives and their hepatic effects so that it certainly cannot fit in one line of the card header'; _qPrimerReviewAll(); });
        { const g = await page.locator('#praOverlay .pra-card[data-q="0"]').evaluate(c => { const r = c.getBoundingClientRect(), go = c.querySelector('.pra-go').getBoundingClientRect(), pill = c.querySelector('.pra-pill').getBoundingClientRect(), stem = c.querySelector('.pra-stem'); return { fits: go.right <= r.right + 0.5 && pill.width > 10 && go.width > 10, clipped: stem.scrollWidth > stem.clientWidth }; });
          assert.equal(g.fits, true, 'pill + ✎ stay inside the card at 390 px'); assert.equal(g.clipped, true, 'the long stem is the one that gives way'); }
        await page.evaluate(() => _praClose()); await page.setViewportSize({ width: 1200, height: 900 });
        // V102.517: no Read first anywhere → one message + ✨ All (which runs the first row's ✨ All) instead of empty cards
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item .q-primer').forEach(t => { t.value = ''; }); window.__all = null; window._qPrimerDraftAll = b => { window.__all = b.className; }; _qPrimerReviewAll(); });
        assert.equal(await page.locator('#praOverlay .pra-card').count(), 0, 'no cards');
        assert.match((await page.locator('#praOverlay .pra-sum').innerText()).replace(/\s+/g, ' '), /4 Q · ⚪ none yet$/, 'the header says so instead of zeros');
        assert.equal(await page.locator('#praOverlay .pra-chip[data-f="dup"]').isDisabled(), true, 'Repeated only is disabled');
        assert.equal((await page.locator('#praOverlay .pra-none-t').innerText()).trim(), '📖 No Read first yet');
        assert.equal((await page.locator('#praOverlay .pra-none .pra-all').innerText()).trim(), '✨ All · 4');
        await page.locator('#praOverlay .pra-none .pra-all').evaluate(b => b.click());
        assert.equal(await page.locator('#praOverlay').count(), 0, 'the popup closes'); assert.match(await page.evaluate(() => window.__all), /q-primer-all/, 'and the first row\'s ✨ All runs');
        await page.evaluate(() => { _qPrimerReviewAll(); }); await page.locator('#praOverlay .pra-none .pra-chip').evaluate(b => b.click()); assert.equal(await page.locator('#praOverlay').count(), 0, '✎ Write by hand closes');
        // V102.517 compact: ✎ is icon-only with the question in its label; two columns at ≥ 900 px, one below
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item .q-primer')[0].value = '**A** x'; _qPrimerReviewAll(); });
        assert.deepEqual(await page.locator('#praOverlay .pra-card[data-q="0"] .pra-go').evaluate(b => [b.textContent.trim(), b.getAttribute('aria-label')]), ['✎', 'Edit Q1'], 'icon-only ✎ with an accessible name');
        assert.equal(await page.locator('#praOverlay .pra-body').evaluate(b => getComputedStyle(b).gridTemplateColumns.split(' ').length), 2, 'two columns on a wide popup');
        await page.evaluate(() => _praClose());
        // Esc closes
        await page.evaluate(() => _qPrimerReviewAll()); assert.equal(await page.locator('#praOverlay').count(), 1);
        await page.keyboard.press('Escape'); assert.equal(await page.locator('#praOverlay').count(), 0, 'Esc closes');

        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: 📖 All Read first popup — after ✨ All with EN/TH/KO tooltips, reads the editor as it is, header counts, alias-aware repeated terms (headings excluded) with Qn marks, identical lines = Qn, short pills with the breakdown on hover, strip for missing ones, all-empty state with ✨ All, header never overflows, Repeated-only filter, term chip outline, ✎ Qn jumps + focuses, Esc closes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
