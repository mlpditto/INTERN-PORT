// Admin ▸ Dashboard ▸ 🚀 Up next (public/up-next.js): five quizzes that could go live next, from two sources + a chip rail.
//   💬 interns' "next topic" (quiz_feedback.nextTopic) matched to an INACTIVE quiz by title/tag (▶), or kept as a topic (＋) when no quiz matches
//   🌱 inactive quizzes nobody has run yet, to fill up to five.
// Part 1: the real matcher (window.upNextBuild) in a vm. Part 2: the real strip rendered with admin.html's own CSS — 5 across on a desktop,
// 2 columns on a phone, never a sideways scroll; ▶ asks first and calls toggleQuizStatus(id, false); ＋ opens the quiz form.
//   node scripts/up-next-qa.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/up-next.js', 'utf8');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// static pins
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
assert.ok(admin.includes('<div id="upnext-card" hidden></div>'), 'strip host on the Dashboard');
assert.ok(admin.indexOf('id="chip-alabasta"') < admin.indexOf('id="upnext-card"') && admin.indexOf('id="upnext-card"') < admin.indexOf('id="general-work-review-section"'), 'sits under the chip row');
assert.ok(/<script src="up-next\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/db\.collection\("quizzes"\)\.onSnapshot\(s => \{[\s\S]{0,400}window\.upNext\.refresh\(\)/.test(admin), 'refresh follows the quiz list');
assert.ok(!/\.un-strip\s*\{[^}]*overflow-x\s*:\s*(auto|scroll)/.test(admin), 'no sideways scroll');

const ts = (s) => s;   // raw seconds; hydrated to Timestamp-likes below and inside the page
const hydrate = (o) => { const t = (v) => ({ toMillis: () => v * 1000 }); const r = { ...o }; for (const k of ['createdAt', 'lastLiveAt', 'timestamp']) if (typeof r[k] === 'number') r[k] = t(r[k]); return r; };
const ctx = { window: {}, document: { addEventListener() {}, getElementById: () => null }, console, Math, Date, Set, Map, Array, String, Number };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const build = (q, f) => JSON.parse(JSON.stringify(ctx.upNextBuild(q && q.map(hydrate), f && f.map(hydrate))));

const Q = [
    { id: 'live', title: 'Hypertension basics', isActive: true, tags: 'HTN' },
    { id: 'asthma', title: 'Asthma — GINA step-up', isActive: false, tags: 'asthma, inhaler', createdAt: ts(500) },
    { id: 'warf', title: 'Warfarin interactions', isActive: false, tags: '', createdAt: ts(400) },
    { id: 'ins', title: 'Insulin types & onset', isActive: false, createdAt: ts(900) },
    { id: 'old', title: 'Old ended quiz', isActive: false, lastLiveAt: ts(100), createdAt: ts(50) },
    { id: 'poll', title: 'A poll', isActive: false, isPoll: true },
    { id: 'blank', title: '', isActive: false },
];
const F = [
    { userId: 'u1', nextTopic: 'asthma step up', timestamp: ts(10) }, { userId: 'u2', nextTopic: 'Asthma', timestamp: ts(20) }, { userId: 'u1', nextTopic: ' ASTHMA ', timestamp: ts(30) },
    { userId: 'u3', nextTopic: 'warfarin', timestamp: ts(40) },
    { userId: 'u4', nextTopic: 'Pediatric fever dosing', timestamp: ts(50) }, { userId: 'u5', nextTopic: 'pediatric fever dosing', timestamp: ts(60) },
    { userId: 'u6', nextTopic: 'hypertension basics', timestamp: ts(70) },   // already live → not offered again
    { userId: 'u7', nextTopic: '', timestamp: ts(80) }, { userId: 'u8', nextTopic: 'ab', timestamp: ts(80) },   // empty / too short → ignored
];

// 1. matching, counting, ordering
let r = build(Q, F);
assert.deepEqual(r.asked.map(x => [x.kind, x.kind === 'req' ? x.id : x.title.toLowerCase(), x.n]), [['topic', 'pediatric fever dosing', 2], ['req', 'asthma', 2], ['req', 'warf', 1]], JSON.stringify(r.asked));
assert.equal(r.asked[0].title.toLowerCase(), 'pediatric fever dosing', 'an unmatched topic is kept as a topic (＋)');
assert.deepEqual(r.asked.map(x => x.n), [2, 2, 1], 'distinct interns per topic: u1 twice counts once');
assert.ok(!r.asked.some(x => /hypertension/i.test(x.title)), 'a topic that names a LIVE quiz is not offered');
assert.ok(!r.asked.some(x => x.title === 'ab' || x.title === ''), 'empty / 2-letter topics ignored');
// 🌱 fills up: never-live first (newest first), the already-live-once quiz after, never polls / blanks / live / asked quizzes
assert.deepEqual(r.fresh.map(x => x.id), ['ins', 'old'], JSON.stringify(r.fresh));
assert.equal(r.all.length, 5, 'asked first, then 🌱, capped at five');
assert.deepEqual(r.all.map(x => x.kind), ['topic', 'req', 'req', 'fresh', 'fresh']);
// 2. a tag match, and a topic that matches two topics' worth of one quiz sums the interns
r = build(Q, [{ userId: 'a', nextTopic: 'inhaler technique', timestamp: ts(1) }, { userId: 'b', nextTopic: 'asthma', timestamp: ts(2) }]);
assert.deepEqual([r.asked[0].id, r.asked[0].n], ['asthma', 2], 'tag "inhaler" + title "asthma" → one tile, two interns: ' + JSON.stringify(r.asked));
// 3. nothing at all → empty; no feedback → only 🌱; more than five → five
assert.equal(build([], []).all.length, 0);
assert.deepEqual(build(Q, null).all.map(x => x.kind), ['fresh', 'fresh', 'fresh', 'fresh']);
const many = Array.from({ length: 9 }, (_, i) => ({ id: 'q' + i, title: 'Quiz number ' + i, isActive: false, createdAt: ts(i) }));
assert.equal(build(many, []).all.length, 5);

(async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    for (const [name, width, expectCols] of [['desktop', 1200, 5], ['phone', 380, 2]]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div style="padding:12px"><div id="upnext-card" hidden></div></div>`);
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            window.calls = []; window.confirmAnswer = true;
            window.confirm = m => { window.calls.push(['confirm', m]); return window.confirmAnswer; };
            window.toggleQuizStatus = (id, cur) => window.calls.push(['toggle', id, cur]);
            window.openQuizModal = () => window.calls.push(['open']);
            window.showToast = (m) => window.calls.push(['toast', m]);
            window.db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }) };
        });
        await page.addScriptTag({ content: js });
        await page.evaluate(([q, f]) => {
            const t = (v) => ({ toMillis: () => v * 1000 });
            const hy = (o) => { const r = { ...o }; for (const k of ['createdAt', 'lastLiveAt', 'timestamp']) if (typeof r[k] === 'number') r[k] = t(r[k]); return r; };
            window.hy = hy; window.quizzesData = q.map(hy);
            window.db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: f.map((x, i) => ({ id: 'f' + i, data: () => hy(x) })) }) }) }) }) };
        }, [Q, F]);
        await page.evaluate(() => window.upNext.refresh());
        await page.waitForFunction(() => document.querySelectorAll('#upnext-card .un-tile').length === 5);
        const geo = await page.evaluate(() => { const t = [...document.querySelectorAll('#upnext-card .un-tile')].map(e => e.getBoundingClientRect()); const s = document.querySelector('#upnext-card .un-strip'); const cols = new Set(t.map(r => Math.round(r.left))).size;
            return { cols, scrollX: s.scrollWidth > s.clientWidth + 1, pageX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, titles: [...document.querySelectorAll('#upnext-card .un-tile b')].map(e => e.textContent), go: [...document.querySelectorAll('#upnext-card .un-go')].map(e => e.textContent) }; });
        assert.equal(geo.cols, expectCols, name + ': ' + expectCols + ' columns: ' + JSON.stringify(geo));
        assert.ok(!geo.scrollX && !geo.pageX, name + ': no sideways scroll');
        assert.deepEqual(geo.go, ['＋', '▶', '▶', '▶', '▶'], name + ': ＋ for the unmatched topic, ▶ for quizzes');
        if (name === 'desktop') {
            assert.equal(await page.$$eval('#upnext-card .un-chip', e => e.map(x => x.getAttribute('aria-pressed')).join()), 'true,false,false');
            // chips
            await page.click('.un-chip[data-un="ask"]');
            assert.deepEqual(await page.$$eval('#upnext-card .un-src', e => [...new Set(e.map(x => x.textContent))]), ['💬'], '💬 shows only asked');
            assert.equal(await page.$$eval('#upnext-card .un-tile', e => e.length), 3);
            await page.click('.un-chip[data-un="fresh"]');
            assert.deepEqual(await page.$$eval('#upnext-card .un-src', e => [...new Set(e.map(x => x.textContent))]), ['🌱']);
            await page.click('.un-chip[data-un="all"]');
            // ▶ asks first
            await page.evaluate(() => { window.calls.length = 0; window.confirmAnswer = false; });
            await page.click('#upnext-card .un-go[data-i="1"]');
            assert.deepEqual(await page.evaluate(() => window.calls.map(c => c[0])), ['confirm'], 'declined → nothing happens');
            await page.evaluate(() => { window.calls.length = 0; window.confirmAnswer = true; });
            await page.click('#upnext-card .un-go[data-i="1"]');
            assert.deepEqual(await page.evaluate(() => window.calls.filter(c => c[0] === 'toggle')), [['toggle', 'asthma', false]], '▶ → toggleQuizStatus(id, false) = go live');
            // ＋ opens the form with the topic named
            await page.evaluate(() => { window.calls.length = 0; });
            await page.click('#upnext-card .un-go[data-i="0"]');
            assert.deepEqual(await page.evaluate(() => window.calls.map(c => c[0])), ['open', 'toast']);
            // text is escaped
            await page.evaluate(() => { window.quizzesData.push(window.hy({ id: 'x', title: '<img src=x onerror=window.pwned=1>', isActive: false, createdAt: 9e9 })); window.upNext.render(); });
            assert.equal(await page.evaluate(() => window.pwned), undefined, 'quiz titles are escaped');
        }
        await page.close();
    }
    await browser.close();
    console.log('PASS: Dashboard Up next — 💬 nextTopic matched to inactive quizzes (distinct interns, live quizzes skipped, unmatched → ＋ topic) + 🌱 fresh inactive quizzes, five max, chip rail All/💬/🌱, 5 across / 2 on a phone with no sideways scroll, ▶ asks then goes live, text escaped');
})().catch(e => { console.error(e); process.exit(1); });
