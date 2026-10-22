// V101.201: the intern Disease Codex entry gets the Drug entry's lean head (V101.199) — TH ⌄ | ✨ pill (chip = code + chevron, source in the
// tooltip), chips row full width under the name, sticky head that folds past 40px, the one-row icon rail pinned under it with the section
// in view lit; the shared codexLeanHead serves both entries. The REAL index.html on a 390 px phone with a fake disease.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
const head = html.slice(html.indexOf('id="diseaseCodexDetailModal"'), html.indexOf('id="dx-detail-body"'));
assert.ok(/<span class="dc-head-grp lang-no-toggle"><div id="dx-detail-lang" class="dc-lang-wrap lang-no-toggle"><\/div><button type="button" class="dc-detail-suggest-btn" onclick="dxSuggestEdit\(\)"[^>]*>[^<]*<\/button><\/span>/.test(head), 'the pill = language chip + ✨ in one span');
assert.ok(head.includes('<div id="dx-detail-chips" class="dc-detail-chips lang-no-toggle"></div>\n            </div>') && !head.includes('<div id="dx-detail-name" class="dc-detail-name">Disease name</div>\n                        <div id="dx-detail-chips"'), 'the chips row sits after the head row, full width');
assert.ok(html.includes('function codexLeanHead(modalId, bodyId, artsId) {') && html.includes("function dxLeanHead() { codexLeanHead('diseaseCodexDetailModal', 'dx-detail-body', 'dx-detail-articles'); }") && html.includes("function dcLeanHead() { codexLeanHead('drugCodexDetailModal', 'dc-detail-body', 'dc-detail-articles'); }"), 'one lean head for both entries');
assert.ok(!/host\.innerHTML = `\$\{status\}<button type="button" class="dc-lang-chip" onclick="dxToggleLangPop\(\)"/.test(html), 'the disease chip no longer carries the status badge');
const PUB = path.resolve('public');

(async () => {
    const browser = await chromium.launch();
    try {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
        const ph = await ctx.newPage();
        const errs = []; ph.on('pageerror', e => { if (!/ServiceWorker|mermaid/.test(e.message)) errs.push(e.message); });
        await ph.addInitScript(() => {
            const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
            const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
            const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
            window.__fake = { collection: () => chain, runTransaction: async () => {} };
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } }) : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain, apply: () => chain });
        });
        await ph.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
        await ph.goto(pathToFileURL(path.join(PUB, 'index.html')).href, { waitUntil: 'load' });
        await ph.waitForFunction(() => typeof dxOpenDetail === 'function' && typeof dxLeanHead === 'function' && typeof codexLeanHead === 'function');
        const r = await ph.evaluate(async () => {
            const wait = ms => new Promise(res => setTimeout(res, ms)), out = {};
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
            userId = 'U1'; window.myRegistered = true; window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-10-01' };
            window.marked = { parse: t => String(t).split(/\n\n+/).map(p => '<p>' + p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>').join('') }; window.DOMPurify = { sanitize: h => h };
            if (typeof dxSetSelectedLang === 'function') dxSetSelectedLang('orig');
            const long = n => Array.from({ length: n }, (_, i) => 'Point ' + (i + 1) + ': a line of clinical text to give the section some height.').join('\n');
            dxState.codex = [{ _id: 'h1', diseaseName: 'Hordeolum', thaiName: 'กุ้งยิง', icd10: 'H00.0', category: 'Ophthalmology', synonyms: ['Stye', 'External hordeolum'], epidemiology: 'Common at every age.', etiology: 'Staph.', pathophysiology: 'Blocked gland.', symptoms: '- lump', signs: 'tender', diagnosis: 'clinical', investigations: 'none', differential: 'chalazion', treatment: long(12), nonPharm: 'warm compress', complications: 'cellulitis', prognosis: 'good', patientCounseling: long(12), redFlags: 'whole-lid redness', pearls: 'x', references: ['AAO'] }];
            dxOpenDetail('h1'); await wait(150);
            const modal = document.getElementById('diseaseCodexDetailModal'), shell = modal.querySelector('.dc-detail-shell'), headEl = modal.querySelector('.dc-detail-head'), body = document.getElementById('dx-detail-body');
            const q = s => modal.querySelector(s), qa = s => [...modal.querySelectorAll(s)];
            const chip = q('#dx-detail-lang .dc-lang-chip');
            out.chip = [chip && chip.textContent.replace(/\s+/g, ' ').trim(), chip && /^Language · /.test(chip.getAttribute('title') || ''), !!q('.dc-head-grp #dx-detail-lang'), !!q('.dc-head-grp .dc-detail-suggest-btn'), qa('#dx-detail-lang .dc-lang-status').length];
            out.grp = (() => { const r1 = chip.getBoundingClientRect(), r2 = q('.dc-head-grp .dc-detail-suggest-btn').getBoundingClientRect(); return [Math.abs(r1.top - r2.top) < 2, Math.round(r2.left - r1.right)]; })();
            out.chipsRow = (() => { const row = document.getElementById('dx-detail-chips'), nameCol = document.getElementById('dx-detail-name').parentElement; return [row.parentElement === headEl, !nameCol.contains(row), Math.round(row.getBoundingClientRect().width) >= Math.round(headEl.getBoundingClientRect().width) - 44, qa('#dx-detail-chips .dc-detail-chip').length >= 3]; })();
            dxToggleLangPop(); out.pop = [!document.getElementById('dx-lang-pop').hidden, qa('#dx-lang-pop button').length]; document.body.click(); await wait(30); out.popClosed = document.getElementById('dx-lang-pop').hidden;
            dxApplyLang('th'); await wait(150); const chip2 = q('#dx-detail-lang .dc-lang-chip'); out.th = [chip2.textContent.replace(/\s+/g, ' ').trim(), /🌐|AI/.test(chip2.textContent)]; dxApplyLang('orig'); await wait(150);
            const rail = body.querySelector('.dc-sec-rail'), chips = [...rail.querySelectorAll('.dc-sec-chip')];
            out.rail = [getComputedStyle(rail).flexWrap, getComputedStyle(rail).overflowX, new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size, (rail.querySelector('.dc-sec-chip.active') || {}).getAttribute && rail.querySelector('.dc-sec-chip.active').getAttribute('data-target'), rail.style.top, rail.classList.contains('dc-sec-rail-icons')];
            const h0 = headEl.offsetHeight;
            [...body.querySelectorAll('.dc-detail-section')].forEach(x => { x.open = true; });
            body.scrollTop = 600; await wait(250);
            out.folded = [headEl.classList.contains('is-compact'), getComputedStyle(document.getElementById('dx-detail-chips')).display, headEl.offsetHeight < h0, shell.scrollHeight <= shell.clientHeight + 1, body.scrollTop > 40, Math.round(body.getBoundingClientRect().bottom) <= Math.round(shell.getBoundingClientRect().bottom) + 1];
            const secs = [...body.querySelectorAll('.dc-detail-section')], target = secs[2] || secs[1]; target.scrollIntoView({ block: 'start' }); await wait(400);
            out.spy = [(rail.querySelector('.dc-sec-chip.active') || {}).getAttribute && rail.querySelector('.dc-sec-chip.active').getAttribute('data-target'), target.getAttribute('data-section-key'), Math.round(target.getBoundingClientRect().top) >= Math.round(body.getBoundingClientRect().top + rail.offsetHeight) - 6];
            body.scrollTop = 0; await wait(250);
            out.unfolded = [headEl.classList.contains('is-compact'), getComputedStyle(document.getElementById('dx-detail-chips')).display];
            // the drug entry still works through the shared function
            dxCloseDetail(); dcState.codex = [{ _id: 'd1', genericName: 'Salbutamol', indication: 'Asthma', dosing: 'Adult: 2 puffs. Pediatric: 1 puff.' }]; dcOpenDetail('d1'); await wait(150);
            out.drug = [typeof document.getElementById('dc-detail-body')._dcPlace, !!document.querySelector('#dc-detail-body .dc-sec-rail .dc-sec-chip.active')];
            return out;
        });
        assert.deepEqual(r.chip, ['Orig ⌄', true, true, true, 0], 'the pill holds the chip (code + chevron, source in the tooltip, no badge) and ✨: ' + JSON.stringify(r.chip));
        assert.deepEqual(r.grp, [true, 0], 'chip and ✨ touch in one pill');
        assert.deepEqual(r.chipsRow, [true, true, true, true], 'the chips row is a full-width child of the head, outside the name column, with the ICD / category / aliases chips: ' + JSON.stringify(r.chipsRow));
        assert.deepEqual([r.pop, r.popClosed], [[true, 6], true], 'the popover opens with 6 languages and closes on an outside click');
        assert.deepEqual(r.th, ['TH ⌄', false], 'after TH: TH ⌄ with no globe or AI text');
        assert.deepEqual(r.rail, ['nowrap', 'auto', 1, r.rail[3], '0px', true], 'the icon rail: one row, horizontal scroll, pinned at the body top: ' + JSON.stringify(r.rail));
        assert.ok(r.rail[3], 'the first section is lit');
        assert.deepEqual(r.folded, [true, 'none', true, true, true, true], 'scrolled: the head folds, the chips row hides, the modal does not scroll, the body fits: ' + JSON.stringify(r.folded));
        assert.deepEqual([r.spy[0], r.spy[2]], [r.spy[1], true], 'the section scrolled into view lights its chip and lands below the rail: ' + JSON.stringify(r.spy));
        assert.deepEqual(r.unfolded, [false, 'flex'], 'back at the top the head unfolds');
        assert.deepEqual(r.drug, ['function', true], 'the drug entry still runs the shared lean head');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: lean Disease entry — TH ⌄ | ✨ pill, full-width chips row, icon rail lit by scroll-spy, head sticky + compact past 40px; codexLeanHead shared with the drug entry');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
