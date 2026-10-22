// V101.199: the intern Drug Codex entry, lean — TH ⌄ | ✨ pill in the head (no flag bar), chips row full-width under the name, sticky head
// that folds past 40px, one-row rail pinned under it with the section in view lit, dosing lead-words as bold lines, brand chip "first +N".
// The REAL index.html on a 390 px phone with a fake drug.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(html));
const head = html.slice(html.indexOf('id="drugCodexDetailModal"'), html.indexOf('id="dc-detail-body"'));
assert.ok(/<span class="dc-head-grp lang-no-toggle"><div id="dc-detail-lang" class="dc-lang-wrap lang-no-toggle"><\/div><button type="button" class="dc-detail-suggest-btn" onclick="dcSuggestEdit\(\)"[^>]*>[^<]*<\/button><\/span>/.test(head), 'the pill = language chip + ✨ in one span');
assert.ok(head.indexOf('</div>\n                <!-- V95.00') > head.indexOf('dc-detail-close') && head.includes('<div id="dc-detail-chips" class="dc-detail-chips lang-no-toggle"></div>\n            </div>'), 'the chips row sits after the head row, full width');
assert.ok(html.includes('function dcRenderLangChip(eff) {') && html.includes('function dcLeanHead() {') && html.includes('function dcDosingLines(text) {') && !html.includes('body.innerHTML = dcRenderLangBar(eff)'), 'chip, lean head, dosing lines; the flag bar is not drawn');
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
        await ph.waitForFunction(() => typeof dcOpenDetail === 'function' && typeof dcLeanHead === 'function' && typeof dcDosingLines === 'function');
        const r = await ph.evaluate(async () => {
            const wait = ms => new Promise(res => setTimeout(res, ms)), out = {};
            document.getElementById('main-app').style.setProperty('display', 'block', 'important');
            const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
            document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
            const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
            userId = 'U1'; window.myRegistered = true; window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-10-01' };
            // pure: dosing lines
            out.dose = [dcDosingLines('ผู้ใหญ่: หยด 1 หยด วันละ 2–4 ครั้ง เด็ก: อายุ 3 ปีขึ้นไป ใช้ตามผู้ใหญ่ ไต: ไม่ต้องปรับ ตับ: ยังไม่ได้ศึกษา'), dcDosingLines('Adult: 10 mg once daily. Renal: no adjustment.'), dcDosingLines('10 mg once daily before breakfast'), dcDosingLines('Adult: 10 mg\nRenal: none'), dcDosingLines('')];
            try { localStorage.removeItem('dcLang'); } catch (e) {}
            if (typeof dcSetSelectedLang === 'function') dcSetSelectedLang('orig');
            dcState.codex = [{ _id: 'e1', genericName: 'Emedastine difumarate', atcCode: 'S01GX06', class: 'Ophthalmic antihistamine', brandNames: ['Emadine', 'Allesaga'], indication: '- Allergic conjunctivitis', dosing: 'ผู้ใหญ่: หยด 1 หยด วันละ 2–4 ครั้ง เด็ก: อายุ 3 ปีขึ้นไป ใช้ตามผู้ใหญ่ ไต: ไม่ต้องปรับ ตับ: ยังไม่ได้ศึกษา', contraindication: '- Hypersensitivity', sideEffects: 'Headache', interactions: 'None known', mechanism: 'Selective H1 antagonist', pharmacokinetics: Array.from({ length: 14 }, (_, i) => 'PK point ' + (i + 1) + ': low systemic absorption, mostly ocular.').join('\n'), patientEducation: Array.from({ length: 14 }, (_, i) => 'Counsel ' + (i + 1) + ': remove contact lenses first.').join('\n'), references: ['Emadine SmPC'] }, { _id: 'x2', genericName: 'Plain', brandNames: ['One'], indication: 'x', dosing: '10 mg once daily' }];
            // the CDN markdown pair is aborted in this harness — a minimal marked/DOMPurify so **bold** and paragraphs render as on the live page
            window.marked = { parse: t => String(t).split(/\n\n+/).map(p => '<p>' + p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>').join('') }; window.DOMPurify = { sanitize: h => h };
            dcOpenDetail('e1'); await wait(150);
            const modal = document.getElementById('drugCodexDetailModal'), shell = modal.querySelector('.dc-detail-shell'), headEl = modal.querySelector('.dc-detail-head'), body = document.getElementById('dc-detail-body');
            const q = s => modal.querySelector(s), qa = s => [...modal.querySelectorAll(s)];
            const chip = q('#dc-detail-lang .dc-lang-chip');
            out.chip = [chip && chip.textContent.replace(/\s+/g, ' ').trim(), chip && chip.getAttribute('title'), !!q('.dc-head-grp #dc-detail-lang'), !!q('.dc-head-grp .dc-detail-suggest-btn'), qa('#dc-detail-lang .dc-lang-status').length, !!body.querySelector('.dc-lang-bar')];
            out.grp = (() => { const grp = q('.dc-head-grp'), r1 = chip.getBoundingClientRect(), r2 = q('.dc-head-grp .dc-detail-suggest-btn').getBoundingClientRect(); return [getComputedStyle(grp).display, Math.abs(r1.top - r2.top) < 2, Math.round(r2.left - r1.right)]; })();
            out.chipsRow = (() => { const row = document.getElementById('dc-detail-chips'), nameCol = document.getElementById('dc-detail-name').parentElement; return [row.parentElement === headEl, !nameCol.contains(row), Math.round(row.getBoundingClientRect().width), Math.round(headEl.getBoundingClientRect().width)]; })();
            const brand = qa('#dc-detail-chips .dc-detail-chip').find(c => c.textContent.startsWith('©'));
            out.brand = [brand && brand.textContent, brand && brand.getAttribute('title')];
            // popover
            dcToggleLangPop(); out.pop = [!document.getElementById('dc-lang-pop').hidden, qa('#dc-lang-pop button').length, (q('#dc-lang-pop button.active') || {}).textContent, chip.getAttribute('aria-expanded')];
            document.body.click(); await wait(30); out.popClosed = document.getElementById('dc-lang-pop').hidden;
            dcApplyLang('th'); await wait(150);
            const chip2 = q('#dc-detail-lang .dc-lang-chip'); out.th = [chip2.textContent.replace(/\s+/g, ' ').trim(), /🌐|AI/.test(chip2.textContent), (q('#dc-lang-pop button.active') || {}).textContent];
            dcApplyLang('orig'); await wait(150);
            // dosing field
            const dosing = qa('.dc-detail-field-label').find(l => /^Dosing/.test(l.textContent.trim()));
            const dv = dosing && dosing.nextElementSibling; out.dosing = [dv && [...dv.querySelectorAll('strong')].map(x => x.textContent), dv && dv.querySelectorAll('p').length, typeof window.renderMd, dv && dv.innerHTML.slice(0, 200)];
            // rail: one row, first section lit
            const rail = body.querySelector('.dc-sec-rail'), chips = [...rail.querySelectorAll('.dc-sec-chip')];
            out.rail = [getComputedStyle(rail).flexWrap, getComputedStyle(rail).overflowX, new Set(chips.map(c => Math.round(c.getBoundingClientRect().top))).size, (rail.querySelector('.dc-sec-chip.active') || {}).getAttribute && rail.querySelector('.dc-sec-chip.active').getAttribute('data-target'), getComputedStyle(rail).position, rail.style.top];
            // scroll: head folds, rail re-pinned, the section in view lights up
            const h0 = headEl.offsetHeight;
            [...body.querySelectorAll('.dc-detail-section')].forEach(x => { x.open = true; });   // enough height to scroll
            body.scrollTop = 600; await wait(250);
            out.folded = [headEl.classList.contains('is-compact'), getComputedStyle(document.getElementById('dc-detail-chips')).display, headEl.offsetHeight < h0, shell.scrollHeight <= shell.clientHeight + 1, getComputedStyle(document.getElementById('dc-detail-name')).whiteSpace, body.scrollTop > 40, Math.round(body.getBoundingClientRect().bottom) <= Math.round(shell.getBoundingClientRect().bottom) + 1];
            const moa = [...body.querySelectorAll('.dc-detail-section')].find(x => x.getAttribute('data-section-key') === 'moa'); moa.open = true; moa.scrollIntoView({ block: 'start' }); await wait(400);
            const clin = body.querySelector('.dc-detail-section[data-section-key="clinical"]'), bt = body.getBoundingClientRect().top;
            out.spy = [(rail.querySelector('.dc-sec-chip.active') || {}).getAttribute && rail.querySelector('.dc-sec-chip.active').getAttribute('data-target'), Math.round(moa.getBoundingClientRect().top) >= Math.round(bt + rail.offsetHeight) - 6];
            body.scrollTop = 0; await wait(250);
            out.unfolded = [headEl.classList.contains('is-compact'), getComputedStyle(document.getElementById('dc-detail-chips')).display];
            // a drug without lead-words / one brand: plain chip, plain dosing
            dcOpenDetail('x2'); await wait(150);
            const brand2 = qa('#dc-detail-chips .dc-detail-chip').find(c => c.textContent.startsWith('©'));
            const dos2 = qa('.dc-detail-field-label').find(l => /^Dosing/.test(l.textContent.trim()));
            out.plain = [brand2 && brand2.textContent, dos2 && dos2.nextElementSibling.textContent.trim(), dos2 && dos2.nextElementSibling.querySelectorAll('strong').length];
            return out;
        });
        assert.deepEqual(r.dose, ['**ผู้ใหญ่:** หยด 1 หยด วันละ 2–4 ครั้ง\n\n**เด็ก:** อายุ 3 ปีขึ้นไป ใช้ตามผู้ใหญ่\n\n**ไต:** ไม่ต้องปรับ\n\n**ตับ:** ยังไม่ได้ศึกษา', '**Adult:** 10 mg once daily.\n\n**Renal:** no adjustment.', '10 mg once daily before breakfast', 'Adult: 10 mg\nRenal: none', ''], 'dosing lines: two or more inline lead-words split into bold lines; one lead, separate lines or none are left alone: ' + JSON.stringify(r.dose));
        assert.deepEqual(r.chip.slice(0, 1).concat(r.chip.slice(2)), ['Orig ⌄', true, true, 0, false], 'the head pill holds the language chip (code + chevron only) and ✨; no status badge; no flag bar in the body: ' + JSON.stringify(r.chip));
        assert.match(r.chip[1], /^Language · /, 'the source lives in the tooltip');
        assert.deepEqual([/flex/.test(r.grp[0]), r.grp[1], r.grp[2]], [true, true, 0], 'chip and ✨ sit in one pill, touching: ' + JSON.stringify(r.grp));
        assert.deepEqual(r.chipsRow.slice(0, 2), [true, true], 'the chips row is a child of the head, outside the name column');
        assert.ok(r.chipsRow[2] >= r.chipsRow[3] - 44, 'the chips row spans the head width: ' + JSON.stringify(r.chipsRow));
        assert.deepEqual(r.brand, ['© Emadine +1', 'Emadine · Allesaga'], 'brand chip: first + N, all names in the tooltip');
        assert.deepEqual(r.pop, [true, 6, '⭕', 'true'], 'the popover opens with the 6 languages, the current one (orig ⭕) active: ' + JSON.stringify(r.pop));
        assert.equal(r.popClosed, true, 'a click elsewhere closes it');
        assert.deepEqual(r.th, ['TH ⌄', false, r.th[2]], 'after TH: the chip reads TH ⌄ with no globe or AI text: ' + JSON.stringify(r.th));
        assert.deepEqual(r.dosing.slice(0, 2), [['ผู้ใหญ่:', 'เด็ก:', 'ไต:', 'ตับ:'], 4], 'the rendered Dosing field: four bold-led paragraphs: ' + JSON.stringify(r.dosing));
        assert.deepEqual(r.rail, ['nowrap', 'auto', 1, 'clinical', 'sticky', '0px'], 'rail: one row, horizontal scroll, first section lit, sticky at the top of the body scroller: ' + JSON.stringify(r.rail));
        assert.deepEqual(r.folded, [true, 'none', true, true, 'normal', true, true], 'scrolled: the head folds (chips hidden, shorter), the modal itself does not scroll, the name shrinks (never cut to …), the body fits the modal: ' + JSON.stringify(r.folded));
        assert.deepEqual(r.spy, ['moa', true], 'the section scrolled into view lights its chip and lands below the rail: ' + JSON.stringify(r.spy));
        assert.deepEqual(r.unfolded, [false, 'flex'], 'back at the top the head unfolds');
        assert.deepEqual(r.plain, ['© One', '10 mg once daily', 0], 'one brand: no +N; dosing without lead-words unchanged');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: lean drug entry — TH ⌄ | ✨ pill (no flag bar), chips row full width, brand first +N, dosing lead-words as bold lines, one-row rail lit by scroll-spy, head sticky + compact past 40px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
