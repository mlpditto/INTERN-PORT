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

        // ---- heat grid
        const lv = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#u-case-system-grid button')].map(b => [b.dataset.system, { lv: b.dataset.lv, n: (b.querySelector('.sg-n') || {}).textContent || '', title: b.title }])));
        assert.deepEqual(Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, v.lv])), { respiratory: '3', cardio: '2', gi: '1', neuro: '0', ent: '0', skin: '0', msk: '0', endocrine: '0', mental: '0', other: '0' }, 'levels follow the counts (7 → 3, 3 → 2, 1 → 1, none → 0)');
        assert.equal(lv.respiratory.n, '7', 'rejected case is not counted'); assert.equal(lv.cardio.n, '3', 'pending counts'); assert.equal(lv.neuro.n, '', 'no badge at 0');
        assert.equal(lv.gi.title, '1 case sent'); assert.equal(lv.neuro.title, 'none yet');
        const lum = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#u-case-system-grid button')].map(b => [b.dataset.system, getComputedStyle(b).backgroundColor])));
        assert.ok(hsl(lum.respiratory) < hsl(lum.cardio) && hsl(lum.cardio) < hsl(lum.gi), 'more cases = deeper green: ' + JSON.stringify(lum));
        assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#u-case-system-grid button[data-system="neuro"]')).filter.includes('grayscale')), 'unsent = grey');
        // picking still works; the count survives a re-render
        await page.locator('#u-case-system-grid button[data-system="gi"]').click();
        assert.equal(await page.evaluate(() => document.getElementById('u-case-system').value), 'gi');
        assert.equal(await page.locator('#u-case-system-grid button[data-system="gi"] .sg-n').textContent(), '1');

        // ---- required fields: red frame + scrolled into view, cleared when touched
        await page.evaluate(() => { document.getElementById('u-case-id').value = ''; document.getElementById('u-case-system').value = ''; renderSubmitSystemGrid(); });
        const r1 = await page.evaluate(async () => { try { await submitUnifiedCase(); return 'no throw'; } catch (e) { return e.message; } });
        assert.ok(/Case No\. is required/.test(r1), 'toast text unchanged: ' + r1);
        assert.ok(await page.evaluate(() => document.getElementById('u-case-id').classList.contains('u-err')), 'HN gets the red frame');
        await page.locator('#u-case-id').fill('12345');
        assert.ok(!(await page.evaluate(() => document.getElementById('u-case-id').classList.contains('u-err'))), 'typing clears it');
        const r2 = await page.evaluate(async () => { try { await submitUnifiedCase(); return 'no throw'; } catch (e) { return e.message; } });
        assert.ok(/disease system/.test(r2), 'then the system is asked for: ' + r2);
        assert.ok(await page.evaluate(() => document.getElementById('u-case-system-grid').classList.contains('u-err')), 'the grid gets the red frame');

        // ---- footer: only Submit, and it stays reachable mid-form on a short screen (keyboard up)
        assert.equal(await page.locator('#u-submit-btn').count(), 1);
        assert.ok(!/Cancel/.test(await page.evaluate(() => document.querySelector('#u-submit-btn').parentElement.innerText)), 'no Cancel in the footer');
        await page.setViewportSize({ width: 390, height: 520 });
        await page.waitForTimeout(250);
        await page.evaluate(() => { const g = document.getElementById('u-case-system-grid'); let e = g; while (e && !(e.scrollHeight > e.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(e).overflowY))) e = e.parentElement; if (e) e.scrollTop = 140; });
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
            await page.evaluate(() => { const e = document.getElementById('u-case-system-grid'); e.classList.remove('u-err'); document.getElementById('u-case-system').value = ''; renderSubmitSystemGrid(); document.getElementById('unified-submit-modal').firstElementChild.scrollTop = 0; });
            const card = await page.evaluate(() => { const r = document.getElementById('unified-submit-modal').firstElementChild.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
            await page.screenshot({ path: path.join(process.env.SHOT, 'submit_new_real.png'), clip: { x: card.x, y: card.y, width: card.w, height: card.h } });
        }
        await page.locator('.u-line .u-x').click();
        assert.equal(await page.evaluate(() => document.getElementById('unified-submit-modal').style.display), 'none', '✕ closes the dialog');
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: Submit New lean — no header/label, ✕ in the launchers row, inline HN + patient, one-line note, Disease System coloured by cases sent (rejected not counted), red frame on a missing field, Submit pinned (no Cancel)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
