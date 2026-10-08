// V102.127: Review Link logo from a direct picture link.
//  1. server — findLinkLogo returns the picture itself when the link IS an image, and still reads og:image from a page
//  2. admin modal — 🖼 Image link row → fetchLinkLogo(url) → approval → logo set (real admin.html code, stubbed Firebase)
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const BIG_PNG = Buffer.concat([PNG, Buffer.alloc(400)]);   // the link-logo guard rejects < 200 bytes
const HTML = Buffer.from('<html><head><meta property="og:image" content="https://cdn.example.test/logo.png"></head></html>');

// ---- 1. server (axios replaced so no network / no functions/node_modules needed) ----
function fakeAxios(routes) {
    return { get: async url => {
        const r = routes[url];
        if (!r) return { status: 404, headers: {}, data: Buffer.alloc(0) };
        return { status: 200, headers: { 'content-type': r.type }, data: r.body };
    } };
}
function loadLinkLogo(routes) {
    const orig = Module._load;
    Module._load = function (request, ...rest) { return request === 'axios' ? fakeAxios(routes) : orig.call(this, request, ...rest); };
    const file = path.join(__dirname, '..', 'functions', 'link-logo.js');
    delete require.cache[file];
    try { return require(file); } finally { Module._load = orig; }
}
// dns.lookup is only reached through the agents, which the fake axios never uses — hosts below are public names
const routes = {
    'https://scontent.example.test/pic.jpg?sig=1': { type: 'image/jpeg', body: BIG_PNG },
    'https://shop.example.test/': { type: 'text/html; charset=utf-8', body: HTML },
    'https://cdn.example.test/logo.png': { type: 'image/png', body: BIG_PNG },
    'https://tiny.example.test/x.png': { type: 'image/png', body: PNG },
    'https://text.example.test/': { type: 'text/plain', body: Buffer.from('hello') },
};
(async () => {
    const { findLinkLogo } = loadLinkLogo(routes);
    const direct = await findLinkLogo('https://scontent.example.test/pic.jpg?sig=1');
    assert.equal(direct.found, true);
    assert.equal(direct.source, 'image link');
    assert.match(direct.dataUrl, /^data:image\/jpeg;base64,/);
    const page = await findLinkLogo('https://shop.example.test/');
    assert.equal(page.found, true);
    assert.equal(page.source, 'og:image');
    assert.equal((await findLinkLogo('https://tiny.example.test/x.png')).found, false);
    assert.equal((await findLinkLogo('https://text.example.test/')).found, false);

    // ---- 2. admin modal ----
    const { chromium } = require('playwright');
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
    const open = html.indexOf('<div id="reviewLinkModal"');
    let depth = 0, end = open;
    for (const m of html.slice(open).matchAll(/<div\b|<\/div>/g)) {
        depth += m[0] === '</div>' ? -1 : 1;
        if (depth === 0) { end = open + m.index + m[0].length; break; }
    }
    const modalHtml = html.slice(open, end);
    const fnStart = html.indexOf('function rlLogoDisc(');
    const fnEnd = html.indexOf('async function saveReviewLink()');
    assert.ok(open > 0 && end > open && fnStart > 0 && fnEnd > fnStart, 'anchors found');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<style>input,select,textarea{width:100%;margin-bottom:10px}button{width:100%}</style>' + modalHtml);
        await page.evaluate(({ png, funcs }) => {
            window.calls = [];
            window.reviewLinksCache = []; window.REVIEW_LINK_TYPE_ICON = {};
            window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
            window.forceShowModal = () => {}; window.forceHideModal = () => {};
            window._sha256Hex = async () => 'abc123';
            window.adminApp = {
                functions: () => ({ httpsCallable: () => async req => { calls.push(req.url); return { data: req.url.includes('dead') ? { found: false, candidates: 1 } : { found: true, source: 'image link', dataUrl: 'data:image/png;base64,' + png } }; } }),
                storage: () => ({ ref: () => ({ getDownloadURL: async () => 'https://storage.example.test/link-logos/abc123.webp' }) }),
            };
            const s = document.createElement('script'); s.textContent = funcs; document.head.appendChild(s);
        }, { png: PNG.toString('base64'), funcs: html.slice(fnStart, fnEnd) });
        await page.evaluate(() => { openReviewLinkModal(null); document.getElementById('reviewLinkModal').style.display = 'block'; });
        assert.equal(await page.locator('#rl-imglink-row').isVisible(), false);
        await page.locator('#rl-logo-imglink').click();
        assert.equal(await page.locator('#rl-imglink-row').isVisible(), true);
        const w = await page.evaluate(() => { const i = document.getElementById('rl-imglink').getBoundingClientRect(), b = document.getElementById('rl-imglink-use').getBoundingClientRect(); return { i: i.width, b: b.width, sameRow: Math.abs(i.top - b.top) < 12 }; });
        assert.ok(w.sameRow && w.b < 120 && w.i > 150, 'input and Use share one row (global width trap): ' + JSON.stringify(w));
        // a bad link never reaches the server
        await page.fill('#rl-imglink', 'not a link');
        await page.locator('#rl-imglink-use').click();
        assert.match(await page.locator('#rl-logo-msg').innerText(), /https:\/\//);
        assert.equal(await page.evaluate(() => calls.length), 0);
        // an unusable link explains itself
        await page.fill('#rl-imglink', 'https://dead.example.test/x.jpg');
        await page.locator('#rl-imglink-use').click();
        await page.waitForFunction(() => /did not give a usable picture/.test(document.getElementById('rl-logo-msg').textContent));
        assert.equal(await page.locator('#rl-logo-url').inputValue(), '');
        // a good link → approval overlay → logo set, row folds away
        await page.fill('#rl-imglink', 'https://scontent.example.test/pic.jpg?sig=1');
        await page.locator('#rl-imglink-use').click();
        await page.locator('[data-yes]').click();
        await page.waitForFunction(() => document.getElementById('rl-logo-url').value !== '');
        assert.equal(await page.locator('#rl-logo-url').inputValue(), 'https://storage.example.test/link-logos/abc123.webp');
        assert.match(await page.locator('#rl-logo-msg').innerText(), /from image link/);
        assert.equal(await page.locator('#rl-imglink-row').isVisible(), false);
        assert.equal(await page.evaluate(() => calls.at(-1)), 'https://scontent.example.test/pic.jpg?sig=1');
        // Fetch from link still reads the URL field, not the image row
        await page.fill('#rl-url', 'https://shop.example.test/');
        await page.locator('#rl-logo-fetch').click();
        await page.locator('[data-no]').click();
        assert.equal(await page.evaluate(() => calls.at(-1)), 'https://shop.example.test/');
        assert.deepEqual(errors, []);
        console.log('PASS: direct image link downloads server-side; page links still read og:image; Image link row (width, validation, approval, reset)');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
