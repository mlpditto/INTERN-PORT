// V102.512 — 📖 All in the Read first label row: every question's Read first in ONE popup with a local duplicate check (no AI). The REAL admin.html
// (file://, network blocked, Firebase = Proxy; the module script's @google/generative-ai import stubbed so the Read first helpers load).
// Checks: the button sits after ✨ All with EN + TH + KO tooltips; the popup reads the editor as it is (unsaved edits); counts in the header;
// "Estetrol (E4)" / "E4 (Estetrol)" are one repeated term, a heading in bold is not a term, a verbatim line repeated across questions gets "= Qn",
// an empty Read first is shown as such; Repeated-only hides unique cards; a term chip outlines its marks; Esc closes; no page errors.
// V102.520 (owner: 'still scrolls with 10 questions' + 'edit here, not back in each question'): a card is ONE line — its bold terms as chips
// (repeated = amber + the other Qn, ≡ Qn for an identical line) — ✎ / the header opens it into a Markdown box whose every keystroke lands in the
// editor's .q-primer and re-runs the check; ⤢ Open all / ⤡ Close all; 10 questions fit a 900 px popup without scrolling; user text is never
// hidden by the EN/TH toggle (lang-no-toggle on the cards and the 🔁 chips).
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
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none !important}' });   // the guide overlay opens late offline (its fetch fails) and would intercept clicks

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
        assert.deepEqual(await b.evaluate(x => [x.previousElementSibling.textContent.trim(), x.closest('label').querySelectorAll('.q-primer-ai').length]), ['✨', 2], 'V102.524 (owner, option 1): the row is ✨ then 📖 All — two buttons');
        await page.evaluate(() => { const it = document.querySelectorAll('.quiz-q-item')[0]; it.style.display = 'block'; });
        await page.evaluate(() => document.querySelector('.quiz-q-item .q-primer-review').click());
        const ov = page.locator('#praOverlay');
        assert.equal(await ov.count(), 1, 'the popup opens');

        // header
        const sum = (await ov.locator('.pra-sum').innerText()).replace(/\s+/g, ' ');
        assert.match(sum, /^E4 sample · 4 Q · 🔤 4 · ⚠️ 1 in 3 Q · ≡ 1$/, 'header counts (compact): ' + sum);
        const cards = await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => ({ q: c.dataset.q, dup: c.classList.contains('has-dup'), pill: c.querySelector('.pra-pill').textContent.trim(), pillTitle: c.querySelector('.pra-pill').title, marks: [...c.querySelectorAll('.pra-t.dup')].map(m => m.firstChild.textContent + '|' + m.querySelector('i').textContent), eq: [...c.querySelectorAll('.pra-t.eq')].map(e => e.textContent), terms: [...c.querySelectorAll('.pra-t:not(.hint)')].length, open: c.classList.contains('open'), noToggle: c.classList.contains('lang-no-toggle'), empty: c.classList.contains('is-empty') && !c.querySelector('.pra-md'), stem: c.querySelector('.pra-stem').textContent })));
        assert.deepEqual(cards.map(c => [c.q, c.dup, c.pill, c.marks, c.eq, c.empty]), [
            ['0', true, '⚠️ 1', ['Estetrol (E4)|Q2 Q3'], [], false],
            ['1', true, '⚠️ 2', ['E4 (Estetrol)|Q1 Q3'], ['≡ Q3'], false],
            ['2', true, '⚠️ 2', ['Estetrol (E4)|Q1 Q2'], ['≡ Q2'], false],
            ['3', false, '⚪', [], [], true],
        ], 'cards: ' + JSON.stringify(cards));
        assert.equal(cards[1].pillTitle, '1 term repeated · 1 line identical', 'V102.517: the breakdown lives in the pill tooltip');
        // V102.520: every card starts closed as a one-line strip of its terms (unique ones grey, repeated amber); the empty one says what to do
        assert.deepEqual(cards.map(c => [c.terms, c.open, c.noToggle]), [[2, false, true], [3, false, true], [3, false, true], [0, false, true]], 'closed strips: ' + JSON.stringify(cards.map(c => [c.terms, c.open])));
        assert.equal((await ov.locator('.pra-card[data-q="3"] .pra-t.hint').innerText()).trim(), '✨ All or write it here');
        assert.equal(await ov.locator('.pra-card .pra-ed').evaluateAll(es => es.every(e => getComputedStyle(e).display === 'none')), true, 'no box is open');
        assert.equal(await ov.locator('.pra-terms').evaluate(t => t.classList.contains('lang-no-toggle')), true, 'the 🔁 chips carry user terms — never hidden by the EN/TH toggle');
        // V102.517: some questions still empty → a strip above the cards with ✨ All
        assert.match((await ov.locator('.pra-strip').innerText()).replace(/\s+/g, ' ').trim(), /^⚪ 1 of 4 empty ✨ All/, 'the strip counts the empty ones');
        assert.equal(await ov.locator('.pra-none').count(), 0, 'no empty state while some have a Read first');
        assert.equal(await ov.locator('.pra-chip[data-f="dup"]').isDisabled(), false, 'Repeated only is live when something repeats');
        assert.ok(!cards[0].marks.some(m => /ศัพท์สำคัญ|ความรู้พื้นฐาน/.test(m)), 'bold headings are not terms');
        assert.equal(cards[3].stem, 'Empty one?');
        const chips = await ov.locator('.pra-tchip').evaluateAll(cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
        assert.deepEqual(chips, ['Estetrol (E4) ×3Q1 Q2 Q3'], 'one repeated-term chip (the alias forms merged): ' + JSON.stringify(chips));

        // filter + term chip
        await ov.locator('.pra-chip[data-f="dup"]').evaluate(b => b.click());
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, true], 'Repeated only hides the unique / empty card');
        await ov.locator('.pra-chip[data-f="all"]').evaluate(b => b.click());
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, false]);
        await ov.locator('.pra-tchip').first().evaluate(b => b.click());
        assert.equal(await ov.locator('.pra-t.dup.on').count(), 3, 'the term chip outlines its three strip chips');
        await ov.locator('.pra-tchip').first().evaluate(b => b.click());
        assert.equal(await ov.locator('.pra-t.dup.on').count(), 0, 'and toggles off');

        // V102.520: ✎ Q3 opens the card HERE (the popup stays), its box has the focus and the question's Read first; the header toggles
        await ov.locator('.pra-card[data-q="2"] .pra-go').evaluate(b => b.click());   // the handler is what is under test; pointer geometry inside the fixed overlay is flaky headless
        assert.equal(await page.locator('#praOverlay').count(), 1, 'the popup stays open');
        let st = await page.evaluate(() => { const c = document.querySelector('#praOverlay .pra-card[data-q="2"]'), ta = c.querySelector('.pra-ta'); return { open: c.classList.contains('open'), shown: getComputedStyle(c.querySelector('.pra-ed')).display, focused: document.activeElement === ta, same: ta.value === document.querySelectorAll('.quiz-q-item')[2].querySelector('.q-primer').value, allLabel: document.querySelector('#praOverlay .pra-xa').textContent.trim() }; });
        assert.deepEqual(st, { open: true, shown: 'block', focused: true, same: true, allLabel: '⤢ Open all' }, 'open in place: ' + JSON.stringify(st));
        await ov.locator('.pra-card[data-q="2"] header').evaluate(h => h.click());
        assert.equal(await ov.locator('.pra-card[data-q="2"]').evaluate(c => c.classList.contains('open')), false, 'the header closes it again');
        // typing in the box IS editing the question: the editor's .q-primer follows at once, the check re-runs — Q3's third "Estetrol (E4)" goes, so Q1 / Q2 now point at each other only
        await ov.locator('.pra-card[data-q="2"] .pra-go').evaluate(b => b.click());
        await page.evaluate(() => { const ta = document.querySelector('#praOverlay .pra-card[data-q="2"] .pra-ta'); ta.value = ta.value.replace(/\n- \*\*Estetrol \(E4\)\*\* — said a third time/, ''); ta.dispatchEvent(new Event('input', { bubbles: true })); });
        assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[2].querySelector('.q-primer').value.includes('third time')), false, 'the Read first of that question changed with the keystroke');
        await page.waitForTimeout(600);
        st = await page.evaluate(() => ({ dirty: document.querySelector('#praOverlay .pra-card[data-q="2"]').classList.contains('dirty'), q1: [...document.querySelectorAll('#praOverlay .pra-card[data-q="0"] .pra-t.dup')].map(m => m.querySelector('i').textContent), q3: document.querySelectorAll('#praOverlay .pra-card[data-q="2"] .pra-t.dup').length, q3pill: document.querySelector('#praOverlay .pra-card[data-q="2"] .pra-pill').textContent.trim(), sum: document.querySelector('#praOverlay .pra-sum').innerText.replace(/\s+/g, ' '), chips: [...document.querySelectorAll('#praOverlay .pra-tchip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()), stillOpen: document.querySelector('#praOverlay .pra-card[data-q="2"]').classList.contains('open'), focused: document.activeElement === document.querySelector('#praOverlay .pra-card[data-q="2"] .pra-ta') }));
        assert.deepEqual(st, { dirty: true, q1: ['Q2'], q3: 0, q3pill: '⚠️ 1', sum: 'E4 sample · 4 Q · 🔤 4 · ⚠️ 1 in 3 Q · ≡ 1', chips: ['Estetrol (E4) ×2Q1 Q2'], stillOpen: true, focused: true }, 'live re-check after the edit (the open box is left alone): ' + JSON.stringify(st));
        // ⤢ Open all opens every visible card and becomes ⤡ Close all; the filter keeps it honest
        await ov.locator('.pra-xa').evaluate(b => b.click());
        assert.deepEqual(await page.evaluate(() => [[...document.querySelectorAll('#praOverlay .pra-card')].every(c => c.classList.contains('open')), document.querySelector('#praOverlay .pra-xa').textContent.trim(), document.querySelector('#praOverlay .pra-xa').getAttribute('aria-pressed')]), [true, '⤡ Close all', 'true']);
        await ov.locator('.pra-xa').evaluate(b => b.click());
        assert.deepEqual(await page.evaluate(() => [[...document.querySelectorAll('#praOverlay .pra-card')].some(c => c.classList.contains('open')), document.querySelector('#praOverlay .pra-xa').textContent.trim()]), [false, '⤢ Open all']);
        // the pager was never touched
        assert.equal(await page.evaluate(() => quizQPageIndex), 0, 'the pager stayed where it was');
        await page.evaluate(() => _praClose());
        // V102.520: 10 questions with full Read firsts fit the popup at 1200×900 without scrolling (that was the complaint)
        await page.evaluate(([P1, Q]) => { const mk = new Function('return ' + Q)(); const c = document.getElementById('quiz-questions-container'); for (let i = 0; i < 6; i++) addQuestionUI(mk('Extra question ' + (i + 1) + '?', P1 + '\n- **Extra term ' + i + '** — only here')); _qPrimerReviewAll(); }, [P1, Q.toString()]);
        { const m = await page.locator('#praOverlay .pra-body').evaluate(b => ({ cards: b.querySelectorAll('.pra-card').length, scroll: b.scrollHeight, client: b.clientHeight })); assert.equal(m.cards, 10); assert.ok(m.scroll <= m.client + 1, '10 collapsed cards need no scrolling: ' + JSON.stringify(m)); }
        await page.evaluate(() => { _praClose(); [...document.querySelectorAll('.quiz-q-item')].slice(4).forEach(it => it.remove()); });

        // V102.517: a card header never pushes the pill / ✎ out — a very long stem gets the ellipsis, at 390 px too
        await page.setViewportSize({ width: 390, height: 800 });
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item')[0].querySelector('.q-text').value = 'A very long question stem that keeps going and going about combined oral contraceptives and their hepatic effects so that it certainly cannot fit in one line of the card header'; _qPrimerReviewAll(); });
        { const g = await page.locator('#praOverlay .pra-card[data-q="0"]').evaluate(c => { const r = c.getBoundingClientRect(), go = c.querySelector('.pra-go').getBoundingClientRect(), pill = c.querySelector('.pra-pill').getBoundingClientRect(), stem = c.querySelector('.pra-stem'); return { fits: go.right <= r.right + 0.5 && pill.width > 10 && go.width > 10, clipped: stem.scrollWidth > stem.clientWidth }; });
          assert.equal(g.fits, true, 'pill + ✎ stay inside the card at 390 px'); assert.equal(g.clipped, true, 'the long stem is the one that gives way'); }
        await page.evaluate(() => _praClose()); await page.setViewportSize({ width: 1200, height: 900 });
        // V102.517: no Read first anywhere → one message + ✨ All (which runs the first row's ✨ All) instead of empty cards
        await page.evaluate(() => { document.querySelectorAll('.quiz-q-item .q-primer').forEach(t => { t.value = ''; }); window.__all = null; window._qPrimerDraftAll = b => { window.__all = b.className; }; _qPrimerReviewAll(); });
        assert.equal(await page.locator('#praOverlay .pra-card').count(), 0, 'no cards');
        // V102.539: ✨ All's model can be picked in the popup, and that is the pick on every question's row
        {
            const rail = page.locator('#praOverlay .pra-none .pra-model');
            assert.equal(await rail.count(), 1, 'the model rail is in the empty state');
            assert.ok(await page.locator('#praOverlay .pra-model .text-ai-chips button').count() > 0, 'with model chips');
            const next = await page.evaluate(() => { const cur = document.querySelector('.q-primer-model').value; const b = [...document.querySelectorAll('#praOverlay .pra-model .text-ai-chips button')].find(x => x.dataset.value !== cur); window._praPickModel(b.dataset.value); return b.dataset.value; });
            const after = await page.evaluate(() => ({ rows: [...new Set([...document.querySelectorAll('#quizManageModal .q-primer-model')].map(i => i.value))], stored: localStorage.getItem('ai_primer_model'), rail: document.getElementById('pra-model-pick').value }));
            assert.deepEqual(after, { rows: [next], stored: next, rail: next }, 'one pick everywhere: ' + JSON.stringify(after));
        }
        assert.match((await page.locator('#praOverlay .pra-sum').innerText()).replace(/\s+/g, ' '), /4 Q · ⚪ none yet$/, 'the header says so instead of zeros');
        assert.equal(await page.locator('#praOverlay .pra-chip[data-f="dup"]').isDisabled(), true, 'Repeated only is disabled');
        assert.equal((await page.locator('#praOverlay .pra-none-t').innerText()).trim(), '📖 No Read first yet');
        assert.equal((await page.locator('#praOverlay .pra-none .pra-all').innerText()).trim(), '✨ All · 4');
        await page.locator('#praOverlay .pra-none .pra-all').evaluate(b => b.click());
        assert.equal(await page.locator('#praOverlay').count(), 1, 'V102.524: the popup stays open'); assert.equal(await page.evaluate(() => window.__all), 'pra-all', 'and ✨ All runs on the popup\'s own button');
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
        console.log('PASS: 📖 All Read first popup — V102.520 one-line term strips, ✎ opens the card in place with a live box that edits the question, re-check while typing, Open all / Close all, 10 questions without scrolling, lang-no-toggle; plus: after ✨ All with EN/TH/KO tooltips, reads the editor as it is, header counts, alias-aware repeated terms (headings excluded) with Qn marks, identical lines ≡ Qn, short pills with the breakdown on hover, strip for missing ones, all-empty state with ✨ All run in place, header never overflows, Repeated-only filter, term chip outline, Esc closes');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
