// V102.237 → V102.255 — Quality Improvement Comparison: the whole control area is TWO lines at the TOP (no footer), less text + inline + minimal.
//   1 · 🛠️ · B + vendors + models · ⚖️ 🧬 🔄 · ↩ ➕ [Apply │ ▶] · ✕     2 · icon chips (✍️ 🔢 🎯 · ✦ model · ⚠ Qn) · Steer… · tools 👁️ 📄 📝 🔎 🧩 · ◀ n/N ▶
// The REAL previewAiFix in the real admin.html with a fixture question.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
        await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
        await page.waitForFunction(() => { try { return typeof previewAiFix === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
        await page.waitForTimeout(400);
        const open = (arrIdx, same) => page.evaluate(([ai, sameQ]) => {
            const old = document.getElementById('ai-compare-overlay'); if (old) old.remove();
            const q = { q: 'Which dose is right for an eGFR of 50 ml/min?', type: 'choice', options: ['keep', 'halve', 'stop', 'switch'], correct: [1] };
            const imp = sameQ ? q : { q: 'Which metformin dose is right when eGFR is 50 ml/min/1.73m²?', type: 'choice', options: ['keep it', 'halve it', 'stop', 'switch'], correct: [2] };
            window.getQuizFormData = () => ({ questions: [q, q, q] }); window._aiAnalysisModel = 'gpt-6-sol';
            window._aiAnalysisItems = Array.from({ length: 12 }, () => ({ improvedQuestion: imp }));
            previewAiFix(0, ai);
            const box = document.getElementById('ai-compare-overlay').firstElementChild, h = box.children[0];
            const txt = el => el.textContent.replace(/\s+/g, ' ').trim();
            const labels = el => [...el.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || txt(b));
            const lines = [...h.children].filter(c => c.classList.contains('cmp-line'));
            const apply = box.querySelector('.cmp-split');
            return {
                kids: box.children.length, lineCount: lines.length, headerH: Math.round(h.getBoundingClientRect().height),
                l1: labels(lines[0]).filter(x => !/Gemini|GPT|Claude|Qwen|DeepSeek|Grok|Ollama|Luna|Terra|Sol|Astra|Haiku|Sonnet|Opus|Fable|Lite|Flash|Pro|Max|Mini/i.test(x)), l1Picker: !!lines[0].querySelector('.cmp-b'), steerOnL2: !!lines[1].querySelector('input.cmp-steer'), steerOnL1: !!lines[0].querySelector('input.cmp-steer'), l2HasNav: !!lines[1].querySelector('.cmp-nav, [aria-label="Previous"], [aria-label="Next"]') || /\d+\s*\/\s*\d+/.test(txt(lines[1])),
                l3Chips: [...lines[1].querySelectorAll('.cmp-chips > *')].map(c => ({ t: txt(c), title: c.getAttribute('title') || '' })), l3Tools: labels(lines[1].querySelector('.cmp-tools')),
                title: txt(lines[0].querySelector('h3')), titleTip: lines[0].querySelector('h3').title, tall: Math.round(h.getBoundingClientRect().height),
                header: txt(h), applyHtml: apply ? apply.innerHTML : null, applyBg: apply ? getComputedStyle(apply).backgroundColor : null, applyDisabled: !!box.querySelector('button[disabled][aria-label="Apply Fix"]'),
                addTxt: (box.querySelector('button[aria-label="Add New"]') || {}).textContent, over: Math.max(...[...h.querySelectorAll('button,input')].map(e => e.getBoundingClientRect().right)) <= h.getBoundingClientRect().right + 1,
            };
        }, [arrIdx, same]);

        // 1 · layout: exactly 2 lines, no footer, everything inside the header
        let r = await open(1, false);
        assert.equal(r.kids, 2, 'only header + body — no footer'); assert.equal(r.lineCount, 2, 'exactly two lines'); assert.ok(r.headerH <= 130, 'compact header: ' + r.headerH); assert.ok(r.over, 'nothing sticks out of the header on the right');
        assert.ok(r.l1.includes('Keep Original') && r.l1.includes('Add New') && r.l1.some(x => /Apply/.test(x)) && r.l1.includes('Close') === false, 'line 1 holds the commit buttons: ' + r.l1);
        assert.ok(r.l1.indexOf('Keep Original') < r.l1.indexOf('Add New'), 'order ↩ ➕ Apply');
        assert.equal(r.title, '🛠️', 'icon-only title'); assert.equal(r.titleTip, 'Quality Improvement Comparison', 'full name in the tooltip');
        assert.ok(r.l1Picker, 'line 1 holds Model B (vendors + models)'); assert.ok(r.steerOnL2 && !r.steerOnL1, 'Steer… field on line 2'); for (const n of ['Compare B', 'Merge', 'Regenerate']) assert.ok(r.l1.includes(n), 'line 1 has ' + n + ': ' + r.l1);
        assert.ok(r.l1.indexOf('Compare B') < r.l1.indexOf('Merge') && r.l1.indexOf('Merge') < r.l1.indexOf('Regenerate') && r.l1.indexOf('Regenerate') < r.l1.indexOf('Keep Original'), 'line 1 order: ⚖️ 🧬 🔄 then ↩ ➕ Apply'); assert.ok(r.l2HasNav, '◀ n/N ▶ moved to line 2');
        assert.deepEqual(r.l3Tools, ['Preview', 'Copy originals', 'Copy improved', 'Dup Check', 'Build'], 'line 2 tools are icon-only with names in aria-label');

        // 2 · less text: icon chips, short model name, "⚠ Qn" (the % lives in the tooltip), commit = ➕ + Apply │ ▶, no check marks
        const chipText = r.l3Chips.map(c => c.t);
        assert.ok(chipText.some(t => t === '✍️') && chipText.some(t => t === '🔢') && chipText.some(t => t === '🎯'), 'status chips are icons: ' + JSON.stringify(chipText));
        assert.ok(r.l3Chips.find(c => c.t === '🎯').title.startsWith('Logical fix'), 'icon chip keeps its meaning in the tooltip');
        assert.ok(chipText.some(t => /^✦ Sol 6$/.test(t)), 'model chip is short ("Sol 6"): ' + JSON.stringify(chipText));
        const dup = r.l3Chips.filter(c => /^⚠ Q\d+$/.test(c.t)); assert.ok(dup.length >= 1 && dup.every(c => /\d+%/.test(c.title)), '⚠ Qn chips carry the % in the tooltip: ' + JSON.stringify(r.l3Chips));
        assert.ok(!/Text Reworded|Options Balanced|Logical Fix|GPT 6|ซ้ำ|Add New|Apply &/.test(r.header), 'the long words are gone from the header: ' + r.header);
        assert.equal(r.addTxt, '➕'); assert.ok(!/[✅✓✔]/.test(r.header), 'no check marks anywhere in the header');
        assert.ok(/^<span>Apply<\/span><span class="cmp-split-next">▶<\/span>$/.test(r.applyHtml), 'Apply │ ▶ split button when a next suggestion exists: ' + r.applyHtml); assert.equal(r.applyBg, 'rgb(34, 197, 94)', 'green: ' + r.applyBg);

        // 3 · last suggestion: plain "Apply" (nothing to advance to)
        r = await open(11, false); assert.ok(/^<span>Apply<\/span>$/.test(r.applyHtml), 'last item: Apply without ▶: ' + r.applyHtml);
        // 4 · no meaningful difference: disabled grey Apply, still no footer
        r = await open(1, true); assert.equal(r.applyDisabled, true, 'disabled Apply when nothing changed'); assert.equal(r.kids, 2);

        // 5 · the navigation and the commit buttons still work
        await open(1, false);
        assert.equal(await page.locator('#ai-compare-overlay').count(), 1);
        await page.locator('#ai-compare-overlay button[aria-label="Keep Original"]').click(); assert.equal(await page.locator('#ai-compare-overlay').count(), 0, '↩ closes the modal');

        // 6 · "Comparing… 5s" stays inside its round button (compact spinner + seconds), words only in the tooltip
        await open(1, false);
        const busy = await page.evaluate(() => {
            const b = document.querySelector('#ai-compare-overlay button[aria-label="Compare B"]'); const next = b.nextElementSibling;
            b.classList.add('is-busy'); b.title = 'Comparing…'; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="cmp-sec">125s</span>';
            const r1 = b.getBoundingClientRect(), r2 = next.getBoundingClientRect();
            return { w: Math.round(r1.width), fits: b.scrollWidth <= b.clientWidth + 1, overlaps: r1.right > r2.left + 0.5 && r1.top < r2.bottom && r1.bottom > r2.top, text: b.textContent };
        });
        assert.ok(busy.fits && !busy.overlaps && busy.w <= 90, 'the busy button fits its box and does not cover its neighbour: ' + JSON.stringify(busy));
        assert.ok(!/Comparing…\s*['"+]/.test(require('fs').readFileSync('public/admin.html', 'utf8').slice(require('fs').readFileSync('public/admin.html', 'utf8').indexOf('window.generateAiProposalB = async'), require('fs').readFileSync('public/admin.html', 'utf8').indexOf('window.generateAiProposalB = async') + 900).replace(/title = 'Comparing…'/, '')), 'the words "Comparing…" are no longer written into the button face');
        console.log('PASS: Compare modal top bar — 2 lines and no footer (🛠️ · Model B · ⚖️ 🧬 🔄 · commit / chips · Steer · tools · nav), less text (icon chips, short names, ⚠ Qn, ➕ + Apply │ ▶, no check marks), disabled / last-item states, ↩ works, busy button stays inside its box');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
