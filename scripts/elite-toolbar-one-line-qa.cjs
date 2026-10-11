// V102.179: Elite Board (User Hub) — the toolbar and the division/group rail are ONE line: the rail (+ the Know Yourself filter) sits where the spacer was and the
// toolbar's flex-wrap drops it under the icons only when there is no room. The Divisions button is a gear (the shield chips in the rail are the filters).
// Real page markup + CSS (scripts stripped), real chips.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

const tab = html.slice(html.indexOf('<div id="tab-users" class="tab-content">'), html.indexOf('<div id="user-subgroup-row"'));
const toolbarEnd = tab.indexOf('<div id="decay-box"');
const toolbar = tab.slice(0, toolbarEnd);
assert.ok(toolbar.includes('id="user-group-tabs"') && toolbar.includes('id="user-pers-filter"'), 'the rail and the Know Yourself filter are inside the toolbar');
assert.ok(toolbar.includes('<div class="u-railslot"') && !toolbar.includes('<span style="flex:1"></span>'), 'they took the spacer\'s place');
assert.ok(!tab.slice(toolbarEnd).includes('id="user-group-tabs"'), 'and there is no second row any more');
assert.ok(/onclick="openDivisionsModal\(\)" title="Manage Divisions &amp; Groups"[^>]*>⚙️<\/button>/.test(toolbar), 'the Divisions button is a gear');

function grabFn(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', html.indexOf(')', i));
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
function grabConst(marker) {
    const i = html.indexOf(marker); let d = 0, k = html.indexOf('{', i);
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 2);
}

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
        const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.route(/^(?!data:|about:).*/, r => r.abort());
        await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ content: [
            'var escapeHtml = function (s) { return String(s); }, usersData = [];',
            grabConst('const groupColorMap = {'), grabConst('const groupIconMap = {'),
            ['function getGroupColor(', 'function getGroupIcon(', 'function groupActiveCount(', 'function groupTotalCount(', 'function groupChipHtml('].map(grabFn).join('\n'),
            // the real rail is icon-only chips: All · 2 divisions · a group, plus the Know Yourself chip
            'document.getElementById("user-group-tabs").innerHTML = ["All", "CAFE", "RSU", "Pharmacists"].map(function (g, i) { return groupChipHtml(g, { active: 6 - i, total: 6 - i, on: i === 0 }); }).join("");',
            'var pf = document.getElementById("user-pers-filter"); pf.style.display = "flex"; pf.innerHTML = \'<button type="button" class="grp-chip"><i class="fa-solid fa-compass"></i></button>\';'
        ].join('\n') });
        await page.evaluate(() => { const t = document.getElementById('tab-users'); t.style.display = 'block'; t.className = ''; document.getElementById('dashboard-container').style.display = 'block'; });
        const mid = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
        const oneLine = async w => {
            await page.setViewportSize({ width: w, height: 600 });
            const ys = await Promise.all(['#userSearch', '#user-group-tabs .grp-chip', '#bstat-chip'].map(mid));
            return { ys, same: Math.max(...ys) - Math.min(...ys) <= 6 };
        };
        let r = await oneLine(1280); assert.ok(r.same, 'one line at 1280px: ' + r.ys);
        r = await oneLine(1000); assert.ok(r.same, 'one line at 1000px: ' + r.ys);
        r = await oneLine(420);
        assert.ok(!r.same, 'a narrow screen wraps (the rail goes under the icons instead of being crushed): ' + r.ys);
        assert.ok(await page.$eval('#user-group-tabs', e => e.getBoundingClientRect().width) > 100, 'and the rail keeps a usable width');
        assert.deepEqual(errs, [], 'no page errors');
        console.log('PASS: Elite Board — toolbar + division/group rail on one line (≥1000px), wraps on a narrow screen; Divisions button is a gear');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
