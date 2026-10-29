// V102.491: Halloween header — Create / Logout wear the season 20 Oct – 2 Nov (Bangkok), then go back on their own.
const assert = require('assert');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const admin = fs.readFileSync('public/admin.html', 'utf8');
const sliceBetween = (from, to) => { const s = admin.indexOf(from); assert(s > 0, from + ' missing'); return admin.slice(s, admin.indexOf(to, s) + to.length); };
const create = sliceBetween('<button class="btn-sm" id="btn-create"', '</button>');
const logout = sliceBetween('<button class="btn-sm" id="btn-logout"', '</button>');
const script = sliceBetween('<script>/* V102.491 Halloween header', '</script>').replace(/^<script>|<\/script>$/g, '');
const cssStart = admin.indexOf('html.hw #btn-create {');
const css = admin.slice(cssStart, admin.indexOf('.u-flood-blink', cssStart));
assert(cssStart > 0 && css.includes('@keyframes hwBob') && css.includes('prefers-reduced-motion'), 'css block');

(async () => {
    const browser = await chromium.launch();
    try {
        const run = async (iso) => {
            const page = await browser.newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.clock.install({ time: new Date(iso) });
            await page.setContent('<!doctype html><meta charset="utf-8"><style>' + css + '</style><body>' + create + logout + '<script>' + script + '<\/script>');
            await page.waitForFunction(() => document.readyState === 'complete');
            const r = await page.evaluate(() => ({
                hw: document.documentElement.classList.contains('hw'),
                icons: [...document.querySelectorAll('.hw-ico')].map(e => e.textContent),
                createBg: getComputedStyle(document.getElementById('btn-create')).backgroundImage,
                logoutBg: getComputedStyle(document.getElementById('btn-logout')).backgroundImage,
            }));
            assert.deepEqual(errs, [], 'no page errors');
            await page.close();
            return r;
        };
        for (const iso of ['2026-10-19T17:30:00Z', '2026-10-29T05:00:00Z', '2026-11-02T16:00:00Z']) {
            const r = await run(iso);
            assert.equal(r.hw, true, iso + ' is in season');
            assert.deepEqual(r.icons, ['🎃', '🕸️'], iso);
            assert(r.createBg.includes('gradient') && r.logoutBg.includes('gradient'), iso + ': season gradients win over the inline background');
        }
        for (const iso of ['2026-10-19T16:30:00Z', '2026-11-02T17:30:00Z', '2026-12-25T05:00:00Z']) {
            const r = await run(iso);
            assert.equal(r.hw, false, iso + ' is out of season');
            assert.deepEqual(r.icons, ['➕', '👋'], iso + ': the normal icons stay');
        }
        console.log('halloween-header-qa: PASS');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
