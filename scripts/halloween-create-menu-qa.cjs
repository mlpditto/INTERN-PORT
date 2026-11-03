// V102.493: Halloween Create menu — midnight card + dashed orange border + hazard tape, only 20 Oct – 2 Nov (Bangkok).
// V102.581: the theme chip beside Create — Auto (by date) · 🎃 Halloween · ⚪ Off, kept in this browser (localStorage admin_theme).
const assert = require('assert');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const admin = fs.readFileSync('public/admin.html', 'utf8');
const ms = admin.indexOf('<div id="createMenuModal" class="modal">');
assert(ms > 0, 'modal markup');
const modal = admin.slice(ms, admin.indexOf('\n        <div id="', ms + 10));
const ss = admin.indexOf('<script>/* V102.491 Halloween header');
const script = admin.slice(ss, admin.indexOf('</script>', ss)).replace(/^<script>/, '');
const cs = admin.indexOf('/* V102.493: Halloween Create menu');
const endMark = 'h2::after { animation:none; } }';
const css = admin.slice(cs, admin.indexOf(endMark, cs) + endMark.length);
assert(cs > 0 && css.includes('@keyframes hwFly') && css.includes('prefers-reduced-motion'), 'css block');
const rowCount = (modal.match(/class="create-menu-row"/g) || []).length;
assert(rowCount >= 6, 'rows found: ' + rowCount);

(async () => {
    const browser = await chromium.launch();
    try {
        const run = async (iso, pick, taps) => {
            const page = await browser.newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.clock.install({ time: new Date(iso) });
            // a real origin so localStorage works (about:blank denies it)
            await page.route('http://qa.local/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script>' + (pick ? 'localStorage.setItem("admin_theme", "' + pick + '");' : 'localStorage.clear();') + '<\/script><style>.modal-content{background:#fff;padding:20px;width:480px}#createMenuModal .create-menu-row:hover{background:#f8fafc !important}' + css + '</style><body>' + modal.replace('class="modal"', 'class="modal" style="display:block"') + '<script>' + script + '<\/script>' }));
            await page.goto('http://qa.local/');
            await page.waitForFunction(() => document.readyState === 'complete');
            for (let k = 0; k < (taps || 0); k++) await page.click('#admin-theme-chip');
            const r = await page.evaluate(() => {
                const cs = (el, p, pseudo) => getComputedStyle(el, pseudo)[p];
                const mc = document.querySelector('#createMenuModal .modal-content');
                const rows = [...document.querySelectorAll('#createMenuModal .create-menu-row')];
                return {
                    hw: document.documentElement.classList.contains('hw'),
                    h2: document.querySelector('#createMenuModal h2 .hw-ico').textContent + ' Create',
                    chip: [document.getElementById('admin-theme-chip').textContent, document.getElementById('admin-theme-chip').title, localStorage.getItem('admin_theme')],
                    borderStyle: cs(mc, 'borderTopStyle'), tape: cs(mc, 'content', '::before'), web: cs(mc, 'content', '::after'),
                    bat: cs(document.querySelector('#createMenuModal h2'), 'content', '::after'),
                    ic: [0, 1].map(i => cs(rows[i].children[0], 'backgroundColor')),
                    title: cs(rows[0].children[1].children[0], 'color'),
                    sub: cs(rows[0].children[1].querySelector('small'), 'color'),
                };
            });
            assert.deepEqual(errs, [], 'no page errors');
            await page.close();
            return r;
        };
        const on = await run('2026-10-29T05:00:00Z');
        assert.equal(on.hw, true);
        assert.equal(on.h2, '🎃 Create');
        assert.equal(on.borderStyle, 'dashed', 'orange dashed border');
        assert(on.tape.includes('"') && on.web.includes('🕸') && on.bat.includes('🦇'), 'tape / web / bat pseudo-elements: ' + JSON.stringify(on));
        assert.notEqual(on.ic[0], on.ic[1], 'icon rings alternate orange / purple');
        assert.equal(on.title, 'rgb(245, 236, 255)', 'row title light on the dark card');
        assert.equal(on.sub, 'rgb(185, 166, 217)');
        const off = await run('2026-12-25T05:00:00Z');
        assert.equal(off.hw, false);
        assert.equal(off.h2, '➕ Create', 'normal icon out of season');
        assert.notEqual(off.borderStyle, 'dashed');
        assert(off.web === 'none' || off.web === 'normal', 'no web out of season: ' + off.web);
        assert.deepEqual(on.chip, ['🗓 Auto · 🎃', 'Theme for this browser: Auto — Halloween 20 Oct – 2 Nov. Tap for Halloween', null], 'Auto in season: ' + JSON.stringify(on.chip));
        assert.deepEqual(off.chip[0], '🗓 Auto · plain');
        const forced = await run('2026-12-25T05:00:00Z', 'hw');
        assert.equal(forced.hw, true, '🎃 Halloween picked: on in December'); assert.equal(forced.h2, '🎃 Create'); assert.equal(forced.chip[0], '🎃 Halloween');
        const quiet = await run('2026-10-29T05:00:00Z', 'off');
        assert.equal(quiet.hw, false, '⚪ Off picked: plain in season'); assert.equal(quiet.h2, '➕ Create', 'the icon goes back too'); assert.equal(quiet.chip[0], '⚪ Off');
        const tap1 = await run('2026-12-25T05:00:00Z', '', 1);
        assert.deepEqual([tap1.hw, tap1.h2, tap1.chip[0], tap1.chip[2]], [true, '🎃 Create', '🎃 Halloween', 'hw'], 'a tap: Auto → Halloween, saved');
        const tap3 = await run('2026-12-25T05:00:00Z', '', 3);
        assert.deepEqual([tap3.hw, tap3.h2, tap3.chip[0], tap3.chip[2]], [false, '➕ Create', '🗓 Auto · plain', 'auto'], 'three taps come back to Auto');
        console.log('halloween-create-menu-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
