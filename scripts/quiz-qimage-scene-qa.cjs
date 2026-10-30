// V102.523 — ✨ Scene in the Quiz Editor 🖼 panel (public/quiz-qimage.js): a picture of the stem's situation shown WITH the question, never the answer.
// The REAL admin.html offline (file://, network blocked, Firebase = Proxy, the module script's @google/generative-ai import stubbed, Storage stubbed).
// ✨ AI picture: nothing runs on open; Generate drafts the brief with the Read first row's model (stem + UNMARKED options — no answer key), draws with the
// picked image model (Image API models get 4:3), then the vision check (gemini-3.8-flash, WITH the key) — a flagged picture says "Insert anyway" and offers
// ↻ which redraws with the findings added to the rules; a clean one inserts through the panel's usual upload. A check that cannot be read = "look yourself".
// 📊 Chart from the numbers: groups / n / p / skew / outliers / panels read from the stem, editable, drawn as SVG (no AI, no verdict words), inserted the same way.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8');
assert.ok(/<script src="quiz-qimage\.js\?v=V102\.\d+"><\/script>/.test(admin) && /quiz-qimage\.css\?v=V102\.\d+/.test(admin), 'the module + stylesheet are cache-busted with the release');

const STEM = 'การศึกษาคะแนนสุขภาพเปรียบเทียบผู้ป่วยสองกลุ่มอิสระ กลุ่มละ 45 คน แต่ละกลุ่มมี Histogram เบ้ขวาเล็กน้อย Q-Q plot ใกล้เส้นตรง ไม่พบค่าสุดโต่ง และ Shapiro-Wilk test ได้ p = 0.08 และ 0.12 หากต้องการเปรียบเทียบค่าเฉลี่ย ควรดำเนินการอย่างไร';
const OPTS = ['ใช้การทดสอบแมนน์–วิทนีย์ เพราะความเบ้เล็กน้อยทำให้การทดสอบทีใช้ไม่ได้', 'ใช้การทดสอบทีแบบ Welch เพราะหลักฐานโดยรวมไม่ชี้การเบี่ยงเบนรุนแรง', 'แปลงข้อมูลเป็นลอการิทึมก่อน', 'เพิ่มตัวอย่างจนค่า p เกิน 0.20 ก่อน'];

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', r => { const u = r.request().url(); return u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(u) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && window.QuizQImage && typeof window._qImproveCtx === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(300);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none !important}' });   // the guide opens late offline and would sit on top

        // pure: the stem → chart spec
        const parsed = await page.evaluate(STEM => {
            const P = window.QuizQImage._parseStats;
            return [P(STEM), P('n = 30, p < 0.05, box plot'), P('สามกลุ่ม ข้อมูลเบ้ซ้ายมาก มีค่าสุดโต่ง'), P('![x](https://a/b.webp) Two groups, K-S test p = 0.2, 0.01')];
        }, STEM);
        assert.deepEqual(parsed[0], { test: 'Shapiro–Wilk p', panels: { hist: true, qq: true, box: false }, groups: [{ name: 'Group 1', n: 45, shape: 'slight-right', p: '0.08', outliers: false }, { name: 'Group 2', n: 45, shape: 'slight-right', p: '0.12', outliers: false }] }, 'the owner\'s stem: 2 groups · n 45 · slight right skew · p 0.08 / 0.12 · no outliers · histogram + Q-Q · Shapiro–Wilk: ' + JSON.stringify(parsed[0]));
        assert.deepEqual([parsed[1].groups.length, parsed[1].groups[0].n, parsed[1].groups[0].p, parsed[1].panels, parsed[1].test], [1, 30, '0.05', { hist: false, qq: false, box: true }, 'p']);
        assert.deepEqual([parsed[2].groups.length, parsed[2].groups[0].shape, parsed[2].groups[0].outliers, parsed[2].panels.hist], [3, 'strong-left', true, true], 'Thai group count, strong left skew, outliers; histogram when no panel is named');
        assert.deepEqual([parsed[3].groups.map(g => g.p), parsed[3].test], [['0.2', '0.01'], 'K–S p'], 'an image already in the stem is ignored');

        await page.evaluate(([STEM, OPTS]) => {
            window.showToast = () => {};
            document.getElementById('quizManageModal').style.display = 'block'; const dash = document.getElementById('dashboard-container'); if (dash) dash.style.display = 'block';
            const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
            addQuestionUI({ q: STEM, type: 'choice', options: OPTS, correct: [1], timer: 75 });
            document.querySelector('.quiz-q-item').style.display = 'block';
            document.querySelector('.quiz-q-item .q-primer-model').value = 'claude-sonnet-5-5';
            try { localStorage.removeItem('quiz_scene_ai_model'); } catch (_) { /* none */ }
            const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const g = cv.getContext('2d'); g.fillStyle = '#3b82f6'; g.fillRect(0, 0, 40, 30);
            const PNG = cv.toDataURL('image/png');
            window.__calls = []; window.__checks = [{ ok: false, findings: ['bottom box names Independent t-test'] }, { ok: true, findings: [] }, 'not json'];
            window.callUniversalAI = async (model, prompt, isJson, vision, key, opts) => {
                window.__calls.push({ model, prompt, isJson, vision: vision ? { mime: vision.image_mimetype, len: (vision.image_base64 || '').length } : null, opts });
                const f = opts && opts.feature;
                if (f === 'quiz_scene_brief') return { text: JSON.stringify({ brief: 'Two panels, Group 1 and Group 2, n = 45 each: a slightly right-skewed histogram and a Q-Q plot close to the line; labels p = 0.08 and p = 0.12.', alt: 'Two groups: histogram, Q-Q plot, p values' }) };
                if (f === 'quiz_scene') return { imageDataUrl: PNG };
                if (f === 'quiz_scene_check') { const c = window.__checks.shift(); return { text: typeof c === 'string' ? c : JSON.stringify(c) }; }
                throw new Error('unexpected feature ' + f);
            };
            window.__puts = [];
            window.adminApp = { storage: () => ({ ref: path => ({ put: async (blob, meta) => { window.__puts.push([path, blob.type, meta && meta.contentType]); }, getDownloadURL: async () => 'https://stub.storage/' + path }) }) };
            document.querySelector('.quiz-q-item [onclick^="QuizQImage.toggle"]').click();
        }, [STEM, OPTS]);

        // the button in the 🖼 panel
        const scBtn = page.locator('.qimg-panel .qimg-scene');
        assert.equal(await scBtn.count(), 1, '✨ Scene sits in the 🖼 panel');
        assert.match(await scBtn.getAttribute('title'), /never the answer[\s\S]*ไม่เฉลย/, 'EN + TH hover');
        await scBtn.evaluate(b => b.click());
        const sheet = page.locator('.qimg-panel .qsc');
        assert.equal(await sheet.count(), 1, 'the sheet opens');
        assert.equal(await page.evaluate(() => window.__calls.length), 0, 'nothing runs on open (owner rule: no AI until asked)');
        assert.deepEqual(await sheet.locator('.qsc-tab').evaluateAll(bs => bs.map(b => [b.textContent.trim(), b.getAttribute('aria-pressed')])), [['✨ AI picture', 'true'], ['📊 Chart from the numbers', 'false']]);
        assert.equal(await sheet.locator('.qsc-no span').count(), 4, 'the four "never" rules are shown');
        assert.deepEqual(await sheet.locator('[data-model]').evaluateAll(bs => bs.map(b => b.getAttribute('aria-pressed'))), ['true', 'false', 'false', 'false'], 'Nano Banana 2.1 first');
        await sheet.locator('[data-model="or/openai/gpt-image-2.5-flare"]').evaluate(b => b.click());
        assert.equal(await page.evaluate(() => localStorage.getItem('quiz_scene_ai_model')), 'or/openai/gpt-image-2.5-flare', 'the pick is remembered');

        // ✨ Generate with an empty brief → brief, picture, check → flagged
        await sheet.locator('.qsc-gen').evaluate(b => b.click());
        await page.waitForSelector('.qsc-chk.bad', { timeout: 8000 });
        const c1 = await page.evaluate(() => window.__calls);
        assert.deepEqual(c1.map(c => c.opts.feature), ['quiz_scene_brief', 'quiz_scene', 'quiz_scene_check']);
        assert.equal(c1[0].model, 'claude-sonnet-5-5', 'the brief uses the Read first row\'s model');
        assert.ok(c1[0].prompt.includes(STEM) && OPTS.every(o => c1[0].prompt.includes(o)), 'the brief prompt carries the stem and every option');
        assert.ok(!/✓|correct|keyed/i.test(c1[0].prompt), 'NO answer key in the brief prompt');
        assert.deepEqual([c1[1].model, c1[1].opts.imageApi, c1[1].opts.aspectRatio, c1[1].isJson], ['or/openai/gpt-image-2.5-flare', true, '4:3', false], 'the picked image model, Image API at 4:3');
        assert.ok(/NEVER in the picture/.test(c1[1].prompt) && c1[1].prompt.includes('slightly right-skewed histogram') && !/✓|correct/i.test(c1[1].prompt), 'the image prompt = the never-rules + the brief, no key');
        assert.deepEqual([c1[2].model, c1[2].vision && c1[2].vision.mime, c1[2].vision && c1[2].vision.len > 100], ['gemini-3.8-flash', 'image/jpeg', true], 'the check reads the picture (JPEG)');
        assert.ok(c1[2].prompt.includes('✓ ' + OPTS[1]) && !c1[2].prompt.includes('✓ ' + OPTS[0]), 'the check knows the keyed answer');
        let ui = await page.evaluate(() => ({ find: [...document.querySelectorAll('.qsc-chk.bad li')].map(l => l.textContent), ins: document.querySelector('.qimg-insert').textContent, anyway: document.querySelector('.qimg-insert').classList.contains('qimg-anyway'), prev: !document.querySelector('.qimg-preview').hidden && /^blob:/.test(document.querySelector('.qimg-preview img').src), alt: document.querySelector('.qimg-alt').value, regen: !!document.querySelector('.qsc-regen'), brief: document.querySelector('.qsc-brief').value }));
        assert.deepEqual(ui, { find: ['bottom box names Independent t-test'], ins: 'Insert anyway', anyway: true, prev: true, alt: 'Two groups: histogram, Q-Q plot, p values', regen: true, brief: 'Two panels, Group 1 and Group 2, n = 45 each: a slightly right-skewed histogram and a Q-Q plot close to the line; labels p = 0.08 and p = 0.12.' }, 'flagged: findings listed, "Insert anyway", ↻ offered, the brief shown for editing: ' + JSON.stringify(ui));

        // ↻ → redraw with the finding added, the brief kept → clean
        await page.locator('.qsc-regen').evaluate(b => b.click());
        await page.waitForSelector('.qsc-chk.ok', { timeout: 8000 });
        const c2 = await page.evaluate(() => window.__calls.slice(3));
        assert.deepEqual(c2.map(c => c.opts.feature), ['quiz_scene', 'quiz_scene_check'], 'no second brief');
        assert.ok(c2[0].prompt.includes('rejected for: bottom box names Independent t-test'), 'the finding goes into the next prompt');
        ui = await page.evaluate(() => ({ av: [...document.querySelectorAll('.qsc-no .qsc-av')].map(s => s.textContent), thumbs: document.querySelectorAll('.qsc-cand button').length, cur: document.querySelector('.qsc-cand button[aria-pressed="true"]').dataset.cand, ins: document.querySelector('.qimg-insert').textContent }));
        assert.deepEqual(ui, { av: ['🚫 bottom box names Independent t-test'], thumbs: 2, cur: '1', ins: 'Insert' }, 'clean: the extra rule shown, two thumbnails, Insert: ' + JSON.stringify(ui));
        // the first thumbnail brings the flagged one back
        await page.locator('.qsc-cand button[data-cand="0"]').evaluate(b => b.click());
        assert.equal(await page.locator('.qimg-insert').textContent(), 'Insert anyway');
        await page.locator('.qsc-cand button[data-cand="1"]').evaluate(b => b.click());

        // Insert = the panel's own path: upload (webp) + ![alt](url) in the stem
        await page.locator('.qimg-insert').evaluate(b => b.click());
        await page.waitForFunction(() => /!\[Two groups: histogram, Q-Q plot, p values\]\(https:\/\/stub\.storage\/editor-images\/quiz-q-/.test(document.querySelector('.quiz-q-item .q-text').value));
        assert.deepEqual(await page.evaluate(() => window.__puts.map(p => [p[1], p[2]])), [['image/webp', 'image/webp']], 'uploaded once as WebP');
        assert.equal(await page.locator('.qimg-insert').textContent(), 'Insert', 'the label resets after the insert');

        // a check that cannot be read → "look yourself", Insert stays plain
        await page.locator('.qsc-gen').evaluate(b => b.click());
        await page.waitForSelector('.qsc-chk.warn', { timeout: 8000 });
        assert.match(await page.locator('.qsc-chk.warn').innerText(), /look at the picture yourself/);
        assert.equal(await page.locator('.qimg-insert').textContent(), 'Insert');

        // 📊 Chart from the numbers — no AI
        const n0 = await page.evaluate(() => window.__calls.length);
        await page.locator('.qsc-tab[data-tab="chart"]').evaluate(b => b.click());
        const rows = await page.locator('.qsc-gr').evaluateAll(rs => rs.map(r => [r.querySelector('[data-f=name]').value, r.querySelector('[data-f=n]').value, r.querySelector('[data-f=shape]').value, r.querySelector('[data-f=p]').value, r.querySelector('[data-f=outliers]').checked]));
        assert.deepEqual(rows, [['Group 1', '45', 'slight-right', '0.08', false], ['Group 2', '45', 'slight-right', '0.12', false]], 'read from the stem: ' + JSON.stringify(rows));
        assert.deepEqual(await page.locator('[data-panel]').evaluateAll(bs => bs.map(b => b.getAttribute('aria-pressed'))), ['true', 'true', 'false'], 'histogram + Q-Q on, box off');
        const svgText = () => page.locator('.qsc-img svg').evaluate(s => [...s.querySelectorAll('text')].map(t => t.textContent));
        let texts = await svgText();
        assert.deepEqual(texts.filter(t => /n =|p =/.test(t)), ['Group 1 · n = 45', 'Shapiro–Wilk p = 0.08', 'Group 2 · n = 45', 'Shapiro–Wilk p = 0.12'], 'titles + p labels: ' + JSON.stringify(texts));
        assert.ok(!texts.some(t => /normal|t-test|accept|reject|significant|therefore|welch|mann/i.test(t)), 'no verdict or method words in the chart');
        assert.equal(await page.locator('.qsc-img svg circle').count() > 40, true, 'Q-Q dots drawn');
        // edit: p of group 2, add the box plot, an outlier in group 1
        await page.evaluate(() => { const p = document.querySelectorAll('.qsc-gr')[1].querySelector('[data-f=p]'); p.value = '0.03'; p.dispatchEvent(new Event('input')); });
        assert.ok((await svgText()).includes('Shapiro–Wilk p = 0.03'), 'the chart follows the edit');
        await page.locator('[data-panel="box"]').evaluate(b => b.click());
        await page.evaluate(() => { const o = document.querySelectorAll('.qsc-gr')[0].querySelector('[data-f=outliers]'); o.checked = true; o.dispatchEvent(new Event('change')); });
        texts = await svgText();
        assert.equal(texts.filter(t => t === 'Box plot').length, 2, 'a box plot per group');
        assert.ok(await page.locator('.qsc-img svg circle[r="3.5"]').count() >= 1, 'the outlier is drawn on the box plot');
        // a third group, then remove it
        await page.locator('.qsc-add').evaluate(b => b.click());
        assert.equal(await page.locator('.qsc-gr').count(), 3); assert.ok((await svgText()).includes('Group 3 · n = 45'));
        await page.locator('.qsc-del[data-del="2"]').evaluate(b => b.click());
        assert.equal(await page.locator('.qsc-gr').count(), 2);
        // use → preview + alt, Insert → a second upload
        await page.locator('.qsc-use').evaluate(b => b.click());
        await page.waitForFunction(() => !document.querySelector('.qimg-preview').hidden && /^Group 1/.test(document.querySelector('.qimg-alt').value));   // the AI candidate was on show; wait for the chart to replace it
        assert.equal(await page.locator('.qimg-alt').inputValue(), 'Group 1, Group 2 (n = 45): Histogram, Q-Q plot, Box plot, Shapiro–Wilk p');
        await page.locator('.qimg-insert').evaluate(b => b.click());
        await page.waitForFunction(() => (document.querySelector('.quiz-q-item .q-text').value.match(/!\[/g) || []).length === 2);
        assert.equal(await page.evaluate(() => window.__calls.length), n0, 'the chart never called an AI');
        assert.equal(await page.evaluate(() => window.__puts.length), 2);

        // ✨ Scene toggles the sheet off
        await page.locator('.qimg-scene').evaluate(b => b.click());
        assert.equal(await page.locator('.qsc').count(), 0, 'closed');

        const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
        assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
        console.log('PASS: ✨ Scene — in the 🖼 panel, nothing runs on open, brief from stem + unmarked options with the row model, picked image model (Image API 4:3), vision leak check with the key, flagged → Insert anyway + ↻ with the findings as rules, thumbnails, upload + ![alt](url); unreadable check → look yourself; 📊 chart read from the stem (groups / n / p / skew / outliers / panels / test), editable, no verdict words, no AI, inserted the same way');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
