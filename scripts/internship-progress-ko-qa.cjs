// Korean UI step 5 — public/internship-progress.js (the Schedule help sheet + the SMART GOALS editor), real module in the real index.html.
//  - the help sheet is a shielded Thai-only guide (lang-no-toggle, lang=th): in KR mode it opens in Korean ONLY (no Thai left), in EN / TH mode it is the Thai guide as before
//  - the goal editor keeps English text; its Thai-only tooltips are now EN + data-th-title / data-kr-title, so KR mode reads "EN 한국어" and TH mode "EN ไทย"
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const TH = /[฀-๿]/, KO = /[가-힯]/;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        page.on('pageerror', () => {});
        await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.internshipProgress && typeof window.internshipProgress.showHelp === 'function');
        await page.waitForTimeout(800);

        const setMode = async (kr, th) => {
            // the app's own EN → KR → TH → K·T cycle (it also rebuilds the data-*-title attributes)
            await page.evaluate(([k, t]) => { for (let i = 0; i < 5; i++) { const c = document.body.classList; if (c.contains('lang-kr-on') === k && c.contains('lang-th-on') === t) break; cycleLang(); } }, [kr, th]);
            await page.waitForTimeout(250);
        };
        const help = async () => {
            await page.evaluate(() => { const d = document.getElementById('ip-help-dialog'); if (d) d.remove(); window.internshipProgress.showHelp(null); });
            return page.evaluate(() => { const d = document.getElementById('ip-help-dialog'); return { text: d.innerText, html: d.innerHTML, lang: d.lang, close: d.querySelector('.ip-help-close').getAttribute('aria-label'), n: d.querySelectorAll('dt').length }; });
        };

        // 1 · help sheet: Korean mode = Korean only; EN / TH mode = the original Thai guide
        await setMode(true, false); let h = await help();
        assert.ok(KO.test(h.text), 'KR: the help sheet is Korean'); assert.ok(!TH.test(h.html.replace(/<[^>]+>/g, '')), 'KR: no Thai text left in the help sheet');
        assert.equal(h.lang, 'ko'); assert.equal(h.close, '도움말 닫기'); assert.equal(h.n, 5, 'KR: the same five rows');
        assert.ok(/Schedule/.test(h.text) && /Quiz/.test(h.text) && /Journal/.test(h.text), 'KR: the English terms (Schedule, Quiz, Journal …) stay');
        for (const mode of [[false, false], [false, true], [true, true]]) {
            await setMode(mode[0], mode[1]); h = await help();
            assert.ok(TH.test(h.text) && !KO.test(h.text), 'mode kr=' + mode[0] + ' th=' + mode[1] + ': the Thai guide (unchanged)'); assert.equal(h.lang, 'th'); assert.equal(h.close, 'ปิดคำแนะนำ'); assert.equal(h.n, 5);
        }

        // 2 · goal editor: no Thai-only attribute left; the trio composes per mode
        await page.evaluate(() => { const d = document.getElementById('ip-help-dialog'); if (d) d.remove(); });
        const raw = await page.evaluate(() => {
            window.internshipProgress.setPeriod({ personal: true, goal: { kind: 'monthly', target: 10 }, startDate: '2026-10-01', endDate: '2026-12-31', saveGoal: async () => {} });
            window.internshipProgress.editGoal();
            const d = document.querySelector('.ip-goal-editor'); if (!d) return null;
            const out = [...d.querySelectorAll('[data-th-title],[data-kr-title]')].map(e => ({ en: e.getAttribute('data-en-title') || e.getAttribute('title'), th: e.getAttribute('data-th-title'), kr: e.getAttribute('data-kr-title') }));
            const thaiOnly = [...d.querySelectorAll('[title],[aria-label]')].filter(e => TH_RE(e.getAttribute('title')) && !e.hasAttribute('data-th-title')).length;
            function TH_RE(s) { return !!s && /[฀-๿]/.test(s); }
            return { n: out.length, out, thaiOnly };
        });
        assert.ok(raw && raw.n >= 9, 'the goal editor opened with its tooltips marked (data-th/kr-title): ' + (raw && raw.n));
        assert.equal(raw.thaiOnly, 0, 'no Thai-only title attribute left in the goal editor');
        assert.ok(raw.out.every(x => x.th && x.kr && x.en && KO.test(x.kr) && !TH.test(x.kr) && !KO.test(x.en)), 'each tooltip has EN + Thai + Korean');
        await setMode(true, false);
        const kr = await page.evaluate(() => [...document.querySelectorAll('.ip-goal-editor [data-kr-title]')].slice(0, 3).map(e => e.getAttribute('title')));
        assert.ok(kr.every(t => KO.test(t)), 'KR mode: tooltips read "EN + 한국어": ' + JSON.stringify(kr));
        await setMode(false, true);
        const th = await page.evaluate(() => [...document.querySelectorAll('.ip-goal-editor [data-th-title]')].slice(0, 3).map(e => e.getAttribute('title')));
        assert.ok(th.every(t => TH.test(t) && !KO.test(t)), 'TH mode: tooltips read "EN + ไทย": ' + JSON.stringify(th));
        console.log('PASS: internship-progress Korean — help sheet opens Korean-only in KR mode (Thai guide otherwise, English terms kept), goal editor tooltips are EN + Thai + Korean with no Thai-only attribute left');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
