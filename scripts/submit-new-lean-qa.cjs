// V101.85: Submit New — lean. No title / "Select Type" label above the chips (✕ ends the launchers row), Submit is the only footer button and stays pinned,
// the Case form is one inline row + a one-line note, the Disease System buttons are coloured by how many cases the intern has sent in that system
// (grey = none → greener = more, a small count badge; rejected cases do not count), a missing required field gets a red frame.
// The REAL public/index.html + submit-system-grid.css/js on a touch phone (file://, network blocked, Firebase stubbed). SHOT=<dir> writes a PNG.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(!/Select Type \/ /.test(idx), 'the "Select Type" label is gone');
assert.ok(!/Cancel \/ 취소/.test(idx), 'the footer Cancel button is gone');
assert.ok(idx.includes('class="u-x" onclick="closeUnifiedModal()"'), '✕ ends the one-line rail');

async function open(browser) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
    await page.evaluate(() => {
        const D = n => new Date(Date.now() + n * 86400000);
        const key = n => schDateKey(D(n));
        window.__key = key;
        window.userId = 'U1';
        usersData = [{ id: 'U1', displayName: 'Sample', startDate: key(-60), endDate: key(394) }];
        window.myUserDoc = { id: 'U1', startDate: key(-60), endDate: key(394) };
        window.myCheckin = { lastDate: key(-1) };               // not checked in today -> a hollow "other" dot today
        window.myCasesCache = []; window.myReflectiveLogsCache = [];
        // two quests whose deadlines are long gone (MISSED, must draw nothing) + one quiz due in 2 days
        questsCache = [{ id: 'q1', title: 'Old quest A', isActive: true, deadline: D(-5) }, { id: 'q2', title: 'Old quest B', isActive: true, deadline: D(-12) }];
        quizzesCache = [{ id: 'z1', title: 'Vitamin B quiz', isActive: true, deadline: D(2) }];
        quizAttemptsCache = {}; mySubmissionsCache = {};
        schEventsCache = [{ id: 'e1', title: 'Journal club', eventDate: key(3), timeText: '09:00–10:00' }]; schMyEventInterests = {};
        schLoadEvents = () => {};
        const T = (n, type, title) => ({ submissionType: type, title, status: 'done', timestamp: D(n), id: type + n });
        const items = [T(-1, 'quiz', 'Pharmacology quiz'), T(-2, 'reflective', 'Daily reflection'), T(-3, 'case', 'Keratitis case')];
        getUnifiedAllItems = () => items;
        schCheckinDays = new Set();
        const ts = n => ({ toDate: () => D(n) });
        const row = (i, extra) => Object.assign({ id: 'r' + i, timestamp: ts(0), status: 'approved' }, extra);
        monthlyProgress.update({ logs: [0, 1, 2, 3].map(i => row(i)), cases: [0, 1].map(i => row(i)), targets: { quiz: 30, log: 12, case: 8 }, save: () => Promise.resolve() });
        monthlyProgress.setQuizzes(Array.from({ length: 12 }, (_, i) => row(i, { quizId: 'qz' + i, isPractice: false })));
        internshipProgress.setPeriod({ personal: true, goal: { kind: 'monthly', target: 30 }, monthlyTarget: 30, history: {}, saveGoal: () => Promise.resolve() });
        internshipProgress.setAttempts(Array.from({ length: 12 }, (_, i) => ({ quizId: 'qz' + i, status: 'approved', isPractice: false, timestamp: ts(0) })));
        if (window.assignedGoals) assignedGoals.userOpen = () => {};
    });
    return { page, errors, ctx };
}

const hsl = c => { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c); return m ? (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 : 1; };   // luminance 0..1

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors, ctx } = await open(browser);
        await page.setViewportSize({ width: 390, height: 800 });
        await page.evaluate(() => {
            const D = n => new Date(Date.now() - n * 86400000);
            const ts = n => ({ toMillis: () => D(n).getTime(), toDate: () => D(n) });
            const c = (id, key, status, n) => ({ id, submissionType: 'case', title: '', status, timestamp: ts(n), metadata: { caseId: id, diseaseSystemKey: key } });
            const items = [];
            for (let i = 0; i < 7; i++) items.push(c('r' + i, 'respiratory', 'approved', i + 1));
            items.push(c('rx', 'respiratory', 'rejected', 9));                       // rejected: not counted
            for (let i = 0; i < 3; i++) items.push(c('c' + i, 'cardio', i ? 'approved' : 'pending', 10 + i));
            items.push(c('g0', 'gi', 'approved', 20));
            unifiedSubmissionsCache = items;                                       // the page's own top-level binding (not a window property)
            getUnifiedAllItems = () => unifiedSubmissionsCache;                    // the shared harness stubs it with its own sample rows
            try { openUnifiedModal(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; }
        });
        await page.waitForTimeout(500);

        // ---- no header above the chips; the whole type rail is ONE line ending in ⋯ and ✕
        const top = await page.evaluate(() => {
            const card = document.getElementById('unified-submit-modal').firstElementChild.getBoundingClientRect();
            const chip = document.querySelector('.type-btn').getBoundingClientRect();
            return { gap: Math.round(chip.top - card.top), text: document.getElementById('unified-submit-modal').innerText };
        });
        assert.ok(top.gap <= 24, 'first type chip sits within 24px of the card top: ' + top.gap);
        assert.ok(!/Submit New|Select Type/.test(top.text), 'no title / label text above the chips');
        const rail = async () => page.evaluate(() => {
            const cells = [...document.querySelectorAll('.type-btn, #u-more-btn, .u-line > .u-x')].map(e => e.getBoundingClientRect());
            const line = document.querySelector('.u-line');
            return { n: cells.length, oneRow: Math.max(...cells.map(r => r.top)) - Math.min(...cells.map(r => r.top)) <= 2, minH: Math.round(Math.min(...cells.map(r => r.height))), minW: Math.round(Math.min(...cells.map(r => r.width))),
                overflow: line.scrollWidth - line.clientWidth, h: Math.round(line.getBoundingClientRect().height) };
        });
        const r390 = await rail();
        assert.equal(r390.n, 6, 'Case · Work · Explore · Event · ⋯ · ✕');
        assert.ok(r390.oneRow, 'all six on ONE row @390');
        assert.ok(r390.minH >= 44 && r390.minW >= 36 && r390.overflow <= 0 && r390.h <= 48, 'cells ≥44 tall, ≥36 wide, no overflow, rail ~44px: ' + JSON.stringify(r390));
        for (const w of [363, 340]) {
            await page.setViewportSize({ width: w, height: 800 });
            await page.waitForTimeout(250);
            const r = await rail();
            assert.ok(r.oneRow && r.overflow <= 0 && r.minW >= 36, 'one row, no overflow @' + w + ': ' + JSON.stringify(r));
        }
        await page.setViewportSize({ width: 390, height: 800 });
        await page.waitForTimeout(250);
        // only the picked type shows its name; the others are icons with an aria-label
        const names = async () => page.evaluate(() => [...document.querySelectorAll('.type-btn')].map(b => ({ t: b.dataset.type, label: !!b.querySelector('div') && getComputedStyle(b.querySelector('div')).display !== 'none', aria: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') })));
        let nm = await names();
        assert.deepEqual(nm.filter(n => n.label).map(n => n.t), ['case'], 'only Case shows its name');
        assert.ok(nm.every(n => n.aria), 'every chip has an aria-label');
        await page.evaluate(() => selectSubmissionType('work'));
        nm = await names();
        assert.deepEqual(nm.filter(n => n.label).map(n => n.t), ['work'], 'picking Work moves the name to Work');
        assert.equal(nm.find(n => n.t === 'work').pressed, 'true');
        assert.equal(nm.find(n => n.t === 'case').pressed, 'false');
        await page.evaluate(() => selectSubmissionType('case'));

        // ⋯ menu: Drug · Disease · Product (44px rows), closes on Esc / outside click / pick
        assert.ok(await page.evaluate(() => document.getElementById('u-more-pop').hidden), 'menu starts closed');
        await page.locator('#u-more-btn').click();
        const menu = await page.evaluate(() => {
            const p = document.getElementById('u-more-pop');
            return { open: !p.hidden, expanded: document.getElementById('u-more-btn').getAttribute('aria-expanded'),
                items: [...p.querySelectorAll('button')].map(b => ({ t: b.textContent.replace(/[^A-Za-z]/g, ''), h: Math.round(b.getBoundingClientRect().height) })),
                inside: p.getBoundingClientRect().right <= document.getElementById('unified-submit-modal').firstElementChild.getBoundingClientRect().right + 1 };
        });
        assert.ok(menu.open && menu.expanded === 'true' && menu.inside, 'opens, inside the card: ' + JSON.stringify(menu));
        assert.deepEqual(menu.items.map(i => i.t), ['Drug', 'Disease', 'Product']);
        assert.ok(menu.items.every(i => i.h >= 44), 'rows ≥ 44px');
        await page.keyboard.press('Escape');
        assert.ok(await page.evaluate(() => document.getElementById('u-more-pop').hidden), 'Esc closes it');
        await page.locator('#u-more-btn').click();
        await page.locator('.type-btn[data-type="work"]').click();
        assert.ok(await page.evaluate(() => document.getElementById('u-more-pop').hidden), 'picking a type (outside click) closes it');
        await page.evaluate(() => selectSubmissionType('case'));
        await page.locator('#u-more-btn').click();
        await page.locator('#u-product-launcher').click();
        const prod = await page.evaluate(() => ({ closed: document.getElementById('u-more-pop').hidden, more: document.getElementById('u-more-btn').textContent.trim(), on: document.getElementById('u-more-btn').classList.contains('on'),
            pane: document.getElementById('case-pane-product').style.display, footer: document.getElementById('u-submit-btn').parentElement.style.display }));
        assert.ok(prod.closed && prod.on && /Product/.test(prod.more) && prod.pane === 'block' && prod.footer === 'none', 'Product: pane opens, ⋯ cell reads Product, footer row hides: ' + JSON.stringify(prod));
        await page.evaluate(() => selectSubmissionType('case'));
        assert.ok(!(await page.evaluate(() => document.getElementById('u-more-btn').classList.contains('on'))), '⋯ is off again');
        assert.ok(await page.evaluate(() => document.getElementById('u-more-btn').querySelector('i') !== null), '⋯ is back to the icon');

        // ---- Case form: HN + patient on ONE row, required star on HN, one-line note
        const form = await page.evaluate(() => {
            const a = document.getElementById('u-case-id').getBoundingClientRect(), b = document.getElementById('u-case-customer').getBoundingClientRect(), n = document.getElementById('u-case-note').getBoundingClientRect();
            const star = getComputedStyle(document.getElementById('u-case-id').parentElement, '::after');
            return { sameRow: Math.abs(a.top - b.top) < 3 && b.left > a.right, h: Math.round(a.height), noteH: Math.round(n.height), star: star.content, starColor: star.color, labelHidden: getComputedStyle(document.querySelector('label[for="u-case-id"]')).position === 'absolute' };
        });
        assert.ok(form.sameRow && form.h >= 44, 'HN + patient name share a row, 44px tall: ' + JSON.stringify(form));
        assert.ok(form.star.includes('*') && form.starColor === 'rgb(220, 38, 38)', 'red required star on HN');
        assert.ok(form.noteH <= 48 && form.labelHidden, 'note is one line, labels are screen-reader only');
        assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('u-case-note')).resize), 'none', 'no resize grip on the one-line note (inline resize:vertical must not win)');

        // ---- V101.132: Disease System = ONE dropdown, nothing chosen, nothing that nudges the choice (no counts, no colour levels)
        const sys = await page.evaluate(() => { const e = document.getElementById('u-case-system'); const r = e.getBoundingClientRect(); return { tag: e.tagName, visible: r.height >= 40 && getComputedStyle(e).display !== 'none', value: e.value, first: e.options[0].textContent, labels: [...e.options].map(o => o.textContent).join('|'), grid: !!document.getElementById('u-case-system-grid'), legend: !!document.querySelector('.sg-legend') }; });
        assert.ok(sys.tag === 'SELECT' && sys.visible, 'a visible dropdown: ' + JSON.stringify(sys));
        assert.equal(sys.value, '', 'nothing pre-selected'); assert.match(sys.first, /Select system/);
        assert.ok(!sys.grid && !sys.legend, 'the button grid and its green legend are gone');
        assert.ok(!/\d/.test(sys.labels), 'no case counts in the options: ' + sys.labels);
        // required = pale green, skippable = pale grey-blue
        const bg = await page.evaluate(() => Object.fromEntries(['u-case-id', 'u-case-system', 'u-case-customer', 'u-case-note'].map(i => [i, getComputedStyle(document.getElementById(i)).backgroundColor])));
        assert.equal(bg['u-case-id'], 'rgb(236, 253, 245)', 'HN: pale green'); assert.equal(bg['u-case-system'], 'rgb(236, 253, 245)', 'Disease System: pale green');
        assert.equal(bg['u-case-customer'], 'rgb(241, 245, 249)', 'patient name (optional): pale'); assert.equal(bg['u-case-note'], 'rgb(241, 245, 249)', 'note (optional): pale');
        // picking works and opens the symptoms
        await page.selectOption('#u-case-system', 'gi');
        assert.equal(await page.evaluate(() => document.getElementById('u-case-system').value), 'gi');
        assert.equal(await page.evaluate(() => document.getElementById('u-case-symptoms-section').style.display), 'block', 'symptoms follow the pick');

        // ---- V101.132: optional details — the tiles fold blocks open, only what is filled is collected, rights has an "other" box (V101.204: 5 tiles, + ⚠️ ADR)
        assert.equal(await page.evaluate(() => caseExtrasCollect()), null, 'nothing filled → nothing sent');
        const opt = await page.evaluate(() => {
            const o = {}; const hidden = id => document.getElementById(id).hidden;
            o.start = ['meds', 'labs', 'rights', 'appt', 'adr'].map(k => hidden('u-opt-' + k));
            document.querySelector('.u-opt-tile[data-opt="meds"]').click();
            o.medsOpen = !hidden('u-opt-meds'); o.medsRows = document.querySelectorAll('#u-opt-meds .u-opt-row').length;
            const r = document.querySelector('#u-opt-meds .u-opt-row').querySelectorAll('input'); r[0].value = ' Metformin '; r[1].value = '500 mg 2x/day'; r[0].dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('.u-opt-add[data-add="meds"]').click(); o.medsRows2 = document.querySelectorAll('#u-opt-meds .u-opt-row').length;   // the empty 2nd row must not be collected
            o.badge = [document.querySelector('.u-opt-tile[data-opt="meds"] .u-opt-n').textContent, document.querySelector('.u-opt-tile[data-opt="meds"]').classList.contains('has')];
            document.querySelector('.u-opt-tile[data-opt="labs"]').click(); const l = document.querySelector('#u-opt-labs .u-opt-row').querySelectorAll('input'); l[0].value = 'HbA1c'; l[1].value = '8.2 %'; l[0].dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('.u-opt-tile[data-opt="rights"]').click();
            o.chips = [...document.querySelectorAll('#u-opt-rights .u-opt-chip')].map(c => c.textContent);
            o.chipsVisibleEn = (() => { const blk = document.getElementById('u-opt-rights'), was = blk.hidden; blk.hidden = false; const v = [...blk.querySelectorAll('.u-opt-chip')].map(c => c.innerText.replace(/\s+/g, ' ').trim()); blk.hidden = was; return v; })();
            o.otherHidden0 = document.getElementById('u-opt-rights-other').hidden;
            document.querySelector('#u-opt-rights .u-opt-chip[data-v="other"]').click(); o.otherHidden1 = document.getElementById('u-opt-rights-other').hidden;
            document.getElementById('u-opt-rights-other').value = 'ประกันสังคม';
            document.querySelector('.u-opt-tile[data-opt="appt"]').click(); document.getElementById('u-opt-appt-date').value = '2026-10-26'; document.getElementById('u-opt-appt-place').value = 'อายุรกรรม';
            o.collected = JSON.parse(JSON.stringify(caseExtrasCollect()));
            document.querySelector('#u-opt-rights .u-opt-chip[data-v="other"]').click(); o.toggledOff = JSON.parse(JSON.stringify(caseExtrasCollect())).treatmentRights || null;   // tapping the chip again clears it
            caseExtrasReset(); o.afterReset = caseExtrasCollect(); o.resetClosed = ['meds', 'labs', 'rights', 'appt', 'adr'].map(k => hidden('u-opt-' + k));
            return o;
        });
        assert.deepEqual(opt.start, [true, true, true, true, true], 'all five blocks start folded');
        assert.ok(opt.medsOpen && opt.medsRows === 1, 'opening Medications adds the first row'); assert.equal(opt.medsRows2, 2);
        assert.deepEqual(opt.badge, ['1', true], 'badge counts filled rows only');
        assert.deepEqual(opt.chips.map(c => c.replace(/\s*[가-힯].*$/, '')), ['Gold card (UCS) บัตรทอง', 'Social Security (SSS) ประกันสังคม', 'Civil servant (CSMBS) ข้าราชการ', 'Private insurance ประกันเอกชน', 'Other อื่นๆ'], 'the five rights (V101.155: EN first, + Social Security)');
        assert.deepEqual(opt.chipsVisibleEn, ['Gold card (UCS)', 'Social Security (SSS)', 'Civil servant (CSMBS)', 'Private insurance', 'Other'], 'English mode shows a whole English label on every chip (no "(UCS)(UCS)" / blank chip): ' + JSON.stringify(opt.chipsVisibleEn));
        assert.ok(opt.otherHidden0 && !opt.otherHidden1, 'อื่นๆ shows a box to specify');
        assert.deepEqual(opt.collected, { medications: [{ name: 'Metformin', dose: '500 mg 2x/day' }], labResults: [{ test: 'HbA1c', value: '8.2 %' }], treatmentRights: { type: 'other', other: 'ประกันสังคม' }, appointment: { date: '2026-10-26', place: 'อายุรกรรม' } }, 'only filled things, trimmed');
        assert.equal(opt.toggledOff, null, 'a second tap clears the rights choice'); assert.equal(opt.afterReset, null, 'reset empties everything'); assert.deepEqual(opt.resetClosed, [true, true, true, true, true]);
        assert.ok(/\.\.\.caseExtras,\s*status: "pending"/.test(idx) && /\.\.\.caseExtras,\s*sourceType: 'cases'/.test(idx), 'the extras are written to the cases doc AND its submissions mirror');
        await page.selectOption('#u-case-system', '');

        // ---- V101.204: ⚠️ ADR / Naranjo — 5th tile, 10 questions as Yes / No / ? chips, live score + category, saved as one `adr` field
        const adr = await page.evaluate(() => {
            const o = {}, $ = id => document.getElementById(id), q = (n, a) => document.querySelector('#u-opt-adr .u-nq button[data-q="' + n + '"][data-a="' + a + '"]').click();
            o.tiles = [...document.querySelectorAll('#u-case-opt .u-opt-tile')].map(t => t.dataset.opt);
            o.hidden0 = $('u-opt-adr').hidden;
            document.querySelector('.u-opt-tile[data-opt="adr"]').click(); o.hidden1 = $('u-opt-adr').hidden;
            o.rows = document.querySelectorAll('#u-opt-adr .u-nq').length;
            o.oneLine = [...document.querySelectorAll('#u-opt-adr .u-nq .t')].map(t => [t.textContent.slice(0, 14), t.scrollWidth, t.clientWidth, Math.round(t.getBoundingClientRect().height)]);
            o.default = [$('u-opt-adr-score').querySelector('em').textContent, $('u-opt-adr-score').dataset.lv, [...document.querySelectorAll('#u-opt-adr .u-nq button[aria-pressed="true"]')].map(b => b.dataset.a).join('')];
            o.chipText = [...document.querySelectorAll('#u-opt-adr .u-nq:nth-child(3) button, #u-opt-adr .u-nq:nth-child(6) button')].map(b => b.textContent + '|' + b.getAttribute('aria-label'));
            o.nothingYet = caseExtrasCollect();            // the block open with every answer ? and nothing typed sends nothing
            q(0, 'y'); q(1, 'y'); q(2, 'y'); q(4, 'n');
            document.querySelector('.u-opt-tile[data-opt="meds"]').click(); const r = document.querySelector('#u-opt-meds .u-opt-row').querySelectorAll('input'); r[0].value = 'Amoxicillin'; r[0].dispatchEvent(new Event('input', { bubbles: true }));
            o.datalist = [...$('u-opt-adr-list').options].map(x => x.value);
            $('u-opt-adr-drug').value = ' Amoxicillin '; $('u-opt-adr-rx').value = 'ผื่นลมพิษ'; $('u-opt-adr-drug').dispatchEvent(new Event('input', { bubbles: true }));
            o.score = [$('u-opt-adr-score').querySelector('em').textContent, $('u-opt-adr-score').dataset.lv, $('u-opt-adr-score').querySelector('.lv').textContent, getComputedStyle($('u-opt-adr-score')).backgroundColor];
            o.badge = [document.querySelector('.u-opt-tile[data-opt="adr"] .u-opt-n').textContent, document.querySelector('.u-opt-tile[data-opt="adr"]').classList.contains('has')];
            r[0].value = ''; r[0].dispatchEvent(new Event('input', { bubbles: true }));   // drop the drug row so only ADR is filled
            o.collected = JSON.parse(JSON.stringify(caseExtrasCollect()));
            q(0, 'u'); o.scoreBack = $('u-opt-adr-score').querySelector('em').textContent;
            caseExtrasReset(); o.afterReset = [caseExtrasCollect(), $('u-opt-adr').hidden, $('u-opt-adr-score').querySelector('em').textContent, $('u-opt-adr-drug').value, document.querySelector('.u-opt-tile[data-opt="adr"] .u-opt-n').hidden];
            return o;
        });
        assert.deepEqual(adr.tiles, ['meds', 'labs', 'rights', 'appt', 'adr', 'log'], 'five tiles, ⚠️ ADR last, then the 📋 Daily log row');
        assert.ok(adr.hidden0 && !adr.hidden1 && adr.rows === 10, 'the ADR block folds open with the 10 Naranjo questions');
        assert.ok(adr.oneLine.every(x => x[1] <= x[2] + 1 && x[3] < 24), 'every question fits one line on the phone: ' + JSON.stringify(adr.oneLine));
        assert.deepEqual(adr.default, ['0', 'doubtful', 'uuuuuuuuuu'], 'every answer starts at ? (0) → 0 Doubtful');
        assert.deepEqual(adr.chipText, ['+2|Yes +2', '−1|No −1', '?|Unknown (0)', '−1|Yes −1', '+2|No +2', '?|Unknown (0)'], 'chips carry the per-question Naranjo points under one Yes · No · ? header (Q2, Q5)');
        assert.equal(adr.nothingYet, null, 'an open block with no answer and nothing typed sends nothing');
        assert.deepEqual(adr.datalist, ['Amoxicillin'], 'the suspected-drug list offers the Medications rows');
        assert.deepEqual(adr.score, ['6', 'probable', 'Probable · น่าจะใช่ · 가능성 높음', 'rgb(255, 251, 235)'], 'Q1 yes, Q2 yes, Q3 yes, Q5 no → 6 Probable, amber bar (the mockup sample)');
        assert.deepEqual(adr.badge, ['6', true], 'the tile badge shows the score');
        assert.deepEqual(adr.collected, { adr: { drug: 'Amoxicillin', reaction: 'ผื่นลมพิษ', answers: ['y', 'y', 'y', 'u', 'n', 'u', 'u', 'u', 'u', 'u'], score: 6, category: 'probable' } }, 'saved as one `adr` field, trimmed, nothing else');
        assert.equal(adr.scoreBack, '5', 'a chip tap re-scores at once');
        assert.deepEqual(adr.afterReset, [null, true, '0', '', true], 'reset folds the block and clears answers, score, drug and badge');
        // ---- V101.256: 📋 Daily log — folds open, only what is filled goes into one `dailyLog` field, reset clears it
        const dl = await page.evaluate(() => {
            const $ = i => document.getElementById(i), o = {}, tile = document.querySelector('.u-opt-tile[data-opt="log"]');
            o.closed = $('u-opt-log').hidden; tile.click(); o.open = !$('u-opt-log').hidden;
            o.ids = [...document.querySelectorAll('#u-opt-log .u-dl-row textarea')].map(t => t.id.replace('u-dl-', ''));
            o.empty = caseExtrasCollect();
            $('u-dl-cc').value = ' sneezing '; $('u-dl-all').value = 'NKDA'; $('u-dl-assessment').value = 'fits allergic rhinitis'; $('u-dl-all').dispatchEvent(new Event('input', { bubbles: true }));
            o.badge = [tile.querySelector('.u-opt-n').textContent, tile.classList.contains('has')];
            o.collected = JSON.parse(JSON.stringify(caseExtrasCollect()));
            caseExtrasReset(); o.after = [caseExtrasCollect(), $('u-opt-log').hidden, $('u-dl-cc').value];
            return o;
        });
        assert.deepEqual([dl.closed, dl.open], [true, true], 'the Daily log row folds its block');
        assert.deepEqual(dl.ids, ['pt', 'cc', 'hpi', 'pmh', 'ud', 'mh', 'all', 'drps', 'plan', 'assessment'], 'every column of the faculty table has a field');
        assert.equal(dl.empty, null, 'open but empty sends nothing');
        assert.deepEqual(dl.badge, ['✓', true], 'the row shows it holds data');
        assert.deepEqual(dl.collected, { dailyLog: { cc: 'sneezing', all: 'NKDA', assessment: 'fits allergic rhinitis' } }, 'only what is filled, trimmed');
        assert.deepEqual(dl.after, [null, true, ''], 'reset clears and folds it');
        // ---- V101.257: Daily log AI — fills only empty case fields, never Plan / Assessment; name + HN masked; 🔍 lists gaps and writes nothing; a failure leaves the form usable
        const dlai = await page.evaluate(async () => {
            const $ = i => document.getElementById(i), o = {}, calls = [], realFetch = window.fetch, realAuth = window.ensureFirebaseAuthReady;
            let reply = '', fail = false;
            window.ensureFirebaseAuthReady = async () => ({ getIdToken: async () => 't' });
            window.fetch = async (u, init) => { const b = JSON.parse(init.body); calls.push([u, b]); if (fail) return { ok: false, status: 500 }; return { ok: true, json: async () => ({ text: reply }) }; };
            document.querySelector('.u-opt-tile[data-opt="log"]').click();
            $('u-case-id').value = 'HN12345'; $('u-case-customer').value = 'สมศรี ใจดี';
            await $('u-dl-split').click(); o.noStory = [calls.length, $('u-dl-msg').dataset.kind];
            $('u-dl-story').value = 'คุณสมศรี HN12345 หญิง 34 ปี น้ำมูกใส'; $('u-dl-cc').value = 'typed by me';
            reply = '**PT:** หญิง 34 ปี\nCC: น้ำมูกใส\nHPI: 2 สัปดาห์\nPMH:\nU/D: -\nALL: NKDA\nPLAN: should never land\nASSESSMENT: nor this';
            $('u-dl-split').click(); await new Promise(r => setTimeout(r, 50));
            o.req = [calls[0][0].includes('callAIProxy'), calls[0][1].provider, calls[0][1].prompt.includes('HN12345'), calls[0][1].prompt.includes('สมศรี')];
            o.vals = ['pt', 'cc', 'hpi', 'pmh', 'ud', 'all', 'plan', 'assessment'].map(k => $('u-dl-' + k).value);
            o.lit = [$('u-dl-pt').classList.contains('ai'), $('u-dl-cc').classList.contains('ai')];
            $('u-dl-pt').dispatchEvent(new Event('input', { bubbles: true })); o.editedClears = $('u-dl-pt').classList.contains('ai');
            o.story = JSON.stringify(caseExtrasCollect()).includes('น้ำมูกใส HN') || 'story' in (caseExtrasCollect().dailyLog || {});
            calls.length = 0; $('u-dl-check').click(); await new Promise(r => setTimeout(r, 20)); o.checkEmpty = [calls.length, $('u-dl-hints').dataset.kind];
            $('u-dl-plan').value = 'Loratadine 10 mg'; reply = '- กำหนดติดตามอาการ\n- <b>red flags</b>\n- c\n- d\n- e';
            $('u-dl-check').click(); await new Promise(r => setTimeout(r, 50));
            o.hints = [...$('u-dl-hints').children].map(d => d.textContent); o.noHtml = $('u-dl-hints').querySelector('b') === null; o.planKept = [$('u-dl-plan').value, $('u-dl-assessment').value];
            fail = true; $('u-dl-pmh').value = ''; $('u-dl-split').click(); await new Promise(r => setTimeout(r, 50));
            o.failed = [$('u-dl-msg').dataset.kind, $('u-dl-split').disabled, $('u-dl-plan').value];
            caseExtrasReset(); o.reset = [$('u-dl-story').value, $('u-dl-msg').hidden, $('u-dl-hints').hidden, $('u-dl-cc').classList.contains('ai')];
            $('u-case-id').value = ''; $('u-case-customer').value = ''; window.fetch = realFetch; window.ensureFirebaseAuthReady = realAuth;
            return o;
        });
        assert.deepEqual(dlai.noStory, [0, 'err'], 'no story, no call');
        assert.deepEqual(dlai.req, [true, 'typhoon', false, false], 'Typhoon only, HN and patient name masked: ' + JSON.stringify(dlai.req));
        assert.deepEqual(dlai.vals, ['หญิง 34 ปี', 'typed by me', '2 สัปดาห์', '', '', 'NKDA', '', ''], 'fills empty case fields only, empties stay empty, never Plan / Assessment: ' + JSON.stringify(dlai.vals));
        assert.deepEqual(dlai.lit, [true, false], 'AI-filled fields are marked'); assert.equal(dlai.editedClears, false, 'an edit clears the mark');
        assert.equal(dlai.story, false, 'the story is not saved');
        assert.deepEqual(dlai.checkEmpty, [0, 'err'], 'nothing written, no check call');
        assert.equal(dlai.hints.length, 4, 'at most four gaps'); assert.ok(dlai.noHtml, 'hints are text, never HTML');
        assert.deepEqual(dlai.planKept, ['Loratadine 10 mg', ''], '🔍 changes nothing the intern wrote');
        assert.deepEqual(dlai.failed, ['err', false, 'Loratadine 10 mg'], 'a failure says so, re-enables, keeps the form');
        assert.deepEqual(dlai.reset, ['', true, true, false], 'reset clears story, message, hints, marks');
        if (process.env.SHOT) {   // the ADR block open with the mockup sample (for before/after bundles), then reset again
            await page.evaluate(() => { const q = (n, a) => document.querySelector('#u-opt-adr .u-nq button[data-q="' + n + '"][data-a="' + a + '"]').click(); document.querySelector('.u-opt-tile[data-opt="adr"]').click(); q(0, 'y'); q(1, 'y'); q(2, 'y'); q(4, 'n'); document.getElementById('u-opt-adr-drug').value = 'Amoxicillin'; document.getElementById('u-opt-adr-rx').value = 'ผื่นลมพิษ'; document.getElementById('u-opt-adr-drug').dispatchEvent(new Event('input', { bubbles: true })); });
            await page.locator('#u-case-opt').screenshot({ path: path.join(process.env.SHOT, 'case_adr_open.png') });
            await page.evaluate(() => caseExtrasReset());
        }

        // ---- required fields: red frame + scrolled into view, cleared when touched
        await page.evaluate(() => { document.getElementById('u-case-id').value = ''; document.getElementById('u-case-system').value = ''; });
        const r1 = await page.evaluate(async () => { try { await submitUnifiedCase(); return 'no throw'; } catch (e) { return e.message; } });
        assert.ok(/Case No\. is required/.test(r1), 'toast text unchanged: ' + r1);
        assert.ok(await page.evaluate(() => document.getElementById('u-case-id').classList.contains('u-err')), 'HN gets the red frame');
        await page.locator('#u-case-id').fill('12345');
        assert.ok(!(await page.evaluate(() => document.getElementById('u-case-id').classList.contains('u-err'))), 'typing clears it');
        const r2 = await page.evaluate(async () => { try { await submitUnifiedCase(); return 'no throw'; } catch (e) { return e.message; } });
        assert.ok(/disease system/.test(r2), 'then the system is asked for: ' + r2);
        assert.ok(await page.evaluate(() => document.getElementById('u-case-system').classList.contains('u-err')), 'the dropdown gets the red frame');

        // ---- footer: only Submit, and it stays reachable mid-form on a short screen (keyboard up)
        assert.equal(await page.locator('#u-submit-btn').count(), 1);
        assert.ok(!/Cancel/.test(await page.evaluate(() => document.querySelector('#u-submit-btn').parentElement.innerText)), 'no Cancel in the footer');
        await page.setViewportSize({ width: 390, height: 520 });
        await page.waitForTimeout(250);
        await page.evaluate(() => { const g = document.getElementById('u-case-system'); let e = g; while (e && !(e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e = e.parentElement; if (e) e.scrollTop = 140; });
        await page.waitForTimeout(200);
        const vis = await page.evaluate(() => { const r = document.getElementById('u-submit-btn').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
        assert.ok(vis, 'Submit is on screen without scrolling to the end');
        await page.setViewportSize({ width: 390, height: 800 });

        // ---- other pieces still work: ✕ closes, Product hides the footer row, no sideways scroll
        await page.evaluate(() => selectSubmissionType('product'));
        assert.equal(await page.evaluate(() => document.getElementById('u-submit-btn').parentElement.style.display), 'none', 'Product composer has its own submit');
        await page.evaluate(() => selectSubmissionType('case'));
        assert.equal(await page.evaluate(() => document.getElementById('u-submit-btn').parentElement.style.display), 'flex');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no sideways scroll');
        if (process.env.SHOT) {
            await page.evaluate(() => { const e = document.getElementById('u-case-system'); e.classList.remove('u-err'); e.value = ''; document.getElementById('unified-submit-modal').firstElementChild.scrollTop = 0; });
            const card = await page.evaluate(() => { const r = document.getElementById('unified-submit-modal').firstElementChild.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
            await page.screenshot({ path: path.join(process.env.SHOT, 'submit_new_real.png'), clip: { x: card.x, y: card.y, width: card.w, height: card.h } });
        }
        await page.locator('.u-line .u-x').click();
        assert.equal(await page.evaluate(() => document.getElementById('unified-submit-modal').style.display), 'none', '✕ closes the dialog');
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: Submit New lean — no header/label, ✕ in the launchers row, inline HN + patient, one-line note, Disease System = one unbiased dropdown, required = pale green / optional = pale, optional details (meds / labs / rights / appointment / ⚠️ ADR Naranjo: 10 questions, live score, saved as `adr`), red frame on a missing field, Submit pinned (no Cancel)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
