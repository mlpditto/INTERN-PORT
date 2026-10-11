// V102.155: the per-user Quiz / Journal / Case / Points / Beri summary ("Users (29)" + Copy per row) moved from the Dashboard into User Hub.
// Static: the panel is a <details> inside #tab-users right under Badge Stats, gone from the Dashboard; it follows the User Hub group chips
// (setUserGroupFilter), not the Dashboard board tabs. Behaviour: the REAL renderGroupUsersPanel drawn into the REAL panel markup —
// the count in the summary is kept while folded, rows only while open, division chips resolve through divisionConfig, Copy writes the row.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');

assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.equal((html.match(/id="group-users-panel"/g) || []).length, 1, 'one panel');
const panelAt = html.indexOf('<details id="group-users-panel"');
const usersTab = html.indexOf('<div id="tab-users"');
assert.ok(panelAt > usersTab && panelAt > html.indexOf('<details id="badge-stats-panel"') && panelAt < html.indexOf('<table id="usersTable"'), 'the panel sits in User Hub, under Badge Stats, above the table');
const dash = html.slice(html.indexOf('<div id="dashboard-work">'), html.indexOf('<div class="kanban-board"'));
assert.ok(!dash.includes('group-users') && !dash.includes('renderGroupUsersPanel'), 'gone from the Dashboard');
function grab(src, marker) {
    const i = src.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = src.indexOf('{', i);
    for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
    return src.slice(i, k + 1);
}
assert.ok(!grab(html, 'function setBoardGroupFilter(').includes('renderGroupUsersPanel'), 'the Dashboard board tabs no longer drive it');
assert.ok(grab(html, 'function setUserGroupFilter(').includes('renderGroupUsersPanel()'), 'the User Hub chips do');
const render = grab(html, 'function renderGroupUsersPanel(');
assert.ok(render.includes('const group = activeUserGroup;') && !render.includes('activeBoardGroup'), 'reads the User Hub group');
const panel = html.slice(panelAt, html.indexOf('</details>', panelAt) + '</details>'.length);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent('<!doctype html><meta charset="utf-8"><style>:root{--primary:#4361ee}</style><div id="tab-users">' + panel + '</div>');
        await page.addScriptTag({ content: [
            'var activeUserGroup = "All", activeUserGroupDiv, __toasts = [], __clip = [];',
            'var escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" }[c]));',
            'var alabastaAgo = () => "2 d"; var showToast = m => __toasts.push(m);',
            'var groupColorMap = { RSU: "#e11d48" }; var divisionConfig = { Clinical: ["RSU", "CU"] };',
            'var usersData = [',
            '  { id: "u1", displayName: "Bua", fullName: "ณัชชา", group: "RSU", score: 13.95, beri: 257, lastSeen: { toMillis: () => 5 } },',
            '  { id: "u2", displayName: "Joey", group: "CU69", score: 12.79, beri: 52, lastSeen: { toMillis: () => 9 } },',
            '  { id: "u3", displayName: "Ghost", group: "RSU", score: 1, beri: 0, isIgnored: true },',
            '  { id: "u4", displayName: "Pre", group: "CU", score: 0, beri: 0, isPreReg: true } ];',
            'var quizAttemptsAllCache = [{ userId: "u1", status: "approved" }, { userId: "u1", status: "approved" }, { userId: "u1", status: "pending" }, { userId: "u2", status: "approved" }];',
            'var reflectiveLogsCache = [{ userId: "u1" }]; var casesData = [{ userId: "u1" }, { userId: "u1" }];',
            'Object.defineProperty(navigator, "clipboard", { value: { writeText: t => { __clip.push(t); return Promise.resolve(); } } });',
            grab(html, 'function userDivisionOf('), grab(html, 'function userInScope('), render
        ].join('\n') });
        const title = () => page.$eval('#group-users-title', e => e.textContent);
        const rows = () => page.$$eval('#group-users-list > div', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));

        await page.evaluate(() => renderGroupUsersPanel());
        assert.equal(await page.$eval('#group-users-panel', e => e.open), false, 'folded by default');
        assert.equal(await title(), 'Users (4)', 'the count is kept while folded (All = everyone, as on the Dashboard)');
        assert.deepEqual(await rows(), [], 'no rows while folded');

        await page.click('#group-users-panel summary');
        await page.waitForFunction(() => document.querySelectorAll('#group-users-list > div').length > 0);
        let r = await rows();
        assert.equal(r.length, 4);
        assert.ok(/^J.*Joey Quiz 1 Journal 0 Case 0 12\.79 pts/.test(r[0]), 'latest seen first, approved quizzes only: ' + r[0]);
        assert.ok(/Bua|ณัชชา/.test(r[1]) && /Quiz 2 Journal 1 Case 2 13\.95 pts/.test(r[1]) && /257/.test(r[1]), r[1]);

        await page.evaluate(() => { activeUserGroup = 'RSU'; renderGroupUsersPanel(); });
        assert.equal(await title(), 'Users · RSU (1)', 'a group chip: ignored members are left out');
        assert.ok(/Quiz 2/.test((await rows())[0]));
        await page.evaluate(() => { activeUserGroup = 'Clinical'; renderGroupUsersPanel(); });
        assert.equal(await title(), 'Users · Clinical (1)', 'a division chip resolves through divisionConfig (RSU + CU; the pre-reg CU user is left out)');
        await page.evaluate(() => { activeUserGroup = 'Nowhere'; renderGroupUsersPanel(); });
        assert.ok((await page.$eval('#group-users-list', e => e.innerText)).includes('No users in this group'));

        await page.evaluate(() => { activeUserGroup = 'All'; renderGroupUsersPanel(); });
        await page.click('#group-users-list > div:nth-child(2) button');
        await page.waitForFunction(() => window.__clip.length === 1);
        assert.equal(await page.evaluate(() => __clip[0]), 'ณัชชา — Quiz 2 · Journal 1 · Case 2 · 13.95 pts · 🪙257', 'Copy = one plain-text line');
        assert.ok((await page.evaluate(() => __toasts)).some(t => /Copied/.test(t)));

        await page.click('#group-users-panel summary');   // fold again
        await page.evaluate(() => { usersData.push({ id: 'u5', displayName: 'New', group: 'CU', score: 0, beri: 0 }); renderGroupUsersPanel(); });
        assert.equal(await title(), 'Users (5)', 'a snapshot re-render updates the count while folded');
        assert.deepEqual(await rows(), [], 'and leaves the folded body empty');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Users summary panel lives in User Hub (under Badge Stats, follows the group / division chips), gone from the Dashboard; count while folded, rows + Copy while open');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
