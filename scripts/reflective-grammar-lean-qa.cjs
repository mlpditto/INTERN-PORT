// V102.367: Reflective Review · Writing Analysis column, lean (owner's PR 2) — Issues → Suggestions → Why these changes (Apply per change,
// Apply all on the heading) → the edited preview only once something is applied → the improved sample folded at the end as a plain
// sentence (no word-level diff). The REAL admin.html with a fixture log, a fixture analysis and the real apply / reset handlers.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

// static pins: the improved sample no longer runs the word diff; the sandbox panel returns '' while nothing is applied
const fold = html.slice(html.indexOf('const improvedFold ='), html.indexOf('</details>` : \'\';', html.indexOf('const improvedFold =')));
assert.ok(fold.includes('<details class="rr-improved"') && !fold.includes('renderWordDiff') && fold.includes('escapeHtml(data.improved)'), 'improved sample = folded plain sentence');
assert.ok(html.includes("if (isEmpty) return '';   // V102.367"), 'no preview panel before the first Apply');
assert.ok(html.includes('html += renderGrammarSandboxPanel(logIdNow, originalText, cleanChanges);\n            html += improvedFold;'), 'order: why → preview → folded sample');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reviewReflective === 'function' && typeof window.renderGrammarAnalysis === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(async () => {
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            const ORIG = 'ยังไม่สามารถทำงานได้ครบกระบวนการทั้งหมดโดยยังไม่ต้องถาม ได้เรียนรู้เทคนิคการเลือกยา การแยกโรคในร้านยามากขึ้น';
            reflectiveLogsCache = [{ id: 'r1', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: { toDate: () => new Date(2026, 9, 22, 18, 6) }, content: ORIG }];
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
            await reviewReflective('r1');
            await new Promise(res => setTimeout(res, 300));
            const RAW = JSON.stringify({ grade: 'พอใช้', issues: [{ issue: 'ประโยคแรกเรียงคำไม่เป็นธรรมชาติ', severity: 'medium' }], suggestions: ['ระบุให้ชัดว่าต้องการทำงานส่วนใดให้ครบด้วยตนเอง'],
                improved: 'ยังไม่สามารถปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง ได้เรียนรู้เทคนิคการเลือกยาและการคัดแยกโรคเพิ่มขึ้น',
                changes: [{ from: 'ทำงานได้ครบกระบวนการทั้งหมดโดยยังไม่ต้องถาม', to: 'ปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง', reason: 'ชัดขึ้น' }, { from: 'การแยกโรคในร้านยามากขึ้น', to: 'การคัดแยกโรคในร้านยาเพิ่มขึ้น', reason: 'คำตรงกว่า' }] });
            window._reflectiveGrammarCache = { r1: { rawText: RAW, originalText: ORIG } };
            renderGrammarAnalysis(RAW, ORIG);
            const content = document.getElementById('reflective-grammar-content');
            const KEYS = [[/^⚠ Issues/, 'issues'], [/^💡 Writing/, 'suggestions'], [/^✏ Improved/, 'improved'], [/^🛠 Edited/, 'preview'], [/^📚 Why/, 'why']];
            const heads = () => { const seen = []; [...content.querySelectorAll('div')].forEach(d => { const t = d.textContent.replace(/\s+/g, ' ').trim(); const k = KEYS.find(([re]) => re.test(t)); if (k && t.length < 80 && !seen.includes(k[1])) seen.push(k[1]); }); return seen; };
            const vis = el => !!(el && (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length));   // a closed <details> needs checkVisibility()
            const snap = () => ({ heads: heads(), preview: !!content.querySelector('[style*="admin sandbox"], div:has(> div > div)') && /Edited preview/.test(content.textContent), applyBtns: [...content.querySelectorAll('button')].map(b => b.textContent.trim()), details: !!content.querySelector('details.rr-improved'), detailsOpen: !!(content.querySelector('details.rr-improved') || {}).open, sampleVisible: vis(content.querySelector('details.rr-improved > div')), wordDiffSpans: content.querySelectorAll('details.rr-improved span').length, order: [...content.children].map(c => c.tagName + ':' + c.textContent.replace(/\s+/g, ' ').trim().slice(0, 10)) });
            const before = snap();
            // Apply the first change → the preview panel appears with 1 / 2 applied; Apply all leaves the heading (it is on the panel now)
            grammarApplyChange(0); await new Promise(res => setTimeout(res, 50));
            const after1 = snap(); after1.previewText = (content.textContent.match(/\d \/ \d applied/) || [])[0];
            // open the folded sample
            content.querySelector('details.rr-improved').open = true; await new Promise(res => setTimeout(res, 30));
            const opened = { sampleVisible: vis(content.querySelector('details.rr-improved > div')), sampleText: content.querySelector('details.rr-improved > div').textContent.trim() };
            grammarResetSandbox(); await new Promise(res => setTimeout(res, 50));
            const reset = snap();
            return { before, after1, opened, reset, cardShown: getComputedStyle(document.getElementById('reflective-grammar-card')).display !== 'none' };
        });
        assert.deepEqual(r.before.heads, ['issues', 'suggestions', 'why'], 'before any Apply: Issues → Suggestions → Why — no Improved sample heading, no Edited preview: ' + JSON.stringify(r.before.heads));
        assert.equal(r.before.preview, false, 'no preview panel before the first Apply');
        assert.deepEqual(r.before.applyBtns, ['➕ Add tip to reply', 'Apply all', 'Apply', 'Apply'], 'tip chip (V102.368) + Apply all on the Why heading + one Apply per change: ' + JSON.stringify(r.before.applyBtns));
        assert.deepEqual([r.before.details, r.before.detailsOpen, r.before.sampleVisible, r.before.wordDiffSpans], [true, false, false, 0], 'the improved sample is a closed <details> with a plain sentence (no diff spans)');
        assert.ok(r.before.order[r.before.order.length - 1].startsWith('DETAILS:'), 'the folded sample is last: ' + JSON.stringify(r.before.order));
        assert.equal(r.after1.preview, true, 'after one Apply the preview panel appears'); assert.equal(r.after1.previewText, '1 / 2 applied');
        assert.deepEqual(r.after1.applyBtns, ['➕ Add tip to reply', '✓ Applied', 'Apply', 'Apply all', 'Reset', '📋 Copy'], 'first change marked Applied, Apply all moved to the panel: ' + JSON.stringify(r.after1.applyBtns));
        assert.ok(r.after1.heads.indexOf('why') < r.after1.heads.indexOf('preview'), 'Why stays above the preview: ' + JSON.stringify(r.after1.heads));
        assert.deepEqual([r.opened.sampleVisible, r.opened.sampleText], [true, 'ยังไม่สามารถปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง ได้เรียนรู้เทคนิคการเลือกยาและการคัดแยกโรคเพิ่มขึ้น'], 'opening the fold shows the plain improved sentence');
        assert.deepEqual([r.reset.preview, r.reset.applyBtns], [false, ['➕ Add tip to reply', 'Apply all', 'Apply', 'Apply']], 'Reset: the panel goes away, Apply all back on the heading');
        assert.equal(r.cardShown, true);
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Reflective Review Writing Analysis lean — Why these changes first (Apply, Apply all on the heading), the edited preview only after an Apply, the improved sample folded at the end as a plain sentence; Reset restores');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
