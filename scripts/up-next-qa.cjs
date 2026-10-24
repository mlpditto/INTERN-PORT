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
assert.ok(admin.includes('<div id="upnext-card" class="lang-no-toggle" hidden></div>'), 'strip host on the Dashboard — lang-no-toggle, or lang-toggle.js hides every Thai topic title (found live 2026-10-24)');
assert.ok(admin.indexOf('id="chip-alabasta"') < admin.indexOf('id="upnext-card"') && admin.indexOf('id="upnext-card"') < admin.indexOf('id="general-work-review-section"'), 'sits under the chip row');
assert.ok(/<script src="up-next\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/db\.collection\("quizzes"\)\.onSnapshot\(s => \{[\s\S]{0,400}window\.upNext\.refresh\(\)/.test(admin), 'refresh follows the quiz list');
assert.ok(!/\.un-strip\s*\{[^}]*overflow-x\s*:\s*(auto|scroll)/.test(admin), 'no sideways scroll');

const ts = (s) => s;   // raw seconds; hydrated to Timestamp-likes below and inside the page
const hydrate = (o) => { const t = (v) => ({ toMillis: () => v * 1000 }); const r = { ...o }; for (const k of ['createdAt', 'lastLiveAt', 'timestamp']) if (typeof r[k] === 'number') r[k] = t(r[k]); return r; };
const ctx = { window: {}, document: { addEventListener() {}, getElementById: () => null }, console, Math, Date, Set, Map, Array, String, Number };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const build = (q, f, ai) => JSON.parse(JSON.stringify(ctx.upNextBuild(q && q.map(hydrate), f && f.map(hydrate), ai)));

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
assert.deepEqual(r.asked.map(x => [x.kind, x.kind === 'req' ? x.id : x.title.toLowerCase(), x.n]), [['topic', 'pediatric fever dosing', 2], ['req', 'asthma', 2], ['req', 'warf', 1], ['live', 'hypertension basics', 1]], JSON.stringify(r.asked));
assert.equal(r.asked[0].title.toLowerCase(), 'pediatric fever dosing', 'an unmatched topic is kept as a topic (＋)');
assert.deepEqual(r.asked.map(x => x.n), [2, 2, 1, 1], 'distinct interns per topic: u1 twice counts once');
assert.equal(r.asked[3].id, 'live', 'a topic that names a LIVE quiz becomes that quiz (↗), after the things to do'); assert.equal(r.asked[3].cap, '', 'same words as the title → no caption'); assert.equal(r.asked[1].cap, 'Asthma', 'the interns’ own words stay as the caption');
assert.ok(!r.asked.some(x => x.title === 'ab' || x.title === ''), 'empty / 2-letter topics ignored');
// 🌱 fills up: never-live first (newest first), the already-live-once quiz after, never polls / blanks / live / asked quizzes
assert.deepEqual(r.fresh.map(x => x.id), ['ins', 'old'], JSON.stringify(r.fresh));
assert.equal(r.all.length, 5, 'asked first, then 🌱, capped at five');
assert.deepEqual(r.all.map(x => x.kind), ['topic', 'req', 'req', 'live', 'fresh']);
// 2. a tag match, and a topic that matches two topics' worth of one quiz sums the interns
r = build(Q, [{ userId: 'a', nextTopic: 'inhaler technique', timestamp: ts(1) }, { userId: 'b', nextTopic: 'asthma', timestamp: ts(2) }]);
assert.deepEqual([r.asked[0].id, r.asked[0].n], ['asthma', 2], 'tag "inhaler" + title "asthma" → one tile, two interns: ' + JSON.stringify(r.asked));
// 3. nothing at all → empty; no feedback → only 🌱; more than five → five
assert.equal(build([], []).all.length, 0);
assert.deepEqual(build(Q, null).all.map(x => x.kind), ['fresh', 'fresh', 'fresh', 'fresh']);
const many = Array.from({ length: 9 }, (_, i) => ({ id: 'q' + i, title: 'Quiz number ' + i, isActive: false, createdAt: ts(i) }));
assert.equal(build(many, []).all.length, 5);

// 4. the model's pairing: a Thai topic joins an English quiz (live → ↗ tile, inactive → ▶ tile); asked-but-unpaired says so only once the model has answered
const TH = [{ userId: 't1', nextTopic: 'ยาความดัน', timestamp: ts(5) }];
r = build(Q, TH, { ids: { 'ยาความดัน': 'live' }, done: true });
assert.deepEqual([r.asked[0].kind, r.asked[0].id, r.asked[0].title, r.asked[0].cap, r.asked[0].n], ['live', 'live', 'Hypertension basics', 'ยาความดัน', 1], JSON.stringify(r.asked));
r = build(Q, TH, { ids: { 'ยาความดัน': 'ins' }, done: true });
assert.deepEqual([r.asked[0].kind, r.asked[0].id, r.asked[0].cap], ['req', 'ins', 'ยาความดัน'], 'inactive pairing → ▶ tile, the request is the caption');
assert.ok(!r.fresh.some(x => x.id === 'ins'), 'a paired quiz is not repeated as 🌱');
assert.equal(build(Q, TH, { ids: {}, done: true }).asked[0].cap, 'none', 'model answered, nothing similar → says so');
assert.equal(build(Q, TH, null).asked[0].cap, '', 'model not asked / failed → no claim');
assert.equal(build(Q, TH, { ids: { 'ยาความดัน': 'poll' }, done: true }).asked[0].kind, 'topic', 'a poll / unknown id is never offered');
// 5. matchAi(): sends only what the text match could not place, cached per day + set, tolerant of nonsense
const store = {}; ctx.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
ctx.safeJsonParse = JSON.parse;
(async () => {
    let calls = [], answer = '{"m":[{"t":0,"q":0,"s":0.9},{"t":1,"q":99,"s":0.9},{"t":2,"q":1,"s":0.2}]}';
    const call = async (...a) => { calls.push(a); return { text: answer }; };
    const F5 = [{ userId: 'a', nextTopic: 'asthma', timestamp: ts(1) }, { userId: 'b', nextTopic: 'ยาความดัน', timestamp: ts(2) }, { userId: 'c', nextTopic: 'ภาษาจีน', timestamp: ts(3) }, { userId: 'd', nextTopic: 'ยาปฏิชีวนะ', timestamp: ts(4) }].map(hydrate);
    let m = await ctx.upNextMatchAi(Q, F5, call);
    assert.equal(calls.length, 1); assert.equal(calls[0][0], 'as/gemini-3.5-flash-lite', 'the cheap model'); assert.equal(calls[0][2], true, 'JSON mode');
    assert.ok(!/asthma/i.test(calls[0][1].split('TOPICS:')[1].split('QUIZZES:')[0]), 'a topic the text match already placed is not sent'); assert.ok(!/userId|u1/.test(calls[0][1]), 'no user ids in the prompt');
    assert.deepEqual(JSON.parse(JSON.stringify(m)), { ids: { 'ยาปฏิชีวนะ': 'live' }, done: true }, 'only valid, strong, in-range pairs are kept (the prompt numbers topics 0..: ' + JSON.stringify(m));
    await ctx.upNextMatchAi(Q, F5, call); assert.equal(calls.length, 1, 'same day + same set → the cache answers');
    await ctx.upNextMatchAi(Q.concat([{ id: 'new', title: 'Another quiz', isActive: false }]), F5, call); assert.equal(calls.length, 2, 'a changed quiz set asks again');
    assert.deepEqual(JSON.parse(JSON.stringify(await ctx.upNextMatchAi(Q, [{ userId: 'a', nextTopic: 'asthma', timestamp: ts(1) }], call))), { ids: {}, done: true }); assert.equal(calls.length, 2, 'nothing left for the model → no call');
    answer = 'not json at all'; ctx.safeJsonParse = () => null;
    assert.deepEqual(JSON.parse(JSON.stringify(await ctx.upNextMatchAi(Q, [{ userId: 'z', nextTopic: 'โรคหัวใจ', timestamp: ts(9) }], call))), { ids: {}, done: true }, 'unparsable answer → no pairs');
    assert.equal(calls.length, 3);
    await assert.rejects(ctx.upNextMatchAi(Q, [{ userId: 'y', nextTopic: 'โรคตับ', timestamp: ts(9) }], async () => { throw new Error('proxy down'); }), /proxy down/, 'a failing call rejects (the strip catches it and keeps the text-only version)');
})().then(page).catch(e => { console.error(e); process.exit(1); });

function page() { return (async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    for (const [name, width, expectCols] of [['desktop', 1200, 5], ['phone', 380, 2]]) {
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/lang-toggle.js')).href);   // a real (file) origin so localStorage works for lang-toggle.js
        await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div style="padding:12px"><div id="upnext-card" class="lang-no-toggle" hidden></div></div>`);
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            window.calls = []; window.confirmAnswer = true;
            window.confirm = m => { window.calls.push(['confirm', m]); return window.confirmAnswer; };
            window.toggleQuizStatus = (id, cur) => window.calls.push(['toggle', id, cur]);
            window.openQuizModal = (id) => window.calls.push(id ? ['open', id] : ['open']);
            window.showToast = (m) => window.calls.push(['toast', m]);
            window.db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }) };
        });
        await page.evaluate(() => { localStorage.setItem('uiLangTH', '0'); localStorage.setItem('uiLangKR', '0'); });   // admin's default: EN only

        await page.addScriptTag({ path: 'public/lang-toggle.js' });
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
        assert.deepEqual(geo.go, ['＋', '▶', '▶', '↗', '▶'], name + ': ＋ for the unmatched topic, ▶ for inactive quizzes, ↗ for a live one');
        if (name === 'desktop') {
            assert.equal(await page.$$eval('#upnext-card .un-chip', e => e.map(x => x.getAttribute('aria-pressed')).join()), 'true,false,false');
            // chips
            await page.click('.un-chip[data-un="ask"]');
            assert.deepEqual(await page.$$eval('#upnext-card .un-src', e => [...new Set(e.map(x => x.textContent))]), ['💬', '🟢'], '💬 shows only asked (🟢 = asked and already live)');
            assert.equal(await page.$$eval('#upnext-card .un-tile', e => e.length), 4);
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
            await page.evaluate(() => { window.calls.length = 0; });
            await page.click('#upnext-card .un-go.un-open');
            assert.deepEqual(await page.evaluate(() => window.calls), [['open', 'live']], '↗ opens the live quiz in the editor, no confirm');
            // ＋ opens the form with the topic named
            await page.evaluate(() => { window.calls.length = 0; });
            await page.click('#upnext-card .un-go[data-i="0"]');
            assert.deepEqual(await page.evaluate(() => window.calls.map(c => c[0])), ['open', 'toast']);
            // text is escaped
            await page.evaluate(() => { window.quizzesData.push(window.hy({ id: 'x', title: '<img src=x onerror=window.pwned=1>', isActive: false, createdAt: 9e9 })); window.upNext.render(); });
            assert.equal(await page.evaluate(() => window.pwned), undefined, 'quiz titles are escaped');
            // Thai topic / quiz titles must survive admin's lang-toggle.js (it wraps Thai runs in .lang-th and hides them under an EN-default body unless an
            // ancestor has .lang-no-toggle — the strip went live with blank Thai titles on 2026-10-24)
            await page.evaluate(() => { window.quizzesData.push(window.hy({ id: 'th', title: 'ยาคุมกำเนิด', isActive: false, createdAt: 9e9 + 1 })); window.upNext.render(); });
            await page.waitForTimeout(250);
            const thai = () => page.evaluate(() => { const b = [...document.querySelectorAll('#upnext-card .un-tile b')].find(x => x.textContent.includes('ยาคุม')); return b ? [b.textContent, !!b.querySelector('.lang-th'), b.getBoundingClientRect().width > 0 && getComputedStyle(b).visibility !== 'hidden'] : null; });
            assert.deepEqual(await thai(), ['ยาคุมกำเนิด', false, true], 'a Thai title is shown as typed (not wrapped / hidden by lang-toggle)');
            await page.evaluate(() => { document.getElementById('upnext-card').classList.remove('lang-no-toggle'); window.upNext.render(); });
            await page.waitForTimeout(250);
            const hid = await thai();
            assert.ok(hid && hid[1] === true, 'proof the guard matters: without .lang-no-toggle lang-toggle.js wraps the Thai title: ' + JSON.stringify(hid));
            await page.evaluate(() => document.getElementById('upnext-card').classList.add('lang-no-toggle'));
        }
        await page.close();
    }
    await browser.close();
    console.log('PASS: Dashboard Up next — 💬 nextTopic matched to inactive quizzes (distinct interns, live quizzes become ↗ tiles, unmatched → ＋ topic) + 🌱 fresh inactive quizzes, five max, chip rail All/💬/🌱, 5 across / 2 on a phone with no sideways scroll, ▶ asks then goes live, text escaped');
})(); }
