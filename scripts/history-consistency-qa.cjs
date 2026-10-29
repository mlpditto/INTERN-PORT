// V101.189 (PR A) — History reads as ONE feature: the row date, the bucket labels and the status pills follow the UI language
// (EN "20 Oct" · TH "20 ต.ค." · KR "10월 20일"), the 🩺 sub-row chips carry their names and the chosen type chip its word,
// the case disc and the 📎 summary have accessible names, an admin's decorative emoji stays out of an article title in the
// list, rows get a hover/active background, chips and icon buttons are 44 px on touch, the pt / 🪙 wash text passes AA,
// ⋯ offers "📊 My Cases", and a language change redraws the list. Real index.html + history-lean/compact + articles.js.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = require('url').pathToFileURL(path.join(process.cwd(), 'public/index.html')).href;

async function open(browser) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        const q = () => ({ where: q, orderBy: q, limit: q, get: async () => ({ docs: [], size: 0, empty: true, forEach() {} }), onSnapshot: () => () => {}, doc: () => ({ get: async () => ({ exists: false, data: () => null }), onSnapshot: () => () => {}, set: async () => {}, update: async () => {}, collection: q }) });
        const db = { collection: q, batch: () => ({ set() {}, update() {}, commit: async () => {} }), runTransaction: async () => {}, enablePersistence: async () => {}, settings() {} };
        window.firebase = new Proxy(function () {}, { get: (t, k) => { if (k === 'firestore') { const f = () => db; f.FieldValue = any; f.Timestamp = any; return f; } return k === 'then' ? undefined : any; }, apply: () => any });
    });
    await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
    await page.goto(INDEX, { waitUntil: 'load' });
    await page.evaluate(() => {
        document.getElementById('main-app').style.setProperty('display', 'block', 'important');
        const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
        const sec = document.getElementById('section-general-work'); if (sec) { document.body.append(sec); sec.style.display = 'block'; }
        const c = document.getElementById('work-section-content'); if (c) c.style.display = 'block';
    });
    await page.waitForTimeout(500);
    return { page, errors, ctx };
}

(async () => {
    const browser = await chromium.launch();
    try {
        const { page, errors, ctx } = await open(browser);
        const r = await page.evaluate(() => {
            const out = {};
            const d = new Date(2026, 9, 20, 14, 5), old = new Date(2025, 5, 13, 9, 0);
            const setLang = l => { document.body.classList.toggle('lang-th-on', l === 'th'); document.body.classList.toggle('lang-kr-on', l === 'kr'); };
            // 1) one formatter, three languages
            out.dates = {};
            ['en', 'th', 'kr'].forEach(l => { setLang(l); out.dates[l] = [window.formatUiDate(d), window.formatUiDate(old, { year: '2-digit' }), window.formatUiDate(d, { time: true })]; });
            setLang('en');
            // the list: a case (nth 1), a quiz with 2 files (one seen), an article whose title ends with an admin emoji, a pending work item
            const D = n => new Date(Date.now() - n * 86400000), ts = n => ({ toMillis: () => D(n).getTime(), toDate: () => D(n), seconds: Math.floor(D(n) / 1000) });
            const mk = (id, type, title, n, extra) => Object.assign({ id, submissionType: type, title, timestamp: ts(n), status: 'approved', score: 1, metadata: {} }, extra || {});
            window.userId = 'U1';
            const items = [
                mk('c1', 'case', 'HN 26-26870', 1, { metadata: { caseId: '26-26870', diseaseSystemKey: 'cardio' } }),
                mk('q1', 'quiz', 'Allergic Rhinitis-2', 2, { quizId: 'z1', score: 1.2 }),
                mk('a1', 'article', 'Acromegaly: Spotting the Subtle Signs 🔍', 0, { status: 'article', noDelete: true, metadata: { articleId: 'A1', emoji: '📰', state: 'new', saved: false } }),
                mk('w1', 'work', 'A work item', 9, { status: 'pending', score: 0 }),
            ];
            quizzesCache = [{ id: 'z1', title: 'Allergic Rhinitis-2', isActive: true, materials: [{ name: 'Slides', url: 'https://x.test/a.pdf' }, { name: 'Notes', url: 'https://x.test/b.pdf' }] }];
            unifiedSubmissionsCache = items; getUnifiedAllItems = () => items; unifiedRenderedCount = 50;
            if (window.internArticles) internArticles.historyItems = () => [];
            window.getReflectiveStreak = () => ({ current: 1, longest: 1 });
            const render = () => { try { renderUnifiedHistory(); } catch (e) { if (!/firebase\./.test(e.message)) throw e; } };
            render();
            const tl = document.getElementById('unified-timeline');
            const texts = sel => [...tl.querySelectorAll(sel)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
            out.labelsEn = texts('.hl-lbl'); out.titles = texts('.hl-tt'); out.pillsEn = texts('.hl-pill');
            const disc = tl.querySelector('.hl-disc[role="img"]'); out.discAria = disc && disc.getAttribute('aria-label');
            const mat = tl.querySelector('.hl-matpick summary'); out.matAria = mat && mat.getAttribute('aria-label');
            out.rowAria = [...tl.querySelectorAll('.hl-row')].every(r => r.getAttribute('role') === 'listitem' && r.getAttribute('tabindex') === '0' && r.hasAttribute('aria-expanded'));
            out.pt = getComputedStyle(tl.querySelector('.hl-pt')).color;
            // 2) the chip rail: chosen type shows its word; 🩺 sub-row chips carry names
            out.chipAll = [...document.querySelectorAll('#unified-type-filters .hl-chip')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
            filterUnifiedHistory('case');
            out.chipCase = [...document.querySelectorAll('#unified-type-filters .hl-chip')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
            out.sub = [...document.querySelectorAll('#unified-case-systems .hl-chip')].map(b => b.textContent.replace(/\s+/g, ' ').trim());
            // V101.233: the ⏳ count follows the chosen type — it used to say 1 under a type with nothing pending
            out.pendScope = [...document.querySelectorAll('#unified-type-filters .hl-chip[data-filter]')].map(b => b.dataset.filter).filter(k => k !== 'all').map(k => {
                filterUnifiedHistory(k);
                const w = document.querySelector('#unified-type-filters .hl-warn');
                return [k, w ? Number(w.textContent.replace(/\D/g, '')) : 0, items.filter(s => s.submissionType === k && (s.status === 'pending' || s.status === 'รอตรวจ')).length];
            });
            filterUnifiedHistory('all');
            // 3) touch targets (this context is a touch phone → pointer:coarse)
            const chip = document.querySelector('#unified-type-filters .hl-chip'), ib = document.querySelector('.hl-tools .hl-ib');
            out.chipH = Math.round(chip.getBoundingClientRect().height); out.ibWH = Math.round(ib.getBoundingClientRect().width) + 'x' + Math.round(ib.getBoundingClientRect().height);
            // 4) ⋯ offers My Cases
            const more = document.querySelector('.hl-more'); more.open = true;
            const cases = more.querySelector('.hl-pop-cases'); out.casesBtn = cases && cases.textContent; out.casesTh = cases && cases.dataset.thTitle;
            let opened = 0; window.openCaseInsights = () => { opened++; }; cases.click(); out.casesOpened = opened; out.moreClosedAfter = !more.open;
            // 6) a language change redraws: labels, pills and dates in Thai, then Korean
            setLang('th'); document.dispatchEvent(new CustomEvent('lang-changed'));
            out.labelsTh = texts('.hl-lbl'); out.pillsTh = texts('.hl-pill'); out.dateTh = texts('.hl-mt > span:first-child');
            setLang('kr'); document.dispatchEvent(new CustomEvent('lang-changed'));
            out.labelsKr = texts('.hl-lbl'); out.dateKr = texts('.hl-mt > span:first-child');
            setLang('en'); document.dispatchEvent(new CustomEvent('lang-changed'));
            out.dateEn = texts('.hl-mt > span:first-child');
            return out;
        });
        assert.deepEqual(r.dates.en, ['20 Oct', '13 Jun 25', '20 Oct 14:05'], 'EN: ' + r.dates.en);
        assert.deepEqual(r.dates.th, ['20 ต.ค.', '13 มิ.ย. 68', '20 ต.ค. 14:05'], 'TH keeps the Thai table + Buddhist year: ' + r.dates.th);
        assert.deepEqual(r.dates.kr, ['10월 20일', '6월 13일 25', '10월 20일 14:05'], 'KR: ' + r.dates.kr);
        assert.deepEqual(r.labelsEn, ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'], 'EN bucket labels, one language: ' + r.labelsEn);
        assert.deepEqual(r.labelsTh, ['วันนี้', 'เมื่อวาน', '7 วันล่าสุด', '30 วันล่าสุด'], 'TH bucket labels after the change event: ' + r.labelsTh);
        assert.deepEqual(r.labelsKr, ['오늘', '어제', '최근 7일', '최근 30일'], 'KR bucket labels: ' + r.labelsKr);
        assert.ok(r.titles.includes('Acromegaly: Spotting the Subtle Signs'), 'the admin emoji at the end of the article title stays out of the list: ' + r.titles);
        assert.deepEqual(r.pillsEn, ['⏳ Pending'], 'EN pills (V101.206: the article row has no pill — its disc carries the state): ' + r.pillsEn); assert.deepEqual(r.pillsTh, ['⏳ รอตรวจ'], 'TH pills: ' + r.pillsTh);
        assert.ok(/^\d{1,2} [A-Z][a-z]{2}$/.test(r.dateEn[0]) && /ต\.ค\.|พ\.ย\.|ก\.ย\./.test(r.dateTh[0]) && /월 \d{1,2}일/.test(r.dateKr[0]), 'row dates follow the language: ' + [r.dateEn[0], r.dateTh[0], r.dateKr[0]]);
        assert.ok(r.pendScope.length > 0 && r.pendScope.every(x => x[1] === x[2]), 'the ⏳ count equals the pending items of the chosen type: ' + JSON.stringify(r.pendScope));
        assert.equal(r.discAria, 'Cardiovascular · case 1', 'the case disc has a real accessible name: ' + r.discAria);
        assert.equal(r.matAria, '2 files to download', '📎 says what it is: ' + r.matAria);
        assert.equal(r.rowAria, true, 'rows keep role / tabindex / aria-expanded');
        assert.equal(r.pt, 'rgb(22, 101, 52)', 'pt wash text is the AA green: ' + r.pt);
        assert.ok(r.chipAll[0].startsWith('All') && r.chipAll.includes('🩺 1') && !r.chipAll.some(t => /Case/.test(t)), 'unchosen type chips = emoji + count: ' + r.chipAll);
        assert.ok(r.chipCase.includes('🩺 Case 1'), 'the chosen type chip shows its word: ' + r.chipCase);
        assert.deepEqual(r.sub, ['❤️ Cardiovascular 1', '📊 Stats'], '🩺 sub-row chips carry their names + Stats: ' + r.sub);
        assert.equal(r.chipH, 44, 'chips are 44 px on touch: ' + r.chipH); assert.equal(r.ibWH, '44x44', 'icon buttons 44 px on touch: ' + r.ibWH);
        assert.equal(r.casesBtn, '📊 My Cases'); assert.ok(r.casesTh, 'TH tooltip on My Cases'); assert.equal(r.casesOpened, 1, '⋯ ▸ My Cases opens it'); assert.equal(r.moreClosedAfter, true);
        // 5) a hovered / pressed row gets a background (file:// stylesheets hide their cssRules, so look at the computed style)
        const rowBefore = await page.$eval('#unified-timeline .hl-row', e => getComputedStyle(e).backgroundColor);
        await page.hover('#unified-timeline .hl-row');
        const rowHover = await page.$eval('#unified-timeline .hl-row', e => getComputedStyle(e).backgroundColor);
        assert.ok(rowBefore === 'rgba(0, 0, 0, 0)' && rowHover === 'rgb(248, 250, 252)', 'hover/active row background: ' + rowBefore + ' → ' + rowHover);
        // 7) lang-toggle.js itself announces the change (its buttons live in the header, outside the moved section)
        assert.ok(require('fs').readFileSync('public/lang-toggle.js', 'utf8').includes("new CustomEvent('lang-changed'"), 'lang-toggle.js dispatches lang-changed from applyState');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        if (process.env.SHOT) { await page.evaluate(() => { document.body.classList.remove('lang-th-on', 'lang-kr-on'); document.dispatchEvent(new CustomEvent('lang-changed')); }); await page.screenshot({ path: process.env.SHOT }); }
        await ctx.close();
        console.log('PASS: History consistency — one date formatter EN/TH/KR, bucket labels + pills by language, article emoji stripped, accessible names (case disc, 📎), AA wash colours, chip names (🩺 Case · sub-row), 44 px on touch, ⋯ ▸ My Cases, lang-changed redraw');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
