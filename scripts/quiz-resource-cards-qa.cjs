// V102.03: Materials as one lean row per resource — icon · inline title · domain chip opening the link in
// one click · ✎ edit link · 💬 note · 🗑. Real module + real CSS (incl. admin.html's global <style> rules).
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
const markup = html.slice(html.indexOf('<header><div><strong>📚 Materials'), html.indexOf('<div id="quiz-resource-grid" class="lang-no-toggle"></div>') + '<div id="quiz-resource-grid" class="lang-no-toggle"></div>'.length);

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://res.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' }));
        await page.goto('https://res.test/');
        await page.addStyleTag({ content: [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n') });
        await page.addStyleTag({ content: fs.readFileSync('public/quiz-resource-cards.css', 'utf8') });
        await page.evaluate(m => { document.body.innerHTML = '<section class="quiz-resources" style="max-width:720px">' + m + '</section>'; }, markup);
        await page.addScriptTag({ path: 'public/quiz-resource-cards.js' });

        const rows = page.locator('#quiz-resource-grid article');
        await page.evaluate(() => quizResourceCards.load([
            { name: 'Lecture slides', url: 'https://1drv.ms/b/c/d21aebbcc21c93a3/IQB7uFfrCX5TSY1dujgUev' },
            { name: 'Counselling demo', url: 'https://youtu.be/abc123', desc: 'line one\nline two', extra: 'kept' },
            { name: 'Guideline', url: 'https://example.org/files/guide.pdf' }
        ]));
        assert.equal(await rows.count(), 3);
        assert.equal(await page.locator('#quiz-resource-count').innerText(), '3');

        // chip = one-click open: real <a>, new tab, no opener/referrer, full URL, host text, site colour + icon
        const go = rows.nth(0).locator('.res-go');
        assert.equal(await go.isVisible(), true);
        assert.equal(await rows.nth(0).locator('.res-url').isVisible(), false, 'valid link → URL field folded into the chip');
        assert.deepEqual(await go.evaluate(a => [a.tagName, a.target, a.rel, a.href, a.textContent.trim()]), ['A', '_blank', 'noopener noreferrer', 'https://1drv.ms/b/c/d21aebbcc21c93a3/IQB7uFfrCX5TSY1dujgUev', '1drv.ms']);
        assert.equal(await rows.nth(0).locator('.res-dot').evaluate(d => getComputedStyle(d).backgroundColor), 'rgb(3, 100, 184)', 'OneDrive blue');
        assert.equal(await rows.nth(1).locator('.res-dot i').getAttribute('class'), 'fa-brands fa-youtube');
        assert.equal(await rows.nth(2).locator('.res-dot i').getAttribute('class'), 'fa-solid fa-file-pdf');
        assert.equal(await rows.nth(0).locator('label').count(), 0, 'no field labels');

        // note: hidden when empty, shown (multi-line kept) when present; 💬 lit only with text
        assert.equal(await rows.nth(0).locator('.res-note').isVisible(), false);
        assert.equal(await rows.nth(1).locator('.res-note').isVisible(), true);
        assert.equal(await rows.nth(1).locator('textarea').inputValue(), 'line one\nline two');
        assert.equal(await rows.nth(1).locator('.res-note-btn.on').count(), 1);
        await rows.nth(0).locator('.res-note-btn').click();
        assert.equal(await rows.nth(0).locator('.res-note').isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'desc');
        await rows.nth(0).locator('.res-title').click();
        assert.equal(await rows.nth(0).locator('.res-note').isVisible(), false, 'empty note folds away on blur');

        // read() keeps the schema: {name,url,desc?} + untouched extra keys; multi-line desc intact; empty desc dropped
        assert.deepEqual(await page.evaluate(() => quizResourceCards.read()), [
            { name: 'Lecture slides', url: 'https://1drv.ms/b/c/d21aebbcc21c93a3/IQB7uFfrCX5TSY1dujgUev' },
            { name: 'Counselling demo', url: 'https://youtu.be/abc123', desc: 'line one\nline two', extra: 'kept' },
            { name: 'Guideline', url: 'https://example.org/files/guide.pdf' }
        ]);

        // a new card starts as "paste a link" (focused); a valid link + Enter turns into the chip
        await page.evaluate(() => quizResourceCards.add());
        const fresh = rows.nth(3);
        assert.equal(await fresh.locator('.res-url').isVisible(), true);
        assert.equal(await fresh.locator('.res-go').isVisible(), false);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.field), 'url');
        assert.equal(await fresh.locator('.res-url').getAttribute('placeholder'), 'paste a link');
        await fresh.locator('.res-url').fill('https://docs.google.com/presentation/d/xyz');
        await fresh.locator('.res-url').press('Enter');
        assert.equal(await fresh.locator('.res-go').isVisible(), true);
        assert.equal(await fresh.locator('.res-go span').innerText(), 'docs.google.com');
        assert.equal(await fresh.locator('.res-dot i').getAttribute('class'), 'fa-brands fa-google-drive');

        // ✎ reopens the field; an invalid link stays a field; read() reports it on the visible field
        await fresh.locator('.res-edit').click();
        assert.equal(await fresh.locator('.res-url').isVisible(), true);
        await fresh.locator('.res-url').fill('not a link');
        await fresh.locator('.res-url').press('Enter');
        assert.equal(await fresh.locator('.res-go').isVisible(), false, 'invalid stays editable');
        assert.match(await page.evaluate(() => { try { quizResourceCards.read(); return 'no error'; } catch (e) { return e.message; } }), /check the URL in Materials/);
        assert.equal(await fresh.locator('.res-url').isVisible(), true);
        await fresh.locator('.res-del').click();
        assert.equal(await rows.count(), 3);

        // layout: one line per row on desktop; nothing spills out of a row at 1000 / 390 px
        for (const width of [1000, 390]) {
            await page.setViewportSize({ width, height: 800 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no page overflow at ' + width);
            const spill = await page.evaluate(() => [...document.querySelectorAll('#quiz-resource-grid article')].flatMap(row => {
                const r = row.getBoundingClientRect();
                return [...row.querySelectorAll('.res-line > *:not([hidden])')].filter(el => { const b = el.getBoundingClientRect(); return b.right > r.right + 1 || b.left < r.left - 1; }).map(el => el.className);
            }));
            assert.deepEqual(spill, [], 'row children inside the row at ' + width);
            if (width === 1000) assert(await rows.nth(0).locator('.res-line').evaluate(l => l.getBoundingClientRect().height) <= 52, 'single line on desktop');
        }

        // V102.09: save state next to the count — ✓ dim → 💾 (bounce + amber dot) on change → ✓ green after Save Quiz.
        const st = page.locator('#quiz-resource-state');
        const stateOf = () => st.evaluate(e => [e.dataset.state, e.textContent, e.title]);
        await page.evaluate(() => quizResourceCards.load([{ name: 'A', url: 'https://youtu.be/a' }, { name: 'B', url: 'https://youtu.be/b' }]));
        assert.deepEqual(await stateOf(), ['clean', '✓', 'บันทึกพร้อมกับ Quiz']);
        assert.equal(await page.getByText('Changes are saved with the quiz.').count(), 0, 'footer line removed');
        const title = rows.nth(0).locator('.res-title');
        await title.fill('A2');
        assert.deepEqual(await stateOf(), ['dirty', '💾', 'ยังไม่บันทึก — กด Save Quiz']);
        assert.match(await st.evaluate(e => getComputedStyle(e).animationName), /quiz-res-bounce/);
        assert.equal(await st.evaluate(e => getComputedStyle(e, '::after').backgroundColor), 'rgb(245, 158, 11)', 'amber dot');
        await title.fill('A');
        assert.equal((await stateOf())[0], 'clean', 'undoing the edit goes back to ✓');
        await page.evaluate(() => quizResourceCards.add({ name: 'C', url: 'https://youtu.be/c' }));
        assert.equal((await stateOf())[0], 'dirty', 'adding a link');
        await page.evaluate(() => quizResourceCards.saved());
        assert.deepEqual(await stateOf(), ['saved', '✓', 'บันทึกแล้ว']);
        assert.equal(await st.evaluate(e => getComputedStyle(e).color), 'rgb(74, 222, 128)', 'green after save');
        await rows.nth(2).locator('.res-del').click();
        assert.equal((await stateOf())[0], 'dirty', 'deleting after a save');
        await page.evaluate(() => quizResourceCards.load([{ name: 'X', url: 'https://youtu.be/x' }, { name: 'Y', url: 'https://youtu.be/y' }, { name: 'Z', url: 'https://youtu.be/z' }]));
        assert.equal((await stateOf())[0], 'clean', 'opening a quiz resets');
        await page.emulateMedia({ reducedMotion: 'reduce' }); await title.fill('X2');
        assert.equal(await st.evaluate(e => getComputedStyle(e).animationName), 'none', 'reduced motion: no bounce');
        await page.emulateMedia({ reducedMotion: 'no-preference' });

        // delete down to empty → the empty hint returns
        for (let i = 0; i < 3; i++) await rows.first().locator('.res-del').click();
        assert.equal(await page.locator('.resource-empty').isVisible(), true);
        assert.equal(await page.locator('#quiz-resource-count').innerText(), '0');
        assert.deepEqual(errors, []);
        console.log('PASS: resource rows — chip opens in one click (a, _blank, noopener), site colour/icon, no labels, note fold/keep multi-line, schema round-trip, paste-a-link → chip, ✎ edit, invalid shown on read, delete/empty, 1000/390 px layout, save state ✓/💾/✓ green');
    } finally { await browser.close(); }
})();
