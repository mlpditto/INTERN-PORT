// V102.331: 📎 Documents round 1 (owner's mockup). The REAL admin.html in Chromium (network stubbed, fake db, sample review):
// ① an opaque stored name shows as "CV #n" (upload order; real name in the tooltip; a readable name stays) in the row and the review head;
// ② the Summary box has a dot legend; ③ ⇄ swaps A ↔ B (saved + rails redrawn); ④ a same-vendor / same-model hint, never a block;
// ⑤ the Suggestions tab has a progress bar that follows each tick; ⑥ the 🤖 tooltip says changes apply to the NEXT review.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const LONG = 'ACFrOgALgAp7i8NjUNJW3VtEluwlmOs7aqVf945_7_wARdTEYhqjliAFtqaRbWuLcXsDpb3ML4FwJ';
const LONG2 = 'ACFrOgBBzz9i8NjUNJW3VtEluwlmOs7aqVf945_7_wARdTEYhqjliAFtqaRbWuLcXsDpb3ML4FwJ';

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => {
            const u = r.request().url();
            if (u.startsWith('file:')) return r.continue();
            if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
            return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
        });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof openApplicantDocs === 'function' && typeof apdDocLabel === 'function' && typeof window.providerModelRailHtml === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(400);
        await page.addStyleTag({ content: '#adminGuideOverlay{display:none!important}' });
        await page.evaluate(([LONG, LONG2]) => {
            const ts = ms => ({ toMillis: () => ms });
            preRegData = [{ id: 'PRE1', fullName: 'Test Applicant' }]; usersData = [];
            // newest first in the cache (as loaded); upload order decides the number
            applicantDocsCache = { PRE1: [
                { id: 'd2', name: LONG2, size: 2048, contentType: 'application/pdf', uploadedAt: ts(2e12) },
                { id: 'd1', name: LONG, size: 166912, contentType: 'application/pdf', uploadedAt: ts(1e12) },
                { id: 'd3', name: 'CV_Natt.pdf', size: 4096, contentType: 'application/pdf', uploadedAt: ts(3e12) },
            ] };
            localStorage.setItem('ai_text_apd-model-a', 'gpt-6-luna'); localStorage.setItem('ai_text_apd-model-b', 'claude-opus-5-5');
            const data = { summary: 's', strengths: ['a'], gaps: ['b'], questions: ['c'], suggestions: ['x1', 'x2', 'x3', 'x4'] };
            const run = { id: 'r1', preUserId: 'PRE1', docId: 'd1', docName: LONG, by: 'admin@x', at: { toDate: () => new Date() }, models: ['gpt-6-luna', 'claude-opus-5-5'], mode: 'pharmacy', lang: 'th',
                results: [{ model: 'gpt-6-luna', data }, { model: 'claude-opus-5-5', data }], done: { '0_0': true, '0_1': true, '1_2': true },
                summary: { points: [{ text: 'p1', from: 'AB' }, { text: 'p2', from: 'B' }], verdict: 'v' } };
            window.__updates = [];
            window.db = { collection: () => ({ where: () => ({ get: async () => ({ docs: [{ id: 'r1', data: () => run }] }) }), add: async () => ({ id: 'x' }), doc: id => ({ update: async p => { __updates.push([id, p]); } }) }) };
            const m = document.getElementById('applicantDocsModal');
            for (let a = m.parentElement; a && a !== document.documentElement; a = a.parentElement) if (getComputedStyle(a).display === 'none') a.style.setProperty('display', 'block', 'important');
            openApplicantDocs('PRE1');
        }, [LONG, LONG2]);
        await page.waitForFunction(() => document.querySelector('#apd-ai .apd-saved-head'), null, { timeout: 5000 });

        // ① labels
        const names = await page.$$eval('#apd-list .apd-name', es => es.map(e => [e.textContent, e.title]));
        assert.deepEqual(names.map(n => n[0]), ['CV #2', 'CV #1', 'CV_Natt.pdf'], 'upload order numbers the opaque names; a readable name stays: ' + JSON.stringify(names));
        assert.equal(names[1][1], LONG, 'the real name is in the tooltip');
        const head = await page.$eval('#apd-ai .apd-saved-head', e => e.textContent);
        assert.match(head, /· CV #1 ·/); assert.ok(!head.includes('ACFrOg'), 'no code in the head');
        assert.equal(await page.evaluate(() => apdDocLabel('gone', 'ACFrOgALgAp7i8NjUNJW3VtEluwlmOs7aqVf945')), 'CV', 'a deleted file → CV');

        // ② legend
        assert.match(await page.$eval('#apd-ai .apd-sum h5 .apd-legend', e => e.textContent), /ทั้งสองโมเดล.*A\/B โมเดลเดียว/);

        // ④ no hint for two vendors
        assert.equal(await page.$eval('#apd-vwarn', e => e.hidden), true, 'Luna + Opus → no hint');

        // ③ swap
        assert.equal(await page.$$eval('#apd-ab > .apd-swap', e => e.length), 1, 'one ⇄ between A and B');
        assert.equal(await page.$eval('#apd-ab', e => [...e.children].map(c => c.className).join(' | ')), 'apd-ab-row | apd-swap | apd-ab-row');
        await page.click('#apd-ab .apd-swap');
        assert.deepEqual(await page.evaluate(() => [document.getElementById('apd-model-a').value, document.getElementById('apd-model-b').value, localStorage.getItem('ai_text_apd-model-a'), localStorage.getItem('ai_text_apd-model-b')]),
            ['claude-opus-5-5', 'gpt-6-luna', 'claude-opus-5-5', 'gpt-6-luna'], 'A and B swapped and saved');
        assert.equal(await page.$eval('#apd-ab .apd-ab-row .text-ai-chips button.active', e => e.dataset.value), 'claude-opus-5-5', 'rail A redrawn on the new pick');
        await page.click('#apd-ab .apd-swap');

        // ④ same vendor → hint; same model → its own hint; another vendor → gone
        const pickB = id => page.evaluate(id => { const row = document.querySelectorAll('#apd-ab .apd-ab-row')[1]; const tab = row.querySelector('.audit-provider[data-provider="GPT"]'); if (tab) browseAuditProvider(tab); row.querySelector(`.text-ai-chips button[data-value="${id}"]`).click(); }, id);
        await pickB('gpt-6-sol');
        assert.equal(await page.$eval('#apd-vwarn', e => e.hidden), false); assert.match(await page.$eval('#apd-vwarn', e => e.innerText), /same vendor.*เลือกคนละค่าย/, 'both languages visible');
        await pickB('gpt-6-luna');
        assert.match(await page.$eval('#apd-vwarn', e => e.textContent), /same model — only one review/);
        await page.evaluate(() => { const row = document.querySelectorAll('#apd-ab .apd-ab-row')[1]; browseAuditProvider(row.querySelector('.audit-provider[data-provider="Claude"]')); row.querySelector('.text-ai-chips button[data-value="claude-opus-5-5"]').click(); });
        assert.equal(await page.$eval('#apd-vwarn', e => e.hidden), true, 'hint gone after another vendor');

        // ⑤ progress
        await page.evaluate(() => apdSetTab('sug'));
        assert.deepEqual(await page.$eval('#apd-sug-prog', e => [e.querySelector('b').style.width, e.textContent.trim()]), ['38%', '3 / 8 ทำแล้ว']);
        await page.click('#apd-ai input[onchange*="\'r1\',1,3,"]');
        await page.waitForTimeout(100);
        assert.deepEqual(await page.$eval('#apd-sug-prog', e => [e.querySelector('b').style.width, e.textContent.trim()]), ['50%', '4 / 8 ทำแล้ว'], 'the bar follows the tick');
        assert.deepEqual(await page.evaluate(() => __updates), [['r1', { 'done.1_3': true }]], 'the tick still saves the same way');

        // ⑥ tooltip
        assert.match(await page.evaluate(() => apdAiBtnTitle()), /NEXT review — saved ones keep theirs/);
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('documents-round1-qa: all checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
