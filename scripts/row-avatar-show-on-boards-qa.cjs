// V102.211: in the Users list, tapping the photo of a hidden (Camp) user brings them back on the boards at once
// (toggleIgnoreUser(uid, true) writes isIgnored = false). An active user's photo is not clickable.
// The REAL avatarWithDot arrow cut from admin.html, run in Chromium with a recording toggleIgnoreUser.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('${avatarWithDot(d.id, d.pictureUrl, group, ignored)}'), 'the list row passes the hidden state');
const i = html.indexOf('const avatarWithDot = (uid, pic, grp, hidden) =>');
assert.ok(i >= 0, 'avatarWithDot takes a hidden flag');
const src = html.slice(i, html.indexOf('\n', i));

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.setContent('<div id="a"></div><div id="b"></div>');
        await page.evaluate(s => {
            window.calls = [];
            window.toggleIgnoreUser = (id, v) => window.calls.push(['toggle', id, v]);
            window.showToast = m => window.calls.push(['toast', m]);
            window.setUserGroup = () => {};
            window.escapeHtml = x => String(x);
            window.getGroupColor = () => '#888';
            const f = new Function(s.replace(/^const avatarWithDot =/, 'return') );
            const av = f();
            document.getElementById('a').innerHTML = av('u1', 'x.png', 'Junior', true);
            document.getElementById('b').innerHTML = av('u2', 'y.png', 'Junior', false);
        }, src);
        await page.$eval('#a img', e => e.click());
        assert.deepEqual(await page.evaluate(() => window.calls[0]), ['toggle', 'u1', true], 'tap on a hidden user\'s photo shows them on the boards');
        assert.equal(await page.evaluate(() => window.calls[1][0]), 'toast', 'a toast confirms');
        const n = await page.evaluate(() => window.calls.length);
        await page.$eval('#b img', e => e.click());
        assert.equal(await page.evaluate(() => window.calls.length), n, 'an active user\'s photo does nothing');
        console.log('PASS: Users list — tap a hidden user\'s photo = back on the boards; active photos untouched');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
