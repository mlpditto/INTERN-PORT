// V102.21 (intern V101.10): pre-quiz materials = one ribbon on the cover, coloured by file type; several files open a
// floating list (the card clips overflow). Real helpers sliced from index.html + real quiz-cover.js decorate + real CSS.
const fs = require('fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const html = fs.readFileSync('public/index.html', 'utf8').replace(/\r/g, '');
const helpers = html.slice(html.indexOf('        function materialKind(url) {'), html.indexOf('        // V95.12: render a quiz'));
if (!helpers.includes('function qzOpenMaterial')) throw new Error('helpers slice');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');

const cardHtml = (id, withStart) => `<div class="assignment-card" id="${id}"><div class="assign-header"><div class="assign-icon" style="width:42px;height:42px;border-radius:12px;background:#1565c0;color:#fff;display:flex;align-items:center;justify-content:center">Q</div><div class="assign-info"><h4>Wellness Pharmacy</h4><div class="quiz-mission-meta">10 items · 1 pts</div></div><button>🔗</button></div><div class="assign-body"></div><div class="assign-footer">${withStart ? '<button class="btn-quiz-cta" onclick="confirmRunQuiz(1)">Start</button>' : ''}</div></div>`;

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://intern.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body><main></main></body>', contentType: 'text/html' }));
        await page.route('https://intern.test/cover.png', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
        await page.goto('https://intern.test/');
        await page.addStyleTag({ content: styles + fs.readFileSync('public/quiz-cover.css', 'utf8') });
        await page.evaluate(() => {
            window.escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            window.materialDisplayName = (m, i) => m.name || 'Material ' + (i + 1);
            window.logged = 0; window.qzLogMaterialClick = () => logged++;
            window.liff = { isInClient: () => true, openWindow: o => { window.opened = o; } };
            window.confirmRunQuiz = () => {};
        });
        await page.addScriptTag({ path: 'public/quiz-cover.js' });
        await page.addScriptTag({ content: helpers });
        const build = (id, quiz, withStart = true) => page.evaluate(([id, quiz, markup]) => {
            document.querySelector('main').insertAdjacentHTML('beforeend', markup);
            const card = document.getElementById(id);
            QuizCover.decorate(card, quiz, false);
            const ribbon = quizMaterialActionsHtml(quiz);
            if (ribbon) attachQuizMaterialRibbon(card, ribbon);
        }, [id, quiz, cardHtml(id, withStart)]);

        // one PDF on a cover: red ribbon on the cover's top-left, PDF icon + ↓, name in the hover
        await build('one', { id: 'q1', coverUrl: 'https://intern.test/cover.png', materials: [{ url: 'https://example.com/files/slides.pdf', name: 'Slides' }] });
        const r1 = page.locator('#one .quiz-mat-ribbon');
        assert.equal(await r1.evaluate(a => a.tagName), 'A');
        assert.equal(await r1.evaluate(a => getComputedStyle(a).backgroundColor), 'rgb(220, 38, 38)', 'PDF = red');
        assert.equal(await r1.locator('.fa-file-pdf').count(), 1);
        assert.match(await r1.getAttribute('title'), /PDF\): Slides/);
        assert.equal(await page.locator('#one .quiz-mat-anchor > .quiz-cover-thumb').count(), 1, 'the ribbon anchors on the cover');
        const cov = await page.locator('#one .quiz-cover-thumb').boundingBox(), rb = await r1.boundingBox();
        assert.ok(rb.x < cov.x && rb.x + rb.width > cov.x && rb.y > cov.y && rb.y < cov.y + 30, 'ribbon sits over the top-left corner');
        assert.equal(await page.locator('#one .quiz-mission-meta .quiz-material-download').count(), 0, 'no Download in the meta row');
        await r1.click();
        assert.deepEqual(await page.evaluate(() => [opened.url, opened.external, logged]), ['https://example.com/files/slides.pdf', true, 1], 'LIFF external open + logged');

        // several files: first type's icon + count; the list floats (fixed) above the clipping card and closes outside
        await build('many', { id: 'q2', coverUrl: 'https://intern.test/cover.png', materials: [{ url: 'https://1drv.ms/b/x', name: 'Deck' }, { url: 'https://youtu.be/abc', name: 'Video' }, { url: 'https://example.org/a', name: 'Notes' }] });
        const r2 = page.locator('#many summary.quiz-mat-ribbon');
        assert.equal((await r2.innerText()).trim(), '3');
        assert.equal(await r2.evaluate(s => getComputedStyle(s).backgroundColor), 'rgb(3, 100, 184)', 'first file OneDrive = blue');
        await r2.click();
        await page.waitForSelector('body > .quiz-material-list'); // toggle fires as a task
        const list = page.locator('body > .quiz-material-list');
        assert.equal(await list.isVisible(), true, 'open list floats at body level (the card clips + transforms)');
        assert.equal(await list.evaluate(l => getComputedStyle(l).position), 'fixed');
        const lb = await list.boundingBox(), sb = await r2.boundingBox();
        assert.ok(lb.y >= sb.y + sb.height, 'list opens under the ribbon');
        assert.deepEqual(await list.locator('a i').evaluateAll(is => is.map(i => i.className.split(' ').pop())), ['fa-cloud', 'fa-youtube', 'fa-file-arrow-down']);
        await page.mouse.click(5, 790);
        await page.waitForSelector('#many details > .quiz-material-list', { state: 'attached' });
        assert.equal(await page.locator('#many details').evaluate(d => d.open), false, 'outside tap closes the list');
        assert.equal(await page.locator('#many details > .quiz-material-list').count(), 1, 'the list goes back into its ribbon');
        await r2.click();
        await page.waitForSelector('body > .quiz-material-list');
        await page.locator('body > .quiz-material-list a').nth(1).click();
        assert.equal(await page.evaluate(() => opened.url), 'https://youtu.be/abc', 'a pick opens that file');
        await page.waitForFunction(() => !document.querySelector('#many details').open);

        // no cover (plain icon, e.g. a locked card): a small tab under the icon
        await build('plain', { id: 'q3', materials: [{ url: 'https://docs.google.com/x', name: 'Doc' }] }, false);
        const pl = await page.locator('#plain .quiz-mat-box').evaluate(b => ({ bottom: getComputedStyle(b).bottom, top: getComputedStyle(b).top }));
        assert.equal(pl.bottom, '-12px');
        assert.equal(await page.locator('#plain .quiz-mat-ribbon').evaluate(a => getComputedStyle(a).backgroundColor), 'rgb(30, 142, 62)', 'Drive = green');

        // no materials / unsafe URL → nothing
        assert.equal(await page.evaluate(() => quizMaterialActionsHtml({ materials: [{ url: 'javascript:alert(1)' }] })), '');

        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 800 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at ' + width);
        }
        assert.deepEqual(errors, []);
        console.log('PASS: material ribbon — on the cover, colour/icon by file type, name in hover, LIFF external open, several files → floating list (closes outside), no-cover tab, URL safety, 320/390 px');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
