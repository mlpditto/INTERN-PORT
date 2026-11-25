// V102.700: admin Dashboard 🥣 Cereal line (public/cereal-admin.js, owner pick A, mockup-cereal-admin/). Part 1: count() in a vm —
// playing / finished / lobby, people counted once, cancelled left out. Part 2: the real strip with admin.html's CSS on 1280 + 390 px —
// one query (updatedAt ≥ now − 7 d), numbers in chips, 🚪 only when a room waits, hidden when all 0 or the read fails, a 5-min throttle,
// no names, no buttons, no sideways scroll.   node scripts/cereal-admin-qa.cjs
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), url = require('node:url');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8'), js = fs.readFileSync('public/cereal-admin.js', 'utf8');

// static pins
assert.ok(/<div id="ck-admin-strip" class="lang-no-toggle" hidden><\/div>\s*(<!--[^>]*-->\s*)?<div id="gt-admin"[^>]*><\/div>\s*<div id="quiz-dash">/.test(admin), 'the strip sits above #quiz-dash (V102.704: the 🎮 game time card right under it)');
assert.ok(/<script src="cereal-admin\.js\?v=V102\.\d+"><\/script>/.test(admin), 'script loaded');
assert.ok(/window\.upNext\.refresh\(\);[^\n]*\n\s*if \(window\.cerealAdmin\) window\.cerealAdmin\.refresh\(\);/.test(admin), 'refreshed with the quiz list, after 🚀 Up next');

// Part 1: count()
const ctx = { window: {}, document: { getElementById: () => null }, Date, Object, Math };
ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
const P = (uid) => ({ uid, authUid: 'a' + uid, name: 'N' + uid });
const G = [
    { status: 'playing', players: { killer: P('u1'), detective: P('u2') } },
    { status: 'playing', players: { killer: P('u3'), lola: P('u1'), detective: P('u4') } },
    { status: 'finished', players: { killer: P('u2'), detective: P('u5') } },
    { status: 'lobby', players: { killer: P('u6'), detective: null } },
    { status: 'cancelled', players: { killer: P('u9'), detective: null } },
];
assert.deepEqual(JSON.parse(JSON.stringify(ctx.cerealAdmin.count(G))), { playing: 2, done: 1, lobby: 1, people: 6 }, 'u1/u2 once each, the cancelled room (u9) not counted');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.cerealAdmin.count([]))), { playing: 0, done: 0, lobby: 0, people: 0 });

// Part 2: the real strip
(async () => {
    const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');
    const browser = await chromium.launch();
    try {
        for (const [name, width] of [['wide', 1280], ['phone', 390]]) {
            const page = await browser.newPage({ viewport: { width, height: 700 } });
            await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><div style="padding:12px"><div id="ck-admin-strip" class="lang-no-toggle" hidden></div><div id="quiz-dash"></div></div>`);
            await page.evaluate((G) => {
                window.__q = []; window.__docs = G; window.__fail = false;
                window.db = { collection: (c) => ({ where: (f, op, v) => ({ get: () => { window.__q.push([c, f, op, v]); return window.__fail ? Promise.reject(new Error('denied')) : Promise.resolve({ docs: window.__docs.map(d => ({ data: () => d })) }); } }) }) };
            }, G);
            await page.addScriptTag({ content: js });
            const t0 = Date.now();
            await page.evaluate(() => window.cerealAdmin.refresh());
            await page.waitForFunction(() => !document.getElementById('ck-admin-strip').hidden);
            const q = await page.evaluate(() => window.__q);
            assert.equal(q.length, 1, name + ': one query');
            assert.deepEqual(q[0].slice(0, 3), ['cereal_games', 'updatedAt', '>='], name + ': by updatedAt');
            assert.ok(Math.abs(q[0][3] - (t0 - 7 * 864e5)) < 60000, name + ': since 7 days ago');
            const ui = await page.evaluate(() => { const s = document.getElementById('ck-admin-strip'); return { text: s.innerText.replace(/\s+/g, ' ').trim(), buttons: s.querySelectorAll('button,a,input').length, scroll: document.documentElement.scrollWidth > innerWidth, rows: new Set([...s.querySelectorAll('.c')].map(c => Math.round(c.getBoundingClientRect().top))).size, bg: getComputedStyle(s).backgroundColor }; });
            assert.equal(ui.text, '🥣 Cereal 🎮 2 เล่นอยู่ 🏁 1 จบ · 7 วัน 👥 6 คน 🚪 1 ห้องรอเพื่อน', name + ': ' + ui.text);
            assert.equal(ui.buttons, 0, name + ': read-only');
            assert.ok(!/N u|Nu\d/.test(ui.text), name + ': no names');
            assert.equal(ui.scroll, false, name + ': no sideways scroll');
            assert.equal(ui.bg, 'rgb(255, 251, 235)', name + ': admin.html CSS applies');
            if (name === 'wide') assert.equal(ui.rows, 1, 'wide: one line');
            if (process.env.SHOT) await (await page.$('#ck-admin-strip')).screenshot({ path: path.join(process.env.SHOT, 'ck-admin-' + name + '.png') });
            // throttle: a second refresh within 5 min reads nothing; force reads again
            await page.evaluate(() => window.cerealAdmin.refresh());
            assert.equal(await page.evaluate(() => window.__q.length), 1, name + ': throttled');
            // no waiting room → no 🚪 chip; everything 0 → hidden; a failed read → hidden
            await page.evaluate(() => { window.__docs = window.__docs.filter(d => d.status !== 'lobby'); return window.cerealAdmin.refresh(true); });
            await page.waitForFunction(() => !/🚪/.test(document.getElementById('ck-admin-strip').innerText));
            await page.evaluate(() => { window.__docs = [{ status: 'cancelled', players: {} }]; window.cerealAdmin.refresh(true); });
            await page.waitForFunction(() => document.getElementById('ck-admin-strip').hidden);
            await page.evaluate(() => { window.__docs = [{ status: 'playing', players: {} }]; window.cerealAdmin.refresh(true); });
            await page.waitForFunction(() => !document.getElementById('ck-admin-strip').hidden);
            await page.evaluate(() => { window.__fail = true; window.cerealAdmin.refresh(true); });
            await page.waitForFunction(() => document.getElementById('ck-admin-strip').hidden);
            await page.close();
        }
    } finally { await browser.close(); }
    console.log('cereal-admin-qa: OK — count() (people once, cancelled out); the strip above #quiz-dash: one updatedAt ≥ 7 d query, 🎮 · 🏁 · 👥 · 🚪 chips, read-only, no names, one line on 1280, no sideways scroll at 390, 5-min throttle, hidden when all 0 or the read fails');
})().catch(e => { console.error(e); process.exit(1); });
