// V102.197 — tap the user's photo in the profile modal: a Camp (hidden-from-boards) user shows a grey photo + 🙈 and the menu brings them back with one tap;
// an active user can be hidden the same way. The real page + the real setUserGroup / gsPic* functions in Chromium.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/id="gs-pic-btn"[^>]*onclick="gsPicToggleMenu\(event\)"/.test(html) && html.includes('id="gs-pic-menu"'), 'the photo is a button with a menu');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        const opened = await page.evaluate(() => {
            window.__toggled = []; window.__toasts = [];
            toggleIgnoreUser = (id, s) => { window.__toggled.push([id, s]); };   // the Firestore write — stubbed
            showToast = m => window.__toasts.push(m);
            usersData = [{ id: 'u1', displayName: 'Ploy', group: 'Content Creator', isIgnored: true, pictureUrl: '' }, { id: 'u2', displayName: 'Mint', group: 'Public', pictureUrl: '' }];
            preRegData = [];
            // the modal is hidden behind the login gate: show its ancestors so real clicks work
            const m = document.getElementById('groupSelectModal'); let e = m; while (e && e !== document.documentElement) { if (getComputedStyle(e).display === 'none') e.style.setProperty('display', 'block', 'important'); e = e.parentElement; }
            try { setUserGroup('u1', 'Content Creator'); } catch (err) { return String(err && err.message || err); }
            return 'ok';
        });
        assert.equal(opened, 'ok', 'setUserGroup threw: ' + opened);
        const st = () => page.evaluate(() => ({ hiddenCls: document.getElementById('gs-pic-btn').classList.contains('is-hidden'), badge: !document.getElementById('gs-pic-badge').hidden, menuOpen: !document.getElementById('gs-pic-menu').hidden, menu: document.getElementById('gs-pic-menu').textContent.replace(/\s+/g, ' ').trim(), title: document.getElementById('gs-pic-btn').title }));
        let s = await st();
        assert.equal(s.hiddenCls, true, 'a Camp user: grey photo'); assert.equal(s.badge, true, '…with the 🙈 badge'); assert.equal(s.menuOpen, false, 'menu closed until tapped');
        assert.match(s.title, /Hidden from boards \(Camp\)/);
        // tap the photo → menu with ONE action: Show on boards
        await page.evaluate(() => document.getElementById('gs-pic-btn').click());
        s = await st(); assert.equal(s.menuOpen, true); assert.match(s.menu, /Hidden from boards/); assert.match(s.menu, /👀 Show on boards/); assert.ok(!/Hide from boards/.test(s.menu), 'only the way back is offered');
        assert.equal(await page.$eval('#gs-pic-btn', e => e.getAttribute('aria-expanded')), 'true');
        // …and the menu is on screen, not clipped by the modal header
        const box = await page.evaluate(() => { const r = document.getElementById('gs-pic-menu').getBoundingClientRect(), m = document.querySelector('#groupSelectModal .modal-content').getBoundingClientRect(); const top = document.elementFromPoint(r.left + 20, r.top + 20); return { inside: r.left >= m.left - 1 && r.right <= m.right + 1 && r.top >= m.top - 1, hit: !!(top && top.closest('#gs-pic-menu')) }; });
        assert.deepEqual(box, { inside: true, hit: true }, 'the menu is visible inside the modal and clickable');
        // Show on boards → writes isIgnored = false (toggleIgnoreUser(id, currentIsIgnored=true)), repaints, closes, toasts
        await page.evaluate(() => document.querySelector('#gs-pic-menu .gs-pic-act').click());
        assert.equal(JSON.stringify(await page.evaluate(() => window.__toggled)), JSON.stringify([['u1', true]]), 'toggleIgnoreUser(u1, true) → isIgnored becomes false');
        s = await st(); assert.equal(s.hiddenCls, false); assert.equal(s.badge, false); assert.equal(s.menuOpen, false);
        assert.ok(/back on the boards/.test(await page.evaluate(() => window.__toasts[0])), 'toast: back on the boards');
        // now active → the menu offers Hide
        await page.evaluate(() => document.getElementById('gs-pic-btn').click());
        s = await st(); assert.match(s.menu, /On the boards/); assert.match(s.menu, /🙈 Hide from boards/); assert.ok(!/Show on boards/.test(s.menu));
        // outside click and Esc close it
        await page.evaluate(() => document.body.click()); assert.equal((await st()).menuOpen, false, 'outside click closes');
        await page.evaluate(() => document.getElementById('gs-pic-btn').click());
        await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); assert.equal((await st()).menuOpen, false, 'Esc closes');
        // hide it again
        await page.evaluate(() => document.getElementById('gs-pic-btn').click());
        await page.evaluate(() => document.querySelector('#gs-pic-menu .gs-pic-act').click());
        assert.equal(JSON.stringify(await page.evaluate(() => window.__toggled[1])), JSON.stringify(['u1', false]), 'toggleIgnoreUser(u1, false) → isIgnored becomes true');
        s = await st(); assert.equal(s.hiddenCls, true); assert.equal(s.badge, true);
        // another user opens active (no badge, state is per user)
        await page.evaluate(() => { setUserGroup('u2', 'Public'); });
        s = await st(); assert.equal(s.hiddenCls, false); assert.equal(s.badge, false); assert.equal(s.menuOpen, false);
        // a live snapshot flips the state while the modal is open
        await page.evaluate(() => { usersData.find(x => x.id === 'u2').isIgnored = true; gsPicPaint(); });
        assert.equal((await st()).hiddenCls, true, 'follows the live user doc');
        assert.deepEqual(errs.filter(e => /gsPic|setUserGroup|toggleIgnoreUser|gs-pic/.test(e)), [], 'no page errors from this feature (the stubbed-network boot errors are unrelated)');
        console.log('PASS: profile photo = Camp switch — grey + 🙈 for a hidden user, one tap Show on boards (isIgnored false), Hide for an active one, menu inside the modal, outside/Esc close, state follows the user doc');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
