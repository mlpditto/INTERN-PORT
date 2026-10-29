// V101.235: Halloween Journal — 20 Oct – 2 Nov (Bangkok) the writing part wears candlelight and Writing progress wears midnight; outside the season
// nothing changes. Always: Writing progress sits BELOW the writing part, and a single flag chip in the tab-bar card cycles the UI language.
// The REAL public/index.html + halloween.css (file://, network blocked, Firebase stubbed).
const path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = pathToFileURL(path.resolve('public/index.html')).href;

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const run = async iso => {
            const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' });
            const page = await ctx.newPage();
            await page.clock.setFixedTime(new Date(iso));
            const errors = [], dialogs = []; page.on('pageerror', e => errors.push(e.message));
            page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
            await page.addInitScript(() => {
                window.firebase = { auth: () => ({ currentUser: null, onAuthStateChanged: () => () => {}, signInAnonymously: () => Promise.resolve() }), functions: () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }), firestore: Object.assign(() => ({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }), onSnapshot: () => () => {} }), where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }), get: () => Promise.resolve({ docs: [] }), orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }), { FieldValue: { serverTimestamp: () => 0, delete: () => 0, increment: n => n } }) };
            });
            await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
            await page.goto(INDEX, { waitUntil: 'load' });
            await page.evaluate(() => {
                document.getElementById('main-app').style.setProperty('display', 'block', 'important');
                const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
                document.getElementById('kanban-content').style.display = 'block';
                if (typeof switchMissionTab === 'function') switchMissionTab('reflection');
                // a recording Firestore: adds are kept in window.__writes; a reflective log also lands in the caches, as the listener would
                window.__writes = []; window.__fail = {};
                const now = () => ({ toDate: () => new Date() });
                db.collection = name => ({
                    add: data => {
                        if (window.__fail[name]) return Promise.reject(new Error('offline'));
                        window.__writes.push([name, data]);
                        if (name === 'reflective_logs') { const log = { id: 'today', ...data, timestamp: now() }; reflectiveLogsCache = reflectiveLogsCache.concat([log]); window.myReflectiveLogsCache = (window.myReflectiveLogsCache || []).concat([log]); renderReflectiveLogs(); }
                        return Promise.resolve({ id: name + window.__writes.length });
                    },
                    doc: () => ({ update: () => Promise.resolve(), get: () => Promise.resolve({ exists: false, data: () => ({}) }), set: () => Promise.resolve() }),
                    where: () => ({ get: () => Promise.resolve({ docs: [] }), onSnapshot: () => () => {} }),
                });
                ensureFirebaseAuthReady = async () => ({ uid: 'auth-u1' });
                requireRegistered = () => true;
                tryDailyCheckin = () => {}; renderDailyCheckinCard = () => {}; awardEngagementBonusIfDue = () => {};
                userId = 'u1'; userProfile = { displayName: 'Intern A', pictureUrl: '' };
                reflectiveLogsCache = []; window.myReflectiveLogsCache = []; window.myLpEntriesCache = [];
                renderReflectiveLogs(); renderDRStatus();
            });
            await page.waitForTimeout(300);
    
            // the writing-progress card is hidden until the script fills it — show it with a body so its colours can be read
            await page.evaluate(() => { window.WritingProgress = { render() {} }; window.renderMyWritingProfile = () => {}; const c = document.getElementById('my-writing-profile'); c.style.setProperty('display', 'block', 'important'); document.getElementById('mwp-body').innerHTML = '<div class="wp"><div class="wp-head"><b>Writing progress</b></div><span class="wp-chip fire">1d</span><div class="hm"><button class="hm-c wd l2"><i class="hm-n">3</i></button></div></div>'; });
            const r = await page.evaluate(async () => {
                document.getElementById('my-writing-profile').style.display = 'block';   // writing-progress.js hides the card again between renders
                const cs = (e, p, ps) => getComputedStyle(e, ps)[p];
                const pane = document.getElementById('pane-mission-reflection'), wp = document.getElementById('my-writing-profile'), area = document.getElementById('rl-integrated-area');
                const chip = document.getElementById('mission-lang-chip'), bar = document.querySelector('.mission-tabs-bar'), canvas = document.querySelector('.daily-canvas'), hero = document.querySelector('.dc-hero');
                // V101.240: KR+TH — the tab labels carry BOTH the Thai and the Korean word, and the chip is a pill with two flags
                document.body.classList.add('lang-kr-on', 'lang-th-on'); chip.setAttribute('data-two', ''); chip.textContent = '🇰🇷🇹🇭'; await new Promise(res => setTimeout(res, 500));   // buttons transition their size
                const lab = id => [...document.querySelectorAll('#' + id + ' > span')].filter(s => !s.classList.contains('lang-no-toggle')).map(s => s.innerText.replace(/\s+/g, ' ').trim()).join(' ');
                const kt = { quiz: lab('mtab-quiz'), journal: lab('mtab-reflection'), explore: lab('mtab-explore'), chipW: Math.round(chip.getBoundingClientRect().width), ls: cs(chip, 'letterSpacing') };
                document.body.classList.remove('lang-kr-on', 'lang-th-on'); chip.removeAttribute('data-two'); chip.textContent = '🇬🇧';
                const flags = [chip.textContent]; for (let i = 0; i < 4; i++) { chip.click(); flags.push(chip.textContent + '|' + chip.getAttribute('aria-label')); }
                return { kt, hw: document.documentElement.classList.contains('hw'), below: wp.getBoundingClientRect().top >= area.getBoundingClientRect().bottom - 1, flex: cs(pane, 'display'),
                    bar: cs(bar, 'backgroundImage').includes('repeating-linear-gradient'), barBorder: cs(bar, 'borderBottomStyle'), canvasBorder: cs(canvas, 'borderTopColor'), ghost: cs(hero, 'content', '::after'),
                    wpBg: cs(wp, 'backgroundImage'), wpBorder: cs(wp, 'borderTopStyle'), wpTape: cs(wp, 'content', '::before'), heat: cs(document.querySelector('#my-writing-profile .hm-c.l2'), 'backgroundColor'), heatN: cs(document.querySelector('#my-writing-profile .hm-n'), 'color'), flags };
            });
            assert.deepEqual(errors, [], 'no page errors');
            await ctx.close();
            return r;
        };
        const FLAGS = ['🇬🇧', '🇰🇷|Language: KR (tap to switch)', '🇹🇭|Language: TH (tap to switch)', '🇰🇷🇹🇭|Language: K·T (tap to switch)', '🇬🇧|Language: EN (tap to switch)'];
        for (const iso of ['2026-10-29T10:00:00+07:00', '2026-10-20T00:30:00+07:00', '2026-11-02T23:30:00+07:00']) {
            const r = await run(iso);
            assert.equal(r.hw, true, iso + ' is in season');
            assert.ok(r.bar && r.barBorder === 'dashed', 'candlelight tab bar'); assert.equal(r.canvasBorder, 'rgb(253, 186, 116)', 'candlelight card border');
            assert.ok(r.ghost.includes('👻'), 'the ghost floats on the hero');
            assert.ok(/linear-gradient/.test(r.wpBg) && /243, 232, 255/.test(r.wpBg) && r.wpBorder === 'dashed', 'Writing progress is a pale lavender wash (dusk), not the dark midnight: ' + r.wpBg); assert.ok(r.wpTape.includes('"'), 'hazard tape strip');
            assert.deepEqual([r.heat, r.heatN], ['rgb(251, 146, 60)', 'rgb(67, 20, 7)'], 'heatmap level 2 is pale pumpkin with dark digits');
            assert.deepEqual([r.kt.quiz, r.kt.journal, r.kt.explore], ['Quiz แบบทดสอบ 퀴즈', 'Journal บันทึก 저널', 'Explore สำรวจ 탐색'], 'KR+TH shows the Thai AND the Korean word on every tab: ' + JSON.stringify(r.kt));
            assert.ok(r.kt.chipW >= 44 && r.kt.ls === 'normal', 'the KR+TH chip is a pill with room for two flags: ' + JSON.stringify(r.kt));
            assert.ok(r.below && r.flex === 'flex', 'Writing progress is below the writing part: ' + JSON.stringify([r.below, r.flex]));
            assert.deepEqual(r.flags, FLAGS, 'one chip cycles EN → KR → TH → K·T → EN: ' + r.flags);
        }
        for (const iso of ['2026-10-19T23:30:00+07:00', '2026-11-03T00:30:00+07:00', '2026-12-25T10:00:00+07:00']) {
            const r = await run(iso);
            assert.equal(r.hw, false, iso + ' is out of season');
            assert.ok(!r.bar && r.barBorder !== 'dashed' && r.ghost !== '"👻"' && !/243, 232, 255/.test(r.wpBg), 'no Halloween outside the season: ' + JSON.stringify(r));
            assert.ok(r.below, 'Writing progress is below the writing part all year');
            assert.equal(r.flags[1], FLAGS[1], 'the language chip is there all year');
        }
        console.log('journal-halloween-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
