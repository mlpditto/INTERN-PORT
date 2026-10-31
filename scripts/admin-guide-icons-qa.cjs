// V102.546: Admin guide 🔣 Icons — the real admin-guide.js and the three real .md files. EN / TH / KO list the same icons in the same order,
// one search filters both views, List = the usual folds, Grid = tiles with a meaning line. marked is stubbed with just ### + tables (no network in QA).
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const read = f => fs.readFileSync('public/' + f, 'utf8').replace(/\r\n/g, '\n');
const js = read('admin-guide.js'), admin = read('admin.html');
const MD = { en: read('admin-guide.en.md'), th: read('admin-guide.md'), ko: read('admin-guide.ko.md') };
const section = md => md.slice(md.indexOf('## 8. 🔣'));
const rows = md => section(md).split('\n').filter(l => l.startsWith('| ') && !/^\|\s*(Icon|ไอคอน|아이콘)\s*\|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
const en = rows(MD.en), th = rows(MD.th), ko = rows(MD.ko);
assert.ok(en.length >= 80, 'covers the app: ' + en.length);
for (const [n, r] of [['TH', th], ['KO', ko]]) assert.deepEqual(r.map(x => x.slice(0, 2)), en.map(x => x.slice(0, 2)), n + ' lists the same icons and names as EN');
for (const r of [...en, ...th, ...ko]) assert.ok(r.length === 3 && r.every(Boolean), 'three filled cells: ' + r);
assert.equal(section(MD.en).split('\n').filter(l => l.startsWith('### ')).length, 10, 'ten areas');
for (const label of ['Topic Map', 'Gourmet World', 'A Shop for Killers', 'Decay', 'Straw Hat Mode', 'Sync intern view', 'My Path', 'Memories', 'Re-plan']) assert.ok(admin.includes(label), 'admin.html still has "' + label + '"');

const harness = `<!doctype html><meta charset="utf-8"><title>Nika Admin (V9.9)</title>
<style>body{margin:0;font-family:sans-serif}</style>
<script>
var cells = l => l.split('|').slice(1, -1).map(c => c.trim());
window.marked = { parse: t => { var out = '', tbl = null; t.split('\\n').forEach(l => {
    if (/^\\|/.test(l)) { if (/^\\|---/.test(l)) return; if (tbl === null) { tbl = ''; out += '<table><thead><tr>' + cells(l).map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>'; } else out += '<tr>' + cells(l).map(c => '<td>' + c + '</td>').join('') + '</tr>'; return; }
    if (tbl !== null) { out += '</tbody></table>'; tbl = null; }
    var m = /^### (.+)/.exec(l); out += m ? '<h3>' + m[1] + '</h3>' : l ? '<p>' + l + '</p>' : '';
}); return out; } };
window.DOMPurify = { sanitize: h => h };
</script><script src="/admin-guide.js" defer></script>`;

(async () => {
    const browser = await chromium.launch();
    try {
        for (const vw of [412, 1100]) {
            const page = await (await browser.newContext({ viewport: { width: vw, height: 700 } })).newPage();
            const errs = []; page.on('pageerror', e => errs.push(e.message));
            await page.route('https://qa.test/**', r => {
                const p = new URL(r.request().url()).pathname;
                if (p === '/h.html') return r.fulfill({ contentType: 'text/html', body: harness });
                if (p === '/admin-guide.js') return r.fulfill({ contentType: 'text/javascript', body: js });
                const l = { '/admin-guide.en.md': 'en', '/admin-guide.md': 'th', '/admin-guide.ko.md': 'ko' }[p];
                return l ? r.fulfill({ contentType: 'text/markdown', body: MD[l] }) : r.fulfill({ status: 404, body: '' });
            });
            await page.goto('https://qa.test/h.html');
            await page.evaluate(() => { localStorage.setItem('adminGuideSeen', '1'); openAdminGuide(); });
            await page.waitForSelector('#adminGuideOverlay .ag-chip');
            await page.locator('#adminGuideOverlay .ag-chip', { hasText: '🔣 Icons' }).click();
            const shown = () => page.evaluate(() => ({
                rows: [...document.querySelectorAll('#adminGuideOverlay .ag-fold:not([hidden]) tbody tr:not([hidden])')].length,
                tiles: [...document.querySelectorAll('#adminGuideOverlay .ag-itile:not([hidden])')].length,
                open: document.querySelectorAll('#adminGuideOverlay .ag-fold[open]').length
            }));
            // List is the default: the usual closed folds, every row there
            const s0 = await shown();
            assert.deepEqual(s0, { rows: en.length, tiles: en.length, open: 0 }, 'all icons, folds closed @' + vw);
            assert.equal(await page.locator('#adminGuideOverlay .ag-igrid').isVisible(), false, 'list first');
            assert.equal(await page.locator('#adminGuideOverlay .ag-iv[data-v="list"]').getAttribute('aria-pressed'), 'true');
            // Search narrows to the rows that match and opens their fold
            await page.fill('#adminGuideOverlay .ag-isearch', 'learning note');
            const s1 = await shown();
            assert.ok(s1.rows >= 1 && s1.rows < 5 && s1.open >= 1, 'search filters and opens: ' + JSON.stringify(s1));
            assert.equal(s1.tiles, s1.rows, 'the grid follows the same search');
            await page.fill('#adminGuideOverlay .ag-isearch', 'zzzz');
            assert.equal(await page.locator('#adminGuideOverlay .ag-inone').isVisible(), true, 'says so when nothing matches');
            await page.fill('#adminGuideOverlay .ag-isearch', '');
            assert.deepEqual(await shown(), s0, 'clearing brings everything back, folds closed');
            // Grid: tiles with the name, a tap shows the meaning, the search still works
            await page.click('#adminGuideOverlay .ag-iv[data-v="grid"]');
            assert.equal(await page.locator('#adminGuideOverlay .ag-igrid').isVisible(), true);
            assert.equal(await page.locator('#adminGuideOverlay .ag-folds').isVisible(), false, 'one view at a time');
            await page.locator('#adminGuideOverlay .ag-itile', { hasText: 'Straw Hat Mode' }).click();
            assert.match(await page.textContent('#adminGuideOverlay .ag-ibub'), /Straw Hat Mode — Hide or show all identities/);
            const fit = await page.evaluate(() => { const b = document.querySelector('#adminGuideOverlay .ag-body'); return b.scrollWidth <= b.clientWidth + 1; });
            assert.ok(fit, 'no sideways scroll @' + vw);
            await page.fill('#adminGuideOverlay .ag-isearch', 'beri');
            assert.ok((await shown()).tiles >= 3, 'search in grid');
            // Another language: its own words and search text, and the tools only on this section
            await page.click('#adminGuideOverlay .ag-l[data-l="th"]');
            await page.waitForFunction(() => /ค้นหา/.test(document.querySelector('#adminGuideOverlay .ag-isearch')?.placeholder || ''));
            assert.equal(await page.locator('#adminGuideOverlay .ag-iv[data-v="grid"]').textContent(), 'กริด');
            await page.locator('#adminGuideOverlay .ag-chip').first().click();
            assert.equal(await page.locator('#adminGuideOverlay .ag-ibar').count(), 0, 'no search bar on the other sections');
            assert.deepEqual(errs, [], 'no page errors');
            await page.context().close();
        }
        console.log('PASS: admin guide 🔣 Icons — ' + en.length + ' icons in EN / TH / KO, same order, one search, list + grid, tap for the meaning, 412 + 1100 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
