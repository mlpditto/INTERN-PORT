// V102.657 (owner pick C, mockup-curate-steps) — ✦ AI Curate is three steps: ① Set → ② Review → ③ Save, one on screen at a time.
// A result opens on Review with the tools card folded into the ① chip; Save shows what will happen and ONE of three ways to save.
// V102.665: at ≥ 1,300 px the Review step is two panes — the list left, the picked question beside its twin (or alone) right.
// The REAL quiz-curate.js / css; 20 questions, a saved run that removes 10 (no AI call); Firestore is a recorder. SHOT=<dir> writes PNGs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const N = 20, REMOVE = { 1: 11, 2: 15, 3: 20, 6: 19, 7: 16, 9: 17, 10: 18, 12: 4, 13: 11, 14: 5 };
const stem = i => 'Clinical question ' + i + ' about topic ' + i;
const PROPOSAL = Array.from({ length: N }, (_, i) => { const id = i + 1, twin = REMOVE[id]; return { id, keep: !twin, topic: twin ? 'Topic ' + twin : 'Topic ' + id, reasonType: twin ? 'overlap' : 'coverage',
    related: twin ? [{ id: twin, shared: 'Same objective.', sharedTh: 'วัตถุประสงค์เดียวกัน', difference: 'Q' + twin + ' is clearer.', differenceTh: 'ชัดกว่า', preference: 'Keep Q' + twin + '.', preferenceTh: 'เก็บ', evidence: [{ id, quote: 'Clinical question ' + id }, { id: twin, quote: 'Clinical question ' + twin }] }] : [],
    reason: twin ? 'Duplicate of Q' + twin + '.' : 'Covers a distinct point.', reasonTh: 'เหตุผล', detail: 'Detail.', detailTh: 'รายละเอียด', impact: 'None.', impactTh: 'ไม่มี' }; });
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

async function open(browser, { width = 1100, history = true, quizId = 'source-quiz' } = {}) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: SHOT ? 1.5 : 1 })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { errors.push('native dialog: ' + d.message()); d.dismiss(); });
    await page.route('https://curate.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
    await page.route(/assets\/logos\//, r => { const f = path.join('public', new URL(r.request().url()).pathname); return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: 'image/svg+xml' }) : r.abort(); });
    await page.goto('https://curate.test/');
    const html = fs.readFileSync('public/admin.html', 'utf8');
    await page.setContent('<meta charset="utf-8">' + [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n') + '<input id="edit-quiz-id" value="' + quizId + '"><input id="ai-analyzer-model-val" value="gemini-3.8-flash">');
    for (const f of ['quiz-curate.css', 'text-ai-chips.css', 'audit-toolbar.css']) await page.addStyleTag({ path: path.join('public', f) });
    await page.addScriptTag({ path: 'public/ai-model-ui.js' });
    const a = html.indexOf('window.browseAuditProvider = function'), b = html.indexOf('window.auditModelControlsHtml = function');
    await page.addScriptTag({ content: html.slice(a, b) });
    await page.evaluate(([N, PROPOSAL, history, stems]) => {
        window.fixture = { title: 'Steps quiz', targetGroup: 'Interns', totalPoints: 1, isPoll: false, quizType: 'mcq', caseContent: '', materials: [], blueprint: {}, startTime: '', deadline: '',
            questions: stems.map((q, i) => ({ q, content: '', type: 'choice', options: ['A', 'B', 'C', 'D'], correct: [i % 4], timer: 60, tags: '', explanation: 'Because ' + (i + 1) })) };
        for (let i = 0; i < N; i++) { const el = document.createElement('div'); el.className = 'quiz-q-item'; el.dataset.id = i + 1; el.hidden = true; document.body.append(el); }
        window.getQuizFormData = () => structuredClone(fixture);
        window.shouldMarkQuestionMissingAnswer = () => false; window.showToast = () => {}; window.safeJsonParse = JSON.parse;
        window.ensureAuthForQuizWrite = async () => true; window.calls = 0; window.callUniversalAI = () => { calls++; return new Promise(() => {}); };
        window.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } }; window.auth = { currentUser: { email: 'qa-admin@example.com' } };
        window.writes = []; let n = 0;
        window.db = { collection: () => ({ doc: id => ({ id: id || 'copy-' + ++n, get: async () => ({ exists: true, data: () => structuredClone(fixture) }), set: async data => { writes.push({ id: id || 'copy-' + n, q: (data.questions || []).length }); } }) }) };
        const run = { id: 'r1', key: 'K10', model: 'gemini-3.8-flash', createdAt: Date.now() - 600000, elapsedMs: 144000, count: N, target: 10, mode: 'balanced', pins: [], instructions: '', proposal: PROPOSAL };
        window.curateHistory = { key: async v => 'K' + v.target, load: async () => history ? [run] : [], save: async () => {} };
        try { localStorage.setItem('quizCurateRailFolded', '0'); } catch (_) {}
    }, [N, PROPOSAL, history, Array.from({ length: N }, (_, i) => stem(i + 1))]);
    await page.addScriptTag({ path: 'public/quiz-curate.js' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.evaluate(() => openQuizCurate());
    await page.waitForTimeout(500);
    return { page, errors };
}
const view = page => page.evaluate(() => {
    const d = document.getElementById('quiz-curate-dialog'), vis = sel => { const e = d.querySelector(sel); return !!e && e.getClientRects().length > 0; };
    const steps = [...d.querySelectorAll('[data-curate-step]')].map(b => ({ k: b.dataset.curateStep, cur: b.getAttribute('aria-current') === 'step', off: b.disabled, done: b.classList.contains('done'), n: b.querySelector('i').textContent, small: b.querySelector('small').textContent, title: b.title }));
    return { step: d.dataset.step, save: d.dataset.save, steps, card: vis('.curate-card'), review: vis('.curate-review'), panel: vis('#curate-savepanel'), cmp: vis('#curate-comparison'),
        btn: ['#curate-save', '#curate-apply', '#curate-split', '.curate-backup-option', '#curate-prev', '#curate-next'].filter(vis).join(' '), next: (d.querySelector('#curate-next') || {}).textContent, nextOff: d.querySelector('#curate-next').disabled, nextTitle: d.querySelector('#curate-next').title,
        prev: d.querySelector('#curate-prev').textContent, h: d.scrollHeight, overflowX: d.scrollWidth > d.clientWidth + 1, focus: document.activeElement && (document.activeElement.dataset.curateStep || document.activeElement.id), feedback: d.querySelector('#curate-feedback').textContent };
});
const shot = async (page, name) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); const d = page.locator('#quiz-curate-dialog'); await d.evaluate(e => { e.style.maxHeight = 'none'; }); const b = await d.boundingBox(); await page.setViewportSize({ width: page.viewportSize().width, height: Math.ceil(b.height) + 60 }); await d.screenshot({ path: path.join(SHOT, name + '.png') }); await d.evaluate(e => { e.style.maxHeight = ''; }); await page.setViewportSize({ width: page.viewportSize().width, height: 900 }); };
const click = (page, sel) => page.locator('#quiz-curate-dialog ' + sel).first().click();

(async () => {
    const browser = await chromium.launch();
    try {
        console.log('no result yet → ① Set');
        let { page, errors } = await open(browser, { history: false });
        let v = await view(page);
        ok(v.step === 'set' && v.steps[0].cur && v.steps[1].off && v.steps[2].off, 'opens on ① Set; ② and ③ are closed until there is a result');
        ok(v.card && v.review && !v.panel && v.btn === '', 'tools + the question list (to pin must-keeps); no save buttons, no Next: [' + v.btn + ']');
        ok(/Suggest/.test(v.steps[1].title) && v.steps.map(s => s.n).join('') === '123', 'the closed steps say why; numbered 1 2 3');
        await shot(page, 'steps-1-set');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        await page.context().close();

        console.log('a result → ② Review');
        ({ page, errors } = await open(browser));
        v = await view(page);
        ok(v.step === 'review' && v.steps[1].cur && v.steps[0].done && v.steps[0].n === '✓', 'a saved result opens on ② Review; ① is ticked');
        ok(!v.card && v.review && !v.panel, 'the tools card is folded away, the list stays');
        ok(/Flash 3\.8 · 20 → 10 · ⚖/.test(v.steps[0].small) && v.steps[1].small === '10 to remove', 'the ① chip carries the settings, ② the count: ' + v.steps[0].small + ' | ' + v.steps[1].small);
        ok(v.btn === '#curate-prev #curate-next' && v.next === 'Save ▸' && !v.nextOff && v.prev === '◂ Set', 'footer = ◂ Set · status · Save ▸ (the three save buttons are not here)');
        ok(await page.evaluate(() => calls) === 0, 'no AI call');
        const hReview = v.h;
        // V102.660: one line per question, ▾ opens one in place
        const rowsNow = () => page.evaluate(() => { const rs = [...document.querySelectorAll('#curate-rows .curate-question')]; return { n: rs.length, compact: rs.filter(r => r.classList.contains('compact')).length, open: rs.filter(r => r.classList.contains('open')).map(r => r.dataset.questionId).join(), maxH: Math.max(...rs.filter(r => r.classList.contains('compact')).map(r => Math.round(r.getBoundingClientRect().height))), twin: (rs[rs.length - 1].querySelector('.curate-compare') || {}).dataset ? getComputedStyle(rs[rs.length - 1].querySelector('.curate-compare'), '::after').content : '', choices: !!rs[rs.length - 1].querySelector('.curate-source-controls') && rs[rs.length - 1].querySelector('.curate-source-controls').getClientRects().length > 0, pin: rs[rs.length - 1].querySelector('.curate-pin').getClientRects().length > 0, move: rs[rs.length - 1].querySelector('.curate-move').textContent }; });
        let rw = await rowsNow();
        ok(rw.n === 10 && rw.compact === 10 && rw.maxH <= 48 && hReview <= 900, 'ten removals on ten lines: the Review step is ' + hReview + ' px (it was about 1,600)');
        ok(/↔ Q11/.test(rw.twin) && rw.pin && rw.move === 'Keep' && !rw.choices, 'a line keeps ↔ twin · Keep · 📌; Choices / Details wait inside');
        await shot(page, 'steps-2-review');
        await click(page, '.curate-question[data-question-id="2"] .curate-row-toggle'); rw = await rowsNow();
        ok(rw.open === '2' && rw.compact === 9 && await page.locator('#quiz-curate-dialog .curate-question.open .curate-source-controls').isVisible(), '▾ opens Q2 in place with its Choices / copy row');
        await shot(page, 'steps-2-review-open');
        await page.locator('#quiz-curate-dialog .curate-question[data-question-id="3"] .curate-stem').click(); rw = await rowsNow();
        ok(rw.open === '3', 'a click on another line opens it and folds the first (one open at a time)');
        await click(page, '.curate-question.open .curate-row-toggle'); rw = await rowsNow();
        ok(rw.open === '' && rw.compact === 10 && await page.evaluate(() => document.activeElement.classList.contains('curate-row-toggle')), '▴ folds it; focus stays on its ▾');
        await click(page, '[data-curate-step="set"]'); v = await view(page);
        ok(v.step === 'set' && v.card && v.h > hReview + 60 && v.focus === 'set' && v.next === 'Review ▸', '① Set brings the tools back (' + v.h + ' px vs ' + hReview + ' on Review); focus follows');
        await click(page, '#curate-next'); v = await view(page);
        ok(v.step === 'review', 'Review ▸ returns');

        console.log('③ Save');
        await click(page, '#curate-next'); v = await view(page);
        ok(v.step === 'save' && v.panel && !v.review && !v.card && v.steps[2].cur && v.steps[1].done, '③ Save: only the save panel');
        const sum = await page.evaluate(() => ({ head: document.querySelector('#curate-save-sum div').textContent, gone: [...document.querySelectorAll('.curate-save-gone span')].map(s => s.textContent).join(' '), gap: (document.querySelector('.curate-save-gap') || {}).textContent || '',
            cards: [...document.querySelectorAll('button[data-save]')].map(b => ({ m: b.dataset.save, on: b.getAttribute('aria-pressed'), t: b.querySelector('b').textContent, tag: b.querySelector('em').textContent, off: b.disabled })) }));
        ok(sum.head === '20 → 10 questions · total points unchanged' && sum.gone === 'Q1 Q2 Q3 Q6 Q7 Q9 Q10 Q12 Q13 Q14', 'what will happen: ' + sum.head + ' · ' + sum.gone);
        ok(sum.cards.map(c => c.t).join(' | ') === 'Save as new quiz | Remove 10 from original | Split into two quizzes' && sum.cards.map(c => c.on).join() === 'true,false,false', 'three ways, the one that leaves the original untouched is chosen');
        ok(sum.cards[0].tag === 'original untouched' && sum.cards[1].tag === 'changes the original' && sum.cards[2].tag === 'changes the original', 'each card says what it does to the original');
        ok(v.btn === '#curate-save #curate-prev' && v.prev === '◂ Review', 'ONE action button: Save as new quiz');
        ok(v.h < hReview, 'Save is shorter than Review (' + v.h + ' vs ' + hReview + ' px)');
        await shot(page, 'steps-3-save');
        await click(page, '[data-save="remove"]'); v = await view(page);
        ok(v.save === 'remove' && v.btn === '#curate-apply .curate-backup-option #curate-prev', 'Remove → its button + the Backup tick: [' + v.btn + ']');
        ok(await page.locator('#curate-apply').innerText() === 'Remove 10 from original' && await page.locator('#curate-create-backup').isChecked(), 'the button names the count; Backup is ticked');
        await click(page, '[data-save="split"]'); v = await view(page);
        ok(v.save === 'split' && v.btn === '#curate-split #curate-prev', 'Split → its button only');
        await click(page, '#curate-prev'); v = await view(page);
        ok(v.step === 'review' && v.focus === 'review', '◂ Review goes back');

        console.log('the selection must match the target before ③');
        await click(page, '.curate-question[data-question-id="1"] .curate-move'); v = await view(page);   // V102.679: Q1 is now the LAST line of Remove
        ok(v.steps[2].off && v.nextOff && /11 selected · target 10/.test(v.nextTitle) && /11 selected · target 10/.test(v.feedback), '11 kept for a target of 10 → ③ is closed and says why');
        await click(page, '[data-view="keep"]'); await page.locator('#quiz-curate-dialog .curate-question[data-question-id="1"] .curate-move').click(); v = await view(page);
        ok(!v.steps[2].off && !v.nextOff, 'back to 10 → ③ opens again');
        await click(page, '[data-view="remove"]'); await click(page, '.curate-compare'); v = await view(page);
        ok(v.cmp && v.step === 'review', 'Compare opens inside ② Review');
        await click(page, '[data-curate-step="save"]'); v = await view(page);
        ok(v.step === 'save' && !v.cmp && v.panel, 'going to ③ closes Compare');

        console.log('saving');
        await click(page, '[data-save="new"]'); await click(page, '#curate-save');
        await page.waitForFunction(() => writes.length > 0);
        const w = await page.evaluate(() => writes);
        ok(w.length === 1 && w[0].q === 10, 'Save as new quiz writes ONE new quiz with the 10 kept questions');
        await page.waitForFunction(() => document.getElementById('curate-save').textContent === 'Saved');
        v = await view(page);
        ok(v.steps.every(s => s.off) && v.step === 'save', 'after saving the steps are locked on ③');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        await page.context().close();

        console.log('a changed setting');
        ({ page, errors } = await open(browser));
        await click(page, '[data-curate-step="set"]'); await page.locator('#curate-target').fill('9'); v = await view(page);
        ok(v.step === 'set' && !v.steps[1].off && v.steps[2].off && /Suggest/.test(v.steps[2].title), 'Keep changed → ③ closed until Suggest runs again; ② still shows the old result');
        await page.context().close();

        console.log('wide window: list left, detail right');
        ({ page, errors } = await open(browser, { width: 1440 }));
        const pane = () => page.evaluate(() => {
            const d = document.getElementById('quiz-curate-dialog'), rv = d.querySelector('.curate-review'), cmp = d.querySelector('#curate-comparison'), r = e => e.getBoundingClientRect(), vis = e => !!e && e.getClientRects().length > 0;
            const sel = d.querySelector('.curate-question.sel'), head = cmp.querySelector('.curate-pane-head');
            return { two: d.classList.contains('two'), side: vis(rv) && vis(cmp) && r(rv).right <= r(cmp).left + 1 && Math.abs(r(rv).top - r(cmp).top) < 4, listW: Math.round(r(rv).width), sel: sel ? sel.dataset.questionId : null, rows: d.querySelectorAll('#curate-rows .curate-question').length,
                pair: (cmp.querySelector('.curate-cmp-head h3') || {}).textContent || '', cards: cmp.querySelectorAll('.curate-compare-card').length, solo: !!cmp.querySelector('.curate-solo'), back: vis(cmp.querySelector('.curate-back')),
                head: head ? head.querySelector('b').textContent : '', why: head ? head.querySelector('.curate-pane-why').textContent : '', move: head ? head.querySelector('.curate-pane-move').textContent : '', moveOff: head ? head.querySelector('.curate-pane-move').disabled : null, pin: head ? head.querySelector('.curate-pane-pin').getAttribute('aria-pressed') : null,
                reasonInRow: [...d.querySelectorAll('.curate-question.compact .curate-reason > div')].some(vis), toggles: [...d.querySelectorAll('.curate-row-toggle')].some(e => r(e).width > 1), h: d.scrollHeight, fits: d.scrollHeight <= d.clientHeight + 1, overflowX: d.scrollWidth > d.clientWidth + 1, open: d.open,
                tabs: [...d.querySelectorAll('[data-view]')].map(b => b.textContent).join(' | '), feedback: d.querySelector('#curate-feedback').textContent };
        });
        // V102.679 (owner): the Remove list runs last first and the LAST removal opens first; the checks below then pick Q1 by hand
        const order = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#curate-rows .curate-question')].map(r => +r.dataset.questionId), sel: +(document.querySelector('#curate-rows .sel') || {}).dataset?.questionId }));
        ok(order.ids.every((id, i) => !i || id < order.ids[i - 1]) && order.sel === order.ids[0], 'Remove runs last → first and the last one opens: ' + order.ids.join(' ') + ' · sel ' + order.sel);
        await page.locator('#curate-rows .curate-question[data-question-id="1"]').click();
        let pn = await pane();
        ok(pn.two && pn.side && pn.listW <= 380 && !pn.overflowX, 'at 1,440 px the Review step is two panes: the list (' + pn.listW + ' px) and the detail beside it');
        ok(pn.sel === '1' && pn.pair === 'Q1 ↔ Q11' && pn.cards === 2 && !pn.back, 'Q1 picked → shown beside its twin (no ← back: it is the page itself)');
        ok(pn.head === 'Q1 → Remove' && /Duplicate of Q11\./.test(pn.why) && pn.move === 'Keep' && pn.pin === 'false', 'first line of the detail: verdict · reason · Keep · 📌');
        ok(!pn.reasonInRow && !pn.toggles && pn.rows === 10, 'the list is names only — the reason and ▾ moved to the right');
        await shot(page, 'steps-2-review-pane');
        ok(pn.fits, 'nothing to scroll: ' + pn.h + ' px in a 810 px window');
        await page.locator('#quiz-curate-dialog .curate-question[data-question-id="3"] .curate-stem').click(); pn = await pane();
        ok(pn.sel === '3' && pn.pair === 'Q3 ↔ Q20', 'a click on a line shows that question: ' + pn.pair);
        await click(page, '.curate-question[data-question-id="6"] .curate-compare'); pn = await pane();
        ok(pn.sel === '6' && pn.pair === 'Q6 ↔ Q19', 'so does its ↔ chip');
        await click(page, '.curate-pane-move'); pn = await pane();
        ok(pn.tabs === 'Keep · 11 | Remove · 9' && pn.sel === '3' && /11 selected · target 10/.test(pn.feedback), 'Keep in the detail moves Q6 to Keep; the next removal down the list (Q3) is picked; the footer says 11 for a target of 10');
        await click(page, '[data-view="keep"]'); pn = await pane();
        ok(pn.sel === '4' && pn.solo && pn.cards === 1 && pn.pair === '' && pn.head === 'Q4 → Keep', 'Keep tab: a question with no twin is shown alone, opened');
        await page.locator('#quiz-curate-dialog .curate-question[data-question-id="6"] .curate-stem').click(); await click(page, '.curate-pane-move'); pn = await pane();
        ok(pn.tabs === 'Keep · 10 | Remove · 10', 'Remove in the detail puts Q6 back');
        await click(page, '.curate-pane-pin'); pn = await pane();
        ok(pn.pin === 'true' && pn.moveOff === true && /1 pinned/.test(await page.locator('#curate-coverage').innerText()), '📌 in the detail pins the question (Remove is then off)');
        await click(page, '.curate-pane-pin');
        await click(page, '#curate-next'); pn = await pane();
        ok(!pn.two && !pn.side, '③ Save is one pane again');
        await click(page, '#curate-prev');
        await page.setViewportSize({ width: 1100, height: 900 }); await page.waitForTimeout(250); pn = await pane();
        ok(!pn.two && pn.cards === 0 && pn.reasonInRow && pn.toggles, 'narrower than 1,300 px → the one-line rows with ▾ (part 2a), no pane');
        await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(250); pn = await pane();
        ok(pn.two && pn.side, 'wide again → the pane is back');
        await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        ok(!(await pane()).open, 'Escape closes the window (in the pane there is no Compare page to go back from)');
        ok(await page.evaluate(() => calls) === 0 && errors.length === 0, 'no AI call, no page errors: ' + errors.join(' | '));
        await page.context().close();

        console.log('phone');
        ({ page, errors } = await open(browser, { width: 390 }));
        v = await view(page);
        ok(v.step === 'review' && !v.overflowX, 'Review at 390 px: no sideways scroll');
        await click(page, '#curate-next'); v = await view(page);
        const cols = await page.evaluate(() => new Set([...document.querySelectorAll('button[data-save]')].map(b => Math.round(b.getBoundingClientRect().left))).size);
        ok(v.step === 'save' && !v.overflowX && cols === 1, 'Save at 390 px: the three cards stack, no sideways scroll');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        await page.context().close();
        console.log('\nquiz-curate-steps-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
