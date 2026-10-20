// V102.182: the Users summary panel (User Hub "Users (29)" + Copy per row, #1696) is folded INTO the Elite Board rows — Q·J·C chips
// (approved quizzes · journals · cases, green when > 0), last seen (🕓, fresh < 1 d / stale > 7 d), ⧉ copy per row (text on tr[data-copy])
// and ⧉ all in the header, 🕓↕ sort by last seen. The panel, its renderer and its five callers are gone. Static pins + the REAL row
// summary slice and the REAL copy / sort helpers.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(!html.includes('group-users-panel') && !html.includes('renderGroupUsersPanel'), 'the panel, its renderer and its callers are gone');
assert.ok(/id="user-seen-sort" onclick="toggleUserSeenSort\(\)"/.test(html) && /id="user-copy-all" onclick="copyAllUserRows\(\)"/.test(html), '🕓↕ and ⧉ all in the header');
assert.ok(html.includes("onclick=\"copyUserRow(this)\" title=\"Copy this row"), '⧉ in the row rail');
const railAt = html.indexOf('onclick="copyUserRow(this)"'), kebabAt = html.indexOf('class="u-row-kebab"', railAt);
assert.ok(kebabAt > railAt && kebabAt - railAt < 400, '⧉ sits right before ⋯');
assert.ok(html.includes('data-copy="${escapeHtml(_copyText)}"'), 'the copy text rides on the <tr>');
assert.ok(html.includes("if (window._userSeenSort) { const ls = u =>"), 'sort by last seen in renderTable');

function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', src.indexOf(')', i));
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
const slice = html.slice(html.indexOf("                    const logsN = reflectiveLogsCache.filter("), html.indexOf("                    tbody.innerHTML += `<tr class="));
const helpers = ['function toggleUserSeenSort(', 'function copyUserRow(', 'function copyAllUserRows('].map(m => grab(html, m)).join('\n');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><table id="usersTable"><thead><tr><th><button id="user-seen-sort" aria-pressed="false">🕓↕</button></th></tr></thead><tbody></tbody></table>');
        await page.addScriptTag({ content: [
            "var escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));",
            "var __toasts = [], __clip = []; var showToast = m => __toasts.push(m); var renders = 0; var renderTable = () => { renders++; };",
            "Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });",
            "var userBadgesCellHtml = () => '';",
            "var userBirthdayChipHtml = () => '';",   // V102.330: 🎂 chip (tested in birthday-this-month-qa)
            "var alabastaAgo = ts => { const min = Math.floor((Date.now() - ts.toMillis()) / 60000); return min < 60 ? min + ' min' : Math.floor(min / 1440) + ' d'; };",
            "var userSeenAgo = ts => { const min = Math.floor((Date.now() - ts.toMillis()) / 60000); return min < 60 ? min + 'm' : Math.floor(min / 1440) + 'd'; };",   // V102.188: the row uses userSeenAgo
            "var reflectiveLogsCache = [{ userId: 'u1' }, { userId: 'u1', isArchived: true }], quizAttemptsAllCache = [{ userId: 'u1', status: 'approved' }, { userId: 'u1', status: 'approved' }, { userId: 'u1', status: 'pending' }], casesData = [{ userId: 'u1' }];",
            "function rowBits(d) { " + slice + "\n return { _logsHtml, _copyText, _qN, _cN, logsN }; }",
            helpers
        ].join('\n') });
        const now = Date.now();
        const bits = await page.evaluate(now => rowBits({ id: 'u1', displayName: 'Bua', fullName: 'ณัชชา โคตรบุปผา', score: 13.75, beri: 257.4, lastSeen: { toMillis: () => now - 3 * 86400000 } }), now);
        assert.deepEqual([bits._qN, bits.logsN, bits._cN], [2, 1, 1], 'approved quizzes · non-archived journals · cases');
        assert.match(bits._logsHtml, /<span class="u-qjc"[^>]*><button type="button" class="ok" onclick="userRowQuick\('u1', 'history'\)"[^>]*>Q2<\/button><button type="button" class="ok" onclick="setReflectiveSearch\('Bua', 'u1'\)"[^>]*>J1<\/button><span class="ok"[^>]*>C1<\/span><\/span>/, 'Q·J·C chips, green: ' + bits._logsHtml);
        assert.match(bits._logsHtml, /<span class="u-seen" title="Last seen [^"]+"><i class="fa-regular fa-clock" aria-hidden="true"><\/i> 3d<\/span>$/, '3 days = plain 🕓');
        assert.equal(bits._copyText, 'ณัชชา โคตรบุปผา — Quiz 2 · Journal 1 · Case 1 · 13.75 pts · 🪙257', 'the panel\'s one-line Copy text');
        const fresh = await page.evaluate(now => rowBits({ id: 'u2', displayName: 'Joey', score: 0, lastSeen: { toMillis: () => now - 17 * 60000 } }), now);
        assert.match(fresh._logsHtml, /class="u-qjc"[^>]*><button type="button" class="" [^>]*>Q0<\/button><button type="button" class="" [^>]*>J0<\/button><span class=""[^>]*>C0<\/span>/, 'zeros grey');
        assert.match(fresh._logsHtml, /class="u-seen u-seen-fresh"[^>]*>.*? 17m<\/span>/, '< 1 day = fresh');
        assert.equal(fresh._copyText, 'Joey — Quiz 0 · Journal 0 · Case 0 · 0 pts · 🪙0', 'displayName when there is no full name');
        const stale = await page.evaluate(now => rowBits({ id: 'u3', displayName: 'Old', score: 1, lastSeen: { toMillis: () => now - 20 * 86400000 } }), now);
        assert.match(stale._logsHtml, /u-seen u-seen-stale/, '> 7 days = stale');
        assert.doesNotMatch((await page.evaluate(() => rowBits({ id: 'u4', displayName: 'Never', score: 0 })))._logsHtml, /u-seen/, 'no lastSeen → no 🕓');
        // ⧉ per row and ⧉ all read tr[data-copy]; 🕓↕ flips the flag and re-renders
        await page.evaluate(() => { document.querySelector('#usersTable tbody').innerHTML = '<tr data-copy="A — Quiz 1"><td><button id="c1" onclick="copyUserRow(this)">⧉</button></td></tr><tr data-copy="B — Quiz 2"><td></td></tr><tr><td>pre-reg, no copy text</td></tr>'; });
        await page.click('#c1');
        await page.waitForFunction(() => window.__clip.length === 1);
        assert.deepEqual(await page.evaluate(() => [__clip[0], __toasts[0]]), ['A — Quiz 1', 'Copied: A'], 'one row');
        await page.evaluate(() => copyAllUserRows());
        await page.waitForFunction(() => window.__clip.length === 2);
        assert.deepEqual(await page.evaluate(() => [__clip[1], __toasts[1]]), ['A — Quiz 1\nB — Quiz 2', 'Copied 2 rows'], 'all rows shown, one line each');
        await page.evaluate(() => toggleUserSeenSort());
        assert.deepEqual(await page.evaluate(() => [window._userSeenSort, document.getElementById('user-seen-sort').textContent, document.getElementById('user-seen-sort').getAttribute('aria-pressed'), renders]), [true, '🕓▾', 'true', 1], '🕓↕ → on + re-render');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Users summary panel folded into the rows — Q·J·C chips, 🕓 last seen (fresh/stale), ⧉ row + ⧉ all from tr[data-copy], 🕓↕ sort; the panel and its renderer are gone');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
