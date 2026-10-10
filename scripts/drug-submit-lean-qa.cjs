// V101.94: the intern Drug + Disease submit forms (Submit New → ⋯ → Drug / Disease) are lean — the empty picture-preview row stays hidden ([hidden] lost to display:flex),
// ONE header row (round back chevron, title, ⇄ swap chip, ✕; the "New entry" pill only in Edit / Suggest modes), empty textareas are ONE line and open on focus / when
// filled, fewer hints, Submit only (the ✕ closes). The REAL public/index.html on a touch phone (file://, network blocked, Firebase stubbed). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx), 'intern version present');
assert.ok(!idx.includes('dc-submit-cancel-btn') && !/>Cancel<\/button>\s*\r?\n\s*<button type="button" id="d[cx]-submit-save-btn"/.test(idx), 'no Cancel button in the Drug / Disease footers');
assert.ok(!idx.includes('Separate each name with a comma'), 'the Brand hint (it repeats the placeholder) is gone');

const KINDS = [
    { k: 'dc', modal: 'drugCodexSubmitModal', open: "dcOpenSubmit('new', { from: 'submit-new' }); dcSetBackLabel();", title: 'Drug', swap: 'Disease', first: 'dc-s-genericName', area: 'dc-s-indication', notes: 'dc-s-internNotes', hints: 2 },
    { k: 'dx', modal: 'diseaseCodexSubmitModal', open: "dxOpenSubmit('new', { from: 'submit-new' }); dxSetBackLabel();", title: 'Disease', swap: 'Drug', first: 'dx-s-diseaseName', area: 'dx-s-symptoms', notes: 'dx-s-internNotes', hints: 2 },
];

async function open(browser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    await page.waitForTimeout(600);
    return { page, errors, ctx };
}

(async () => {
    const browser = await chromium.launch();
    try {
        for (const K of KINDS) {
            const { page, errors, ctx } = await open(browser);
            await page.evaluate(({ open, modal }) => {
                try { new Function(open)(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
                document.getElementById(modal).style.setProperty('display', 'block', 'important');
            }, K);
            await page.waitForTimeout(400);
            const m = await page.evaluate(K => {
                const sh = document.querySelector('#' + K.modal + ' .dc-submit-shell'), vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
                const r = x => x.getBoundingClientRect(), head = sh.querySelector('.dc-submit-head');
                const back = document.getElementById(K.k + '-submit-back'), title = sh.querySelector('.dc-submit-title'), swap = document.getElementById(K.k + '-submit-swap'), x = sh.querySelector('.dc-detail-close');
                const pill = document.getElementById(K.k + '-submit-mode-pill'), prev = document.getElementById(K.k + '-image-preview');
                const ta = [...sh.querySelectorAll('.dc-submit-field textarea')];
                const hints = [...sh.querySelectorAll('.dc-submit-field-hint')].map(h => h.textContent.replace(/\s+/g, ' ').trim());
                return {
                    previewVisible: vis(prev), headH: Math.round(r(head).height), pillVisible: vis(pill),
                    oneRow: [back, title, swap, x].every(e => Math.abs((r(e).top + r(e).height / 2) - (r(back).top + r(back).height / 2)) < 12), swapVisible: vis(swap),
                    backW: Math.round(r(back).width), backH: Math.round(r(back).height), backLabelVisible: vis(back.querySelector('span')), backTitle: back.title, backAria: back.getAttribute('aria-label'),
                    taH: ta.map(t => Math.round(r(t).height)), taResize: ta.map(t => getComputedStyle(t).resize), notesPh: document.getElementById(K.notes).placeholder,
                    hints, cancel: !!sh.querySelector('.dc-submit-cancel-btn'), submit: vis(sh.querySelector('.dc-submit-save-btn')), imgHint: sh.querySelector('.dc-submit-image-hint').textContent,
                    first: Math.round(r(document.getElementById(K.first)).top - r(sh).top),
                };
            }, K);
            // 1 · no empty preview / Remove before a picture is chosen
            assert.equal(m.previewVisible, false, K.k + ': no empty preview + Remove row');
            // 3 · one header row, round icon-only back, swap chip kept, no "New entry" pill
            assert.ok(m.oneRow && m.swapVisible, K.k + ': back · title · ⇄ · ✕ on ONE row: ' + JSON.stringify(m));
            assert.ok(m.headH <= 60, K.k + ': header ≤ 60px (was 87): ' + m.headH);
            assert.ok(m.backW >= 36 && m.backH >= 36 && !m.backLabelVisible && m.backTitle === 'Back to Submit New' && m.backAria === 'Back to Submit New', K.k + ': 36px icon-only back, the label is title + aria: ' + JSON.stringify([m.backW, m.backH, m.backTitle]));
            assert.equal(m.pillVisible, false, K.k + ': "New entry" pill hidden');
            // 4 · empty textareas are one line
            assert.ok(m.taH.every(h => h <= 44) && m.taResize.every(v => v === 'none'), K.k + ': empty textareas one line, no grip: ' + m.taH + ' ' + m.taResize);
            // 5 · hints
            assert.equal(m.hints.length, K.hints, K.k + ': two hints left: ' + JSON.stringify(m.hints));
            assert.ok(m.hints.every(h => h.replace(/[฀-๿]/g, '').trim().length < 40), K.k + ': hints are short: ' + JSON.stringify(m.hints));
            assert.ok(m.notesPh.length < 40, K.k + ': notes placeholder fits one line: ' + m.notesPh);
            // 2 · fill-from-image hint short
            assert.ok(/AI fills the empty fields/.test(m.imgHint) && /image goes to admin/.test(m.imgHint) && m.imgHint.length < 100, K.k + ': image hint short, disclosure kept: ' + m.imgHint);
            // 6 · Submit only
            assert.ok(!m.cancel && m.submit, K.k + ': no Cancel, Submit visible');
            assert.ok(m.first <= 200, K.k + ': first field within 200px of the top (was 321): ' + m.first);

            // focus opens a textarea; a value keeps it open; leaving an empty one folds it
            await page.locator('#' + K.area).focus();
            await page.waitForTimeout(150);
            const focused = await page.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().height), K.area);
            assert.ok(focused >= 96, K.k + ': focused textarea opens (≥ 96): ' + focused);
            await page.evaluate(id => { const t = document.getElementById(id); t.value = 'Typed text'; t.dispatchEvent(new Event('input', { bubbles: true })); t.blur(); }, K.area);
            await page.waitForTimeout(150);
            const filled = await page.evaluate(id => { const t = document.getElementById(id); return { h: Math.round(t.getBoundingClientRect().height), resize: getComputedStyle(t).resize }; }, K.area);
            assert.ok(filled.h >= 96 && filled.resize === 'vertical', K.k + ': a filled textarea stays open (AI-filled / edited drafts are readable): ' + JSON.stringify(filled));
            await page.evaluate(id => { const t = document.getElementById(id); t.value = ''; }, K.area);
            await page.waitForTimeout(150);
            assert.ok((await page.evaluate(id => Math.round(document.getElementById(id).getBoundingClientRect().height), K.area)) <= 44, K.k + ': emptied → one line again');

            // edit / suggest modes keep their pill (it carries information there)
            const pillEdit = await page.evaluate(K => { const p = document.getElementById(K.k + '-submit-mode-pill'); p.className = 'dc-submit-mode-pill dc-submit-mode-pill-edit'; p.textContent = 'Edit pending'; return getComputedStyle(p).display; }, K);
            assert.notEqual(pillEdit, 'none', K.k + ': the Edit pending pill still shows');

            // a long Back label (suggest edit → the drug name) must not break the row: it is only a tooltip
            await page.evaluate(K => { ddApplyBackLabel(K.k + '-submit-back', K.k + '-submit-back-label', 'A very long drug name that would have overflowed'); }, K);
            const backNow = await page.evaluate(K => { const b = document.getElementById(K.k + '-submit-back'); return { w: Math.round(b.getBoundingClientRect().width), t: b.title }; }, K);
            assert.ok(backNow.w === m.backW && /Back to A very long/.test(backNow.t), K.k + ': long label = tooltip only: ' + JSON.stringify(backNow));

            if (process.env.SHOT) {
                await page.evaluate(K => { const p = document.getElementById(K.k + '-submit-mode-pill'); p.className = 'dc-submit-mode-pill'; ddApplyBackLabel(K.k + '-submit-back', K.k + '-submit-back-label', 'Submit New'); }, K);
                const bb = await page.evaluate(K => { const e = document.querySelector('#' + K.modal + ' .dc-submit-shell').getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; }, K);
                await page.screenshot({ path: path.join(process.env.SHOT, `${K.k}_submit_lean.png`), clip: { x: Math.max(0, bb.x - 4), y: Math.max(0, bb.y - 4), width: bb.w + 8, height: Math.min(bb.h + 8, 780) } });
            }
            assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], K.k + ': no page errors');
            await ctx.close();
        }
        console.log('PASS: Drug + Disease submit forms — no empty preview row, one header row (icon-only back, ⇄, ✕, no "New entry" pill), one-line empty textareas that open on focus / when filled, short hints, Submit only');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
