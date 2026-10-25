// V102.420: the ⋯ menu of a Case row opens INSIDE the viewport even when the table's overflow-x:auto wrapper would clip it
// (the last rows: "⋯ does nothing"). The REAL .alabasta-more-menu CSS + listener from public/admin.html, on the real wrapper + table shape.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
const cut = (a, b) => { const i = html.indexOf(a); assert.ok(i > 0, a); return html.slice(i, html.indexOf(b, i)); };
const css = cut('        .alabasta-more-menu {', '        /* V93.25 PR #13 Phase 2A');
const js = cut('        function closeAlabastaMoreMenus() {', '        // V93.25 PR #13 Phase 2A — coordinate');
assert.ok(/body\.style\.position = 'fixed'/.test(js), 'the menu is pinned to the viewport');
const row = n => `<tr><td>Row ${n}</td><td><div class="alabasta-action-row"><button>✅</button><details class="alabasta-more-menu"><summary class="btn-sm alabasta-action-btn is-more"><span>⋯</span></summary><div class="alabasta-more-menu-body" role="menu"><button class="alabasta-more-menu-item">✏️ Edit case</button><button class="alabasta-more-menu-item">🐳 Ask Laboon</button><button class="alabasta-more-menu-item">🪨 Poneglyph</button><button class="alabasta-more-menu-item">📝 Generate Quiz from Case</button><button class="alabasta-more-menu-item">🗑️ Delete case</button></div></details></div></td></tr>`;
(async () => {
    const browser = await chromium.launch();
    try {
        for (const [vw, vh] of [[1300, 700], [390, 700]]) {
            const page = await browser.newPage({ viewport: { width: vw, height: vh } });
            await page.setContent(`<style>body{margin:0;padding:12px;font:14px system-ui}${css}.alabasta-action-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.alabasta-action-btn{padding:6px 10px;border:0;border-radius:8px;color:#fff;background:#64748b}</style>
<div style="overflow-x:auto;"><table id="t" style="width:100%"><tbody>${[1, 2, 3].map(row).join('')}</tbody></table></div>`);
            await page.addScriptTag({ content: js });
            // the table ends right under the last ⋯ (like the screenshot): the menu has no room inside the wrapper
            for (const n of [0, 2]) {
                const d = page.locator('details.alabasta-more-menu').nth(n);
                await d.locator('summary').click();
                const body = d.locator('.alabasta-more-menu-body');
                await d.evaluate(el => new Promise(r => { const t = setInterval(() => { if (el.querySelector('.alabasta-more-menu-body').style.position === 'fixed') { clearInterval(t); r(); } }, 10); }));   // the toggle event is a queued task
                const box = await body.boundingBox();
                assert.ok(box && box.y >= 0 && box.y + box.height <= vh && box.x >= 0 && box.x + box.width <= vw, `menu ${n} inside the viewport @${vw}: ` + JSON.stringify(box));
                // it is really REACHABLE: the point at the middle of the last item hits the menu, not the clipped table wrapper
                const hit = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return !!(el && el.closest('.alabasta-more-menu-body')); }, { x: box.x + box.width / 2, y: box.y + box.height - 12 });
                assert.equal(hit, true, `the last item of menu ${n} can be clicked @${vw}`);
                const top = await d.locator('summary').boundingBox();
                assert.ok(Math.abs((box.x + box.width) - (top.x + top.width)) < 16 || vw < 500, 'right edge under its button');
                await page.mouse.click(5, vh - 5);   // outside → closes
                assert.equal(await d.evaluate(el => el.open), false, 'closes on an outside click');
            }
            // one at a time + a scroll closes it (a pinned menu must not float away)
            await page.locator('details.alabasta-more-menu').nth(0).locator('summary').click();
            await page.locator('details.alabasta-more-menu').nth(1).evaluate(el => el.querySelector('summary').click());   // (the open menu covers that button for a real pointer)
            await page.waitForFunction(() => document.querySelectorAll('details.alabasta-more-menu[open]').length === 1);
            assert.equal(await page.locator('details.alabasta-more-menu[open]').count(), 1, 'one open at a time');
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
            assert.equal(await page.locator('details.alabasta-more-menu[open]').count(), 0, 'a resize closes it');
            await page.close();
        }
        // no room below (a short window, the button near its bottom edge) → the menu opens ABOVE the button
        {
            const page = await browser.newPage({ viewport: { width: 1300, height: 300 } });
            await page.setContent(`<style>body{margin:0;padding:12px;font:14px system-ui}${css}.alabasta-action-row{display:flex;gap:6px}.alabasta-action-btn{padding:6px 10px;border:0;border-radius:8px;color:#fff;background:#64748b}</style><div style="height:230px"></div><div style="overflow-x:auto"><table><tbody>${row(1)}</tbody></table></div>`);
            await page.addScriptTag({ content: js });
            const d = page.locator('details.alabasta-more-menu');
            await d.locator('summary').click();
            await d.evaluate(el => new Promise(r => { const t = setInterval(() => { if (el.querySelector('.alabasta-more-menu-body').style.position === 'fixed') { clearInterval(t); r(); } }, 10); }));
            const bx = await d.locator('.alabasta-more-menu-body').boundingBox(), sm = await d.locator('summary').boundingBox();
            assert.ok(bx.y >= 0 && bx.y + bx.height <= sm.y + 1, 'flipped above the button: ' + JSON.stringify([bx, sm]));
            await page.close();
        }
        console.log('PASS: Case ⋯ menu — pinned to the viewport (reachable even on the last row), flips up when there is no room below, one at a time, outside click / resize closes.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
