// V101.97: DD Codex (intern home) is lean — ONE row for the Drugs / Diseases chips + a My Drafts icon; the A–Z rail is one swipeable line on a phone (blue gets stronger with the count, numbers stay on wide screens),
// letters nothing starts with are not drawn (a letter that only misses the current search stays, disabled); no heading when ONE letter is the page; shorter search placeholders.
// The REAL public/index.html on a touch phone and on a wide screen (file://, network blocked, Firebase stubbed, sample data). SHOT=<dir> writes PNGs.
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;
const idx = fs.readFileSync('public/index.html', 'utf8');
assert.ok(/<title>Internship Portfolio \(V101\.\d+\)<\/title>/.test(idx), 'intern version present');
assert.ok(!idx.includes('📝 My Drafts <span class="dc-view-tab-badge">'), 'the My Drafts button is icon-only');

async function open(browser, w, h) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 600, hasTouch: w < 600 });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), onSnapshot: () => () => {} }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0 } }) };
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    });
    await page.waitForTimeout(900);
    await page.evaluate(() => {
        const counts = { A: 12, B: 5, C: 8, D: 13, E: 6, F: 7, G: 2, H: 2, I: 3, K: 2, L: 7, M: 11, N: 4, O: 5, P: 10, Q: 1, R: 8, S: 8, T: 5, U: 1, V: 3 };   // no J, W, X, Y, Z
        const codex = []; let id = 0;
        for (const [L, n] of Object.entries(counts)) for (let i = 0; i < n; i++) codex.push({ _id: 'd' + (id++), genericName: L + 'drug' + i, brandNames: ['Brand' + L + i], atcCode: 'A0' + (i % 9) + 'BC0' + (i % 7), class: 'Class ' + (i % 4), status: 'published' });
        dcState.codex = codex; dcState.loaded = true;
        const dcounts = { A: 6, B: 3, C: 7, D: 5, E: 4, G: 3, H: 6, I: 3, M: 5, P: 7, R: 4, S: 5, T: 3 }; const dxc = []; let k = 0;
        for (const [L, n] of Object.entries(dcounts)) for (let i = 0; i < n; i++) dxc.push({ _id: 'x' + (k++), diseaseName: L + 'disease' + i, thaiName: 'โรค', icd10: 'J4' + (i % 9), category: 'Cat', status: 'published' });
        dxState.codex = dxc; dxState.loaded = true;
        dcMyDraftsState.drafts = [{ _id: 'a1', genericName: 'D1', status: 'pending' }, { _id: 'a2', genericName: 'D2', status: 'pending' }];
        dxMyDraftsState.drafts = [];
        window.dcSwitchView = view => { document.getElementById('dc-view-browse').style.display = view === 'browse' ? '' : 'none'; document.getElementById('dc-view-mydrafts').style.display = view === 'mydrafts' ? '' : 'none'; dcRefreshDraftsToggle(); };
        window.dxSwitchView = view => { document.getElementById('dx-view-browse').style.display = view === 'browse' ? '' : 'none'; document.getElementById('dx-view-mydrafts').style.display = view === 'mydrafts' ? '' : 'none'; dxRefreshDraftsToggle(); };
        document.getElementById('dc-count-badge').textContent = String(codex.length); document.getElementById('dc-count-badge').style.display = 'inline';
        document.getElementById('dx-count-badge').textContent = String(dxc.length); document.getElementById('dx-count-badge').style.display = 'inline';
        toggleDDCodex();
        dcRenderList(); dcRefreshDraftsToggle(); dxRefreshDraftsToggle();
    });
    await page.waitForTimeout(300);
    return { page, errors, ctx };
}
const vis = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }, sel);
const railInfo = (page, id) => page.evaluate(id => {
    const rail = document.getElementById(id), ls = [...rail.querySelectorAll('.dc-az-letter')];
    const tops = [...new Set(ls.map(l => Math.round(l.getBoundingClientRect().top)))];
    return { letters: ls.map(l => l.firstChild.textContent.trim()), rows: tops.length, h: Math.round(rail.getBoundingClientRect().height), scrolls: rail.scrollWidth > rail.clientWidth + 2, scrollLeft: Math.round(rail.scrollLeft),
        counts: ls.map(l => { const c = l.querySelector('.dc-az-letter-count'); return c ? (getComputedStyle(c).display === 'none' ? 'hidden:' + c.textContent : c.textContent) : null; }),
        bg: ls.map(l => getComputedStyle(l).backgroundColor), disabled: ls.filter(l => l.disabled).map(l => l.firstChild.textContent.trim()), minH: Math.min(...ls.map(l => l.getBoundingClientRect().height)),
        activeInView: (() => { const a = rail.querySelector('.active'); if (!a) return null; const r = a.getBoundingClientRect(), rr = rail.getBoundingClientRect(); return r.left >= rr.left - 1 && r.right <= rr.right + 1; })(), allChip: ls[0].textContent.trim(), allTitle: ls[0].title };
}, id);
const firstRowTop = page => page.evaluate(() => { const top = document.getElementById('dd-codex-header').getBoundingClientRect().top, row = [...document.querySelectorAll('#dc-list .dc-row, #dx-list .dc-row')].find(e => e.getClientRects().length); return row ? Math.round(row.getBoundingClientRect().top - top) : null; });

(async () => {
    const browser = await chromium.launch();
    try {
        // ================= PHONE =================
        for (const W of [390, 360]) {
            const { page, errors, ctx } = await open(browser, W, 844);
            // ---- 1. one row: chips + My Drafts icon
            const t = await page.evaluate(() => {
                const tabs = document.getElementById('dd-type-tabs'), tr = tabs.getBoundingClientRect(), r = id => document.getElementById(id).getBoundingClientRect();
                const drugs = tabs.querySelector('[data-ddtype=drug]').getBoundingClientRect(), dis = tabs.querySelector('[data-ddtype=disease]').getBoundingClientRect(), dr = r('dc-drafts-toggle'), dx = document.getElementById('dx-drafts-toggle');
                const btn = document.getElementById('dc-drafts-toggle');
                return { h: Math.round(tr.height), sameRow: Math.abs(drugs.top - dis.top) < 3 && Math.abs(drugs.top - dr.top) < 14, drugsRight: Math.round(drugs.right), disLeft: Math.round(dis.left), drRight: Math.round(dr.right), tabsRight: Math.round(tr.right), drW: Math.round(dr.width), drH: Math.round(dr.height), drText: btn.textContent.replace(/\s+/g, ' ').trim(), title: btn.title, aria: btn.getAttribute('aria-label'), dxShown: getComputedStyle(dx).display !== 'none', drugBadge: document.getElementById('dc-count-badge').textContent, type: tabs.dataset.type, minChipH: Math.min(drugs.height, dis.height) };
            });
            assert.ok(t.sameRow && t.h <= 56, `@${W}: chips and My Drafts on ONE row ≤ 56px: ` + JSON.stringify(t));
            assert.ok(t.drRight <= t.tabsRight - 4 && t.drugsRight <= t.disLeft + 1, `@${W}: nothing overflows the row: ` + JSON.stringify(t));
            assert.ok(t.drText === '📝2' && t.title === 'My Drafts' && /My Drafts \(2\)/.test(t.aria), `@${W}: icon + count, words in title / aria: ` + JSON.stringify(t));
            assert.ok(t.drH >= 30 && t.minChipH >= 34, `@${W}: touch-sized: ` + JSON.stringify(t));
            assert.equal(t.dxShown, false, 'only the open codex\'s My Drafts icon (drugs open; diseases has none)');
            assert.equal(t.type, 'drug');
            // the icon swaps to ← Browse inside the drafts view and back
            await page.locator('#dc-drafts-toggle').click();
            let d = await page.evaluate(() => ({ html: document.getElementById('dc-drafts-toggle').innerHTML, title: document.getElementById('dc-drafts-toggle').title, drafts: document.getElementById('dc-view-mydrafts').style.display !== 'none' }));
            assert.ok(/fa-arrow-left/.test(d.html) && d.title === 'Back to Browse' && d.drafts, 'in drafts: ← Browse: ' + JSON.stringify(d));
            await page.locator('#dc-drafts-toggle').click();
            assert.equal(await page.evaluate(() => document.getElementById('dc-drafts-toggle').textContent.trim()), '📝2', 'back in Browse: the icon + 2');
            // diseases: its own (here empty) drafts → no icon; give it one → ITS count, not the drug one
            await page.locator('.dd-type-tab[data-ddtype=disease]').click();
            await page.evaluate(() => { dxMyDraftsState.drafts = [{ _id: 'z1', diseaseName: 'X', status: 'pending' }]; dxRefreshDraftsToggle(); dxRenderList(); });
            d = await page.evaluate(() => ({ dc: getComputedStyle(document.getElementById('dc-drafts-toggle')).display, dx: getComputedStyle(document.getElementById('dx-drafts-toggle')).display, dxText: document.getElementById('dx-drafts-toggle').textContent.trim(), type: document.getElementById('dd-type-tabs').dataset.type }));
            assert.deepEqual(d, { dc: 'none', dx: 'flex', dxText: '📝1', type: 'disease' }, 'Diseases tab: its own My Drafts (1), the drug one is hidden');
            await page.locator('.dd-type-tab[data-ddtype=drug]').click();
            await page.evaluate(() => { dcRenderList(); });

            // ---- 2. the rail on a phone: one line, only letters that exist, tint instead of numbers
            let r = await railInfo(page, 'dc-az-rail');
            assert.equal(r.rows, 1, `@${W}: the rail is ONE line: ` + JSON.stringify({ rows: r.rows, h: r.h }));
            assert.ok(r.scrolls && r.h <= 50, `@${W}: swipeable, ≤ 50px (was 117): ` + r.h);
            for (const gone of ['J', 'W', 'X', 'Y', 'Z']) assert.ok(!r.letters.includes(gone), 'a letter nothing starts with is not drawn: ' + gone);
            assert.equal(r.letters.length, 1 + 21, 'All + the 21 letters that exist');
            assert.ok(r.counts.slice(1).every(c => c && c.startsWith('hidden:')), 'numbers are hidden on a phone');
            assert.equal(r.allChip, 'All', '"All" carries no number (the tab badge says 123)');
            const bgA = r.bg[r.letters.indexOf('A')], bgQ = r.bg[r.letters.indexOf('Q')], bgD = r.bg[r.letters.indexOf('D')];
            assert.ok(bgA !== bgQ && bgD !== bgQ, `more drugs → stronger blue (A/12 ≠ Q/1, D/13 ≠ Q/1): ${bgA} ${bgD} ${bgQ}`);
            assert.ok(r.minH >= 34, 'chips ≥ 34px tall: ' + r.minH);
            assert.equal(await page.evaluate(() => document.querySelector('#dc-az-rail .dc-az-letter[title^="12 drugs"]').title), '12 drugs starting with A', 'the number lives in the tooltip');
            // choosing a far letter scrolls it into the rail's view; the heading goes
            const heads = () => page.evaluate(() => [...document.querySelectorAll('#dc-list .dc-letter-heading')].filter(e => e.getClientRects().length).length);
            assert.ok(await heads() > 1, 'All: a heading per letter');
            await page.locator('#dc-az-rail .dc-az-letter[onclick*="V"]').click();
            r = await railInfo(page, 'dc-az-rail');
            assert.deepEqual([r.activeInView, r.scrollLeft > 0], [true, true], `@${W}: the chosen letter V is scrolled into view: ` + JSON.stringify({ a: r.activeInView, s: r.scrollLeft }));
            assert.equal(await heads(), 0, 'one letter = the page: no heading');
            assert.equal(await page.locator('#dc-list .dc-row').count(), 3, 'V has 3 drugs');
            // searching: the filter is suspended (All active), headings are back, missing letters are disabled but STAY
            await page.locator('#dc-search-input').fill('Adrug1');
            await page.waitForTimeout(150);
            r = await railInfo(page, 'dc-az-rail');
            assert.ok(r.letters.length === 22 && r.disabled.includes('B') && !r.disabled.includes('A'), 'a letter that only misses the search stays (disabled): ' + JSON.stringify(r.disabled.slice(0, 5)));
            assert.ok(await heads() >= 1, 'while searching the headings are back');
            await page.locator('#dc-search-input').fill('');
            await page.evaluate(() => dcSelectLetter('all'));
            // ---- 5. placeholders + position of the first drug
            assert.equal(await page.locator('#dc-search-input').getAttribute('placeholder'), '🔍 Name, brand, ATC…');
            assert.equal(await page.locator('#dx-search-input').getAttribute('placeholder'), '🔍 Disease, Thai name, ICD-10…');
            const first = await firstRowTop(page);
            assert.ok(first !== null && first <= 235, `@${W}: the first drug is at y=${first} from the card top (was 353)`);
            await page.evaluate(() => dcSelectLetter('D'));
            assert.ok((await firstRowTop(page)) <= 190, 'with one letter chosen the first drug is even higher');
            await page.evaluate(() => dcSelectLetter('all'));
            // ---- the Diseases rail works the same
            await page.locator('.dd-type-tab[data-ddtype=disease]').click();
            await page.evaluate(() => dxRenderList());
            r = await railInfo(page, 'dx-az-rail');
            assert.ok(r.rows === 1 && r.letters.length === 1 + 13 && !r.letters.includes('F'), 'Diseases rail: one line, only its 13 letters: ' + JSON.stringify([r.rows, r.letters.length]));
            assert.equal((await railInfo(page, 'dx-az-rail')).allChip, 'All');
            await page.evaluate(() => dxSelectLetter('M'));
            assert.equal(await page.evaluate(() => [...document.querySelectorAll('#dx-list .dc-letter-heading')].filter(e => e.getClientRects().length).length), 0, 'Diseases: no heading for one letter');
            assert.equal(await page.evaluate(() => document.getElementById('dd-codex-card').scrollWidth <= document.getElementById('dd-codex-card').clientWidth + 1), true, `@${W}: no sideways scroll in the card`);
            if (process.env.SHOT && W === 390) {
                await page.evaluate(() => { dxSelectLetter('all'); document.querySelector('.dd-type-tab[data-ddtype=drug]').click(); dcSelectLetter('all'); document.getElementById('dd-codex-card').scrollIntoView(); });
                await page.waitForTimeout(200);
                await page.screenshot({ path: path.join(process.env.SHOT, 'dd_phone_all.png') });
                await page.evaluate(() => { dcSelectLetter('D'); });
                await page.waitForTimeout(200);
                await page.screenshot({ path: path.join(process.env.SHOT, 'dd_phone_D.png') });
            }
            assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
            await ctx.close();
        }

        // ================= WIDE SCREEN =================
        const { page, errors, ctx } = await open(browser, 900, 760);
        let r = await railInfo(page, 'dc-az-rail');
        assert.ok(r.rows >= 1 && r.rows <= 2 && !r.scrolls, 'wide: the rail wraps, no swiping: ' + JSON.stringify({ rows: r.rows, scrolls: r.scrolls }));
        assert.ok(r.counts.slice(1).every((c, i) => c && /^\d+$/.test(c)), 'wide: the number is back on every letter: ' + JSON.stringify(r.counts.slice(0, 6)));
        assert.equal(r.counts[0], null, 'wide: "All" still has no number (the tab badge says it)');
        assert.equal(r.counts[r.letters.indexOf('A')], '12');
        assert.equal(new Set(r.bg.slice(1)).size, 1, 'wide: flat chips (no tint — the number already says it): ' + [...new Set(r.bg)]);
        assert.ok(r.minH <= 30, 'wide: compact chips ≤ 30px: ' + r.minH);
        assert.ok(!r.letters.includes('J') && r.letters.length === 22, 'wide: letters nothing starts with are not drawn');
        const first = await firstRowTop(page);
        assert.ok(first <= 262, `wide: the first drug is at y=${first} (was 298)`);
        await page.locator('#dc-search-input').fill('Adrug1');
        await page.waitForTimeout(150);
        r = await railInfo(page, 'dc-az-rail');
        assert.ok(r.counts[r.letters.indexOf('A')] === '3' && r.counts[r.letters.indexOf('B')] === null, 'wide: the numbers follow the search (A has 3 matches, B none): ' + JSON.stringify(r.counts.slice(0, 4)));
        if (process.env.SHOT) { await page.locator('#dc-search-input').fill(''); await page.evaluate(() => { dcSelectLetter('all'); document.getElementById('dd-codex-card').scrollIntoView(); }); await page.waitForTimeout(200); await page.screenshot({ path: path.join(process.env.SHOT, 'dd_wide.png') }); }
        assert.deepEqual(errors.filter(e => !/firebase\./.test(e)), [], 'no page errors');
        await ctx.close();
        console.log('PASS: DD Codex lean — one row (chips + My Drafts icon with its own codex\'s count, ← Browse in the drafts view), phone rail = one swipeable line with only existing letters + tint, numbers on wide screens, no heading for one letter, short placeholders; Drugs and Diseases; 390 / 360 / 900');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
