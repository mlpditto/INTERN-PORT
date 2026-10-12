// V102.188 — Elite Board lean pass (the 5 proposals): empty chips vanish, flood = nothing when OK / words when not, a typo'd period says
// a period over a year = 🧪 Beta tester (V102.189; was "Check dates" + Fix), last-seen is one unit, and pending requests with the same dates sit under ONE header with no empty "-" columns.
// Real functions from public/admin.html in a vm; the pending table is rendered by the real renderTable('users') in Chromium.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('public/admin.html', 'utf8');

function grab(marker) {
    const start = html.indexOf(marker);
    assert.ok(start >= 0, 'marker not found: ' + marker);
    let i = html.indexOf('(', start), depth = 0;
    for (; i < html.length; i++) { if (html[i] === '(') depth++; else if (html[i] === ')') { depth--; if (!depth) break; } }
    const open = html.indexOf('{', i);
    let b = 0, k = open;
    for (; k < html.length; k++) { if (html[k] === '{') b++; else if (html[k] === '}') { b--; if (!b) break; } }
    return html.slice(start, k + 1);
}

// ---- 4. last seen: one unit ----
{
    const ctx = vm.createContext({});
    vm.runInContext(grab('function userSeenAgo(ts)'), ctx);
    const ago = ms => ({ toMillis: () => Date.now() - ms });
    assert.equal(ctx.userSeenAgo(ago(20 * 1000)), 'now');
    assert.equal(ctx.userSeenAgo(ago(5 * 60000)), '5m');
    assert.equal(ctx.userSeenAgo(ago(12 * 3600000)), '12h');
    assert.equal(ctx.userSeenAgo(ago(26 * 3600000)), '1d');
    assert.equal(ctx.userSeenAgo(ago(189 * 86400000)), '189d', 'stale = a day count, not a Thai date');
    assert.equal(ctx.userSeenAgo(null), '');
    assert.ok(html.includes('${escapeHtml(userSeenAgo(d.lastSeen))}'), 'the Users row uses it');
}

// ---- 2. flood mark ----
{
    let cls = 'low';
    const ctx = vm.createContext({ escapeHtml: s => String(s), userFloodInfo: () => ({ cls, tip: 'Flood tip' }) });
    vm.runInContext(grab('function userFloodMarkHtml(d)'), ctx);
    assert.equal(ctx.userFloodMarkHtml({}), '', 'low (OK) → nothing beside the name');
    cls = 'high';
    assert.match(ctx.userFloodMarkHtml({}), /Flood: high/, 'high says so in words');
    cls = 'moderate';
    assert.match(ctx.userFloodMarkHtml({}), /Flood: moderate/);
    cls = 'wait';
    assert.match(ctx.userFloodMarkHtml({}), /🌊<\/span>/, 'still-waiting / no-home keep the small neutral dot');
    ctx.userFloodInfo = () => null;
    assert.equal(ctx.userFloodMarkHtml({}), '', 'not opted in → nothing');
}

// ---- 1. toolbar chips ----
{
    const dom = { 'user-group-tabs': { innerHTML: '' } };
    const users = [
        { id: 'a', group: 'EXTERN', division: 'RSU' },
        { id: 'b', group: 'Pharmacists', division: 'CU' },
        { id: 'c', group: 'Solo', division: '' },
        { id: 'd', group: 'Gone', division: '', isIgnored: true }
    ];
    const ctx = vm.createContext({
        document: { getElementById: i => dom[i] || null }, window: {},
        preRegData: [], usersData: users, divisionConfig: { RSU: ['EXTERN'], CU: ['Pharmacists'], EMPTY: [] },
        activeUserGroup: 'All', activeUserGroupDiv: undefined,
        userDivisionOf: u => u.division || '', escapeHtml: s => String(s),
        groupChipHtml: (g, o) => `[${g}:${o.active}]`, divChipLook: () => ({}), divColor: () => '#000',
        renderUserSubgroupRow() {}, paintUserFloodBtn() {}, floodStatusData: {}
    });
    vm.runInContext(grab('function renderUserGroupTabs()'), ctx);
    ctx.renderUserGroupTabs();
    let out = dom['user-group-tabs'].innerHTML;
    assert.ok(out.includes('[All:3]') && out.includes('[RSU:1]') && out.includes('[CU:1]') && out.includes('[Solo:1]'), 'chips with people stay: ' + out);
    assert.ok(!out.includes('EMPTY'), 'a division with nobody active has no chip');
    assert.ok(!out.includes('Gone'), 'a group whose only member is hidden has no chip');
    ctx.activeUserGroup = 'EMPTY';
    ctx.renderUserGroupTabs();
    assert.ok(dom['user-group-tabs'].innerHTML.includes('[EMPTY:0]'), 'the selected chip stays even when it is empty');
}

// ---- 3. + 5. static contract of the row/section markup ----
assert.ok(html.includes('<span class="u-tl-beta">🧪 Beta tester</span>') && !html.includes('Check dates <small') && !html.includes('u-tl-fix'), 'a period over a year says 🧪 Beta tester (no warning, no Fix)');
assert.ok(html.includes('secPend.sort((a, b) =>') && html.includes('class="u-pend-dates"'), 'pending sorted by dates, one date header per range');
assert.ok(html.includes("'No dates yet'"), 'pending without dates get their own header');
const pendBlock = html.slice(html.indexOf('if (d.isPreReg) {', html.indexOf('tbody.innerHTML = "";')), html.indexOf('return;', html.indexOf('if (d.isPreReg) {', html.indexOf('tbody.innerHTML = "";'))));
assert.ok(pendBlock.includes('<td colspan="4">'), 'the pending name cell spans the empty columns');
assert.ok(!/<td>-<\/td>/.test(pendBlock) && !pendBlock.includes('${dateStr}'), 'no "-" cells and no repeated date range per pending row');

// ---- 5. functional: real renderTable('users') with three pending people on one range + one on another ----
(async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/public/admin.html');
        const res = await page.evaluate(() => {
            const mk = (id, name, s, e) => ({ id, fullName: name, group: 'Public', startDate: s, endDate: e, code: 'C' + id, claimed: false });
            usersData = [];
            preRegData = [mk('p1', 'Pending One', '2026-10-19', '2026-11-27'), mk('p2', 'Pending Two', '2026-10-19', '2026-11-27'), mk('p3', 'Pending Three', '2026-12-01', '2027-01-10'), mk('p4', 'No Dates', '', '')];
            try { renderTable('users'); } catch (e) { return { err: String(e && e.message || e) }; }
            const tb = document.querySelector('#usersTable tbody');
            const rows = [...tb.querySelectorAll('tr')];
            return { heads: rows.filter(r => r.classList.contains('u-sec-row')).map(r => r.textContent.replace(/\s+/g, ' ').trim()), cells: rows.filter(r => !r.classList.contains('u-sec-row')).map(r => r.children.length), spans: rows.filter(r => !r.classList.contains('u-sec-row')).map(r => (r.querySelector('td[colspan]') || {}).colSpan) };
        });
        assert.ok(!res.err, 'renderTable threw: ' + res.err);
        assert.ok(res.heads.some(h => /Pending requests/.test(h)), 'Pending requests header: ' + JSON.stringify(res.heads));
        assert.ok(res.heads.some(h => /Starts 19 Oct → 27 Nov\s*· 2 people/.test(h)), 'one header for the shared range: ' + JSON.stringify(res.heads));
        assert.ok(res.heads.some(h => /Starts 1 Dec/.test(h) && /1 person/.test(h)), 'another range, another header');
        assert.ok(res.heads.some(h => /No dates yet/.test(h)), 'no dates → its own header');
        assert.deepEqual(res.cells, [3, 3, 3, 3], 'each pending row: rank + name (spans 4) + actions');
        console.log('PASS: Elite Board lean — empty chips vanish, flood OK hidden / high in words, Beta tester period, last-seen 5m/3h/2d, pending grouped by dates with no empty columns');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
