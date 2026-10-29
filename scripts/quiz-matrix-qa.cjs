// Admin ▸ Dashboard ▸ 🎯 Live quizzes (public/quiz-matrix.js): every live quiz on an Eisenhower grid — urgent (closes within 24 h · 72 h · 7 d)
// × important (fewer than 30 · 50 · 70 % of the interns it targets have submitted). Audience + "done" mirror functions scanQuizPending.
// Part 1: the real sorter (window.quizMatrixBuild) in a vm. Part 2: the real card with admin.html's own CSS — 2 × 2 on a desktop AND a phone,
// never a sideways scroll; the chips move quizzes between boxes and are remembered; a quiz opens 👥 Participants.
//   node scripts/quiz-matrix-qa.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/quiz-matrix.js', 'utf8');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// static pins
assert.ok(admin.includes('<div id="qmx-card" class="lang-no-toggle" hidden></div>'), 'card host on the Dashboard — lang-no-toggle so Thai titles stay');
assert.ok(admin.indexOf('id="upnext-card"') < admin.indexOf('id="qmx-card"') && admin.indexOf('id="qmx-card"') < admin.indexOf('id="general-work-review-section"'), 'sits under 🚀 Up next');
assert.ok(/<script src="quiz-matrix\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/renderQuizSystemFilterBar\(activeCount \+ inactiveCount\);\s*if \(window\.quizMatrix\) window\.quizMatrix\.refresh\(\);/.test(admin), 'refresh follows renderQuizzesNow (quizzes + attempts)');
assert.ok(!/#qmx-card[^{]*\{[^}]*overflow-x\s*:\s*(auto|scroll)/.test(admin), 'no sideways scroll');

const H = 3600 * 1000, NOW = 1e12;
const ctx = { window: {}, document: { addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} }, console, Math, Date, Set, Map, Array, String, Number, JSON, Object, Infinity };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const ts = (msv) => ({ toMillis: () => msv });

const U = [
    { id: 'a', group: 'A', on: true }, { id: 'b', group: 'A', on: true }, { id: 'c', group: 'A', on: true }, { id: 'd', group: 'B', on: true },
    { id: 'old', group: 'A', on: false },   // internship over → not counted
    { id: 'st', group: 'staff', on: true }, // staff never counted
];
const Q = [
    { id: 'q1', title: 'Closes in 10 h, 1/3 done', isActive: true, targetGroup: 'A', deadline: ts(NOW + 10 * H) },
    { id: 'q2', title: 'Closes in 5 d, 0/4', isActive: true, targetGroup: 'Public', deadline: ts(NOW + 120 * H) },
    { id: 'q3', title: 'Closes in 20 h, 3/3', isActive: true, targetGroup: 'A', deadline: ts(NOW + 20 * H) },
    { id: 'q4', title: 'No deadline, 2/3', shortTitle: 'Q4 short', isActive: true, targetGroup: 'A' },
    { id: 'q5', title: 'Assigned b+d only, both done, 48 h', isActive: true, assignedUsers: ['b', 'd'], deadline: ts(NOW + 48 * H) },
    { id: 'q6', title: 'Group A,B list, 60 h, 1/4', isActive: true, targetGroup: 'A,B', deadline: ts(NOW + 60 * H) },
    { id: 'q7', title: 'Nobody in group Z', isActive: true, targetGroup: 'Z', deadline: ts(NOW + 5 * H) },
    { id: 'ended', title: 'ended', isActive: true, deadline: ts(NOW - H) }, { id: 'off', title: 'paused', isActive: false },
    { id: 'poll', title: 'poll', isActive: true, isPoll: true }, { id: 'tpl', title: 'template', isActive: true, isTemplate: true },
    { id: '--cfg', isActive: true }, { id: 'rev', title: 'revision', isActive: true, isHistoryRevision: true },
];
const A = [
    { quizId: 'q1', userId: 'a', status: 'approved' }, { quizId: 'q1', userId: 'b', status: 'started' }, { quizId: 'q1', userId: 'c', status: 'approved', isPractice: true },
    { quizId: 'q1', userId: 'old', status: 'approved' }, { quizId: 'q1', userId: 'st', status: 'approved' }, { quizId: 'q1', userId: 'a', status: 'completed' },   // repeat counts once
    ...['a', 'b', 'c'].map(u => ({ quizId: 'q3', userId: u, status: u === 'c' ? 'pending' : 'graded' })),
    { quizId: 'q4', userId: 'a', status: 'approved' }, { quizId: 'q4', userId: 'b', status: 'approved' }, { quizId: 'q4', userId: 'c', status: 'approved', isDismissed: true },
    { quizId: 'q5', userId: 'b', status: 'approved' }, { quizId: 'q5', userId: 'd', status: 'approved' },
    { quizId: 'q6', userId: 'd', status: 'requesting' }, { quizId: 'q6', userId: 'a', status: 'approved' },
];
const build = (hours, share) => JSON.parse(JSON.stringify(ctx.quizMatrixBuild(Q, U, A, { now: NOW, hours, share, isActive: u => u.on })));
const ids = (r) => Object.fromEntries(Object.entries(r.quads).map(([k, l]) => [k, l.map(x => x.id)]));

// 1. defaults 72 h / 50 %
let r = build(72, 50);
assert.equal(r.total, 7, 'live only: ended / paused / poll / template / config / revision left out');
assert.deepEqual(ids(r), { do: ['q1', 'q6'], plan: ['q2'], watch: ['q7', 'q3', 'q5'], fine: ['q4'] }, JSON.stringify(ids(r)));
const q1 = r.quads.do[0];
assert.deepEqual([q1.done, q1.total], [1, 3], 'q1: started / practice / past intern / staff do not count; a repeat counts once');
assert.equal(r.quads.fine[0].title, 'Q4 short', 'shortTitle shown when set');
assert.deepEqual([r.quads.fine[0].done, r.quads.fine[0].total], [2, 3], 'a dismissed attempt is not done');
assert.deepEqual([r.quads.watch[2].done, r.quads.watch[2].total], [2, 2], 'assignedUsers beat the group');
assert.deepEqual([r.quads.do[1].done, r.quads.do[1].total], [1, 4], 'a comma list of groups targets both');
assert.equal(r.quads.watch[0].total, 0, 'nobody targeted → never important');
// 2. the chips move quizzes
r = build(24, 50);
assert.deepEqual(ids(r), { do: ['q1'], plan: ['q6', 'q2'], watch: ['q7', 'q3'], fine: ['q5', 'q4'] }, '24 h: 48 h / 60 h quizzes stop being urgent');
r = build(168, 70);
assert.deepEqual(ids(r), { do: ['q1', 'q6', 'q2'], plan: ['q4'], watch: ['q7', 'q3', 'q5'], fine: [] }, '7 d / 70 %: ' + JSON.stringify(ids(r)));
r = build(72, 30);
assert.deepEqual(ids(r).do, ['q6'], '30 %: 1/3 (33 %) is no longer under the bar, 1/4 (25 %) is');
assert.equal(ctx.quizMatrixBuild([], [], [], { now: NOW, hours: 72, share: 50, isActive: () => true }).total, 0, 'nothing live → empty');

// Part 2: the real card
(async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    try {
        for (const [name, width] of [['desktop', 1280], ['phone', 375]]) {
            const page = await browser.newPage({ viewport: { width, height: 800 } });
            await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/quiz-matrix.js')).href);   // a real (file) origin so localStorage works
            await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div style="padding:12px"><div id="qmx-card" class="lang-no-toggle" hidden></div></div>`);
            await page.evaluate(() => localStorage.removeItem('qmx'));
            await page.evaluate(([q, u, a, now]) => {
                const t = (o) => o && o.deadline ? { ...o, deadline: { toMillis: () => o.deadline } } : o;
                const shift = Date.now() - now;   // re-anchor the fixtures on the real clock
                window.quizzesData = q.map(x => t(x.deadline ? { ...x, deadline: x.deadline + shift } : x));
                window.usersData = u; window.quizAttemptsAllCache = a;
                window.hwIsActiveUser = (x) => x.on;
                window.calls = []; window.showQuizParticipants = (id) => window.calls.push(id);
            }, [Q.map(x => x.deadline ? { ...x, deadline: x.deadline.toMillis() } : x), U, A, NOW]);
            await page.addScriptTag({ content: js });
            await page.evaluate(() => window.quizMatrix.refresh());
            const ui = await page.evaluate(() => {
                const qs = [...document.querySelectorAll('#qmx-card .qmx-q')].map(e => e.getBoundingClientRect());
                return {
                    hidden: document.getElementById('qmx-card').hidden,
                    counts: [...document.querySelectorAll('#qmx-card .qmx-qh b')].map(b => b.textContent),
                    cols: new Set(qs.map(r => Math.round(r.left))).size, rows: new Set(qs.map(r => Math.round(r.top))).size,
                    scroll: document.documentElement.scrollWidth > window.innerWidth,
                    pressed: [...document.querySelectorAll('#qmx-card .qmx-chip[aria-pressed="true"]')].map(b => b.textContent),
                    meta: document.querySelector('#qmx-card .qmx-do .qmx-meta').textContent,
                    cd: !!document.querySelector('#qmx-card .qmx-do .qmx-meta .quiz-countdown[data-short="1"][data-deadline]'),
                    chipW: Math.max(...[...document.querySelectorAll('#qmx-card .qmx-chip')].map(b => b.getBoundingClientRect().width))
                };
            });
            assert.equal(ui.hidden, false, name);
            assert.deepEqual(ui.counts, ['2', '1', '3', '1'], name + ': Do first · Plan · Watch · On track');
            assert.deepEqual([ui.cols, ui.rows], [2, 2], name + ': a 2 × 2 grid');
            assert.equal(ui.scroll, false, name + ': no sideways scroll');
            assert.deepEqual(ui.pressed, ['72 h', '50%'], name + ': defaults');
            assert.ok(ui.meta.startsWith('1/3 · 33% · ') && ui.cd, name + ': done/total · % · the shared countdown span — got ' + ui.meta);
            assert.ok(ui.chipW < 90, name + ': chips are not stretched by the global button rule');
            // chips move quizzes and are remembered
            await page.click('#qmx-card .qmx-chip[data-h="24"]');
            assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#qmx-card .qmx-qh b')].map(b => b.textContent)), ['1', '2', '2', '2'], name + ': 24 h');
            assert.equal(await page.evaluate(() => localStorage.getItem('qmx')), '{"h":24,"p":50}', name + ': remembered');
            // a quiz opens Participants
            await page.click('#qmx-card .qmx-do .qmx-item');
            assert.deepEqual(await page.evaluate(() => window.calls), ['q1'], name + ': opens 👥 Participants');
            if (name === 'phone') await page.screenshot({ path: process.env.QMX_SHOT || 'output/quiz-matrix-phone.png', fullPage: true }).catch(() => {});
            await page.close();
        }
        // Part 3 (V102.501): #quiz-dash — ≥1100 px ONE card, Up next rows on the left, the grid on the right; narrower = stacked;
        // a hidden half lets the other take the whole card; an empty box is just its header line
        const upJs = fs.readFileSync('public/up-next.js', 'utf8');
        assert.ok(admin.includes('<div id="quiz-dash"><div id="upnext-card" class="lang-no-toggle" hidden></div><div id="qmx-card" class="lang-no-toggle" hidden></div></div>'), 'both halves inside #quiz-dash');
        for (const [name, width] of [['wide', 1280], ['narrow', 390]]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/quiz-matrix.js')).href);
            await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div style="padding:12px"><div id="quiz-dash"><div id="upnext-card" class="lang-no-toggle" hidden></div><div id="qmx-card" class="lang-no-toggle" hidden></div></div></div>`);
            await page.evaluate(([q, u, a, now]) => {
                const shift = Date.now() - now;
                window.quizzesData = q.map(x => x.deadline ? { ...x, deadline: { toMillis: () => x.deadline + shift } } : x)
                    .concat([{ id: 'p1', title: 'Paused one', isActive: false }, { id: 'p2', title: 'Paused two', isActive: false }, { id: 'p3', title: 'Paused three', isActive: false }]);
                window.usersData = u; window.quizAttemptsAllCache = a; window.hwIsActiveUser = (x) => x.on;
                window.escapeHtml = s => String(s); window.showQuizParticipants = () => {};
                window.db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: () => Promise.resolve({ docs: [] }) }) }) }) };
            }, [Q.map(x => x.deadline ? { ...x, deadline: x.deadline.toMillis() } : x), U, A, NOW]);
            await page.evaluate(() => localStorage.setItem('qmx', '{"h":168,"p":70}'));   // 7 d / 70 % leaves ✅ On track empty
            await page.addScriptTag({ content: js });
            await page.addScriptTag({ content: upJs });
            await page.evaluate(() => { window.quizMatrix.refresh(); window.upNext.refresh(); });
            await page.waitForFunction(() => document.querySelectorAll('#upnext-card .un-tile').length >= 3);
            const g = await page.evaluate(() => {
                const r = (s) => document.querySelector(s).getBoundingClientRect();
                const cs = (s) => getComputedStyle(document.querySelector(s));
                const tiles = [...document.querySelectorAll('#upnext-card .un-tile')].map(e => e.getBoundingClientRect());
                return {
                    up: r('#upnext-card'), mx: r('#qmx-card'), dashBorder: cs('#quiz-dash').borderTopWidth, upBorder: cs('#upnext-card').borderTopWidth,
                    tileCols: new Set(tiles.map(t => Math.round(t.left))).size, tileH: Math.max(...tiles.map(t => t.height)),
                    scroll: document.documentElement.scrollWidth > window.innerWidth,
                    emptyH: document.querySelector('#qmx-card .qmx-q.is-empty').getBoundingClientRect().height
                };
            });
            assert.equal(g.scroll, false, name + ': no sideways scroll');
            assert.ok(g.emptyH < 40, name + ': the empty box is one header line, got ' + g.emptyH);
            if (name === 'wide') {
                assert.equal(g.dashBorder, '1px', 'wide: #quiz-dash is the card'); assert.equal(g.upBorder, '0px', 'wide: the halves lose their own frame');
                assert.ok(Math.abs(g.up.top - g.mx.top) < 2 && g.up.right <= g.mx.left, 'wide: Up next left, grid right, same top');
                assert.ok(g.mx.width > g.up.width, 'wide: the grid gets the wider half (2 : 3)');
                assert.equal(g.tileCols, 1, 'wide: Up next is one row per topic'); assert.ok(g.tileH < 46, 'wide: rows are one line tall, got ' + g.tileH);
                await page.evaluate(() => { document.getElementById('upnext-card').hidden = true; });
                const solo = await page.evaluate(() => [document.getElementById('qmx-card').getBoundingClientRect().width, document.getElementById('quiz-dash').getBoundingClientRect().width]);
                assert.ok(solo[0] > solo[1] - 40, 'wide: Up next hidden → the grid takes the whole card');
                await page.evaluate(() => { document.getElementById('qmx-card').hidden = true; });
                assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('quiz-dash')).borderTopWidth), '0px', 'wide: both hidden → no empty card');
            } else {
                assert.equal(g.dashBorder, '0px', 'narrow: no outer card'); assert.equal(g.upBorder, '1px', 'narrow: two cards as before');
                assert.ok(g.mx.top >= g.up.bottom, 'narrow: stacked, Up next first'); assert.equal(g.tileCols, 2, 'narrow: Up next tiles 2 across as before');
            }
            await page.close();
        }
    } finally { await browser.close(); }
    console.log('quiz-matrix-qa: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
