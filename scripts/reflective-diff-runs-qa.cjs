// V102.373: the Reflective Review Edited preview's word diff shows a changed Thai phrase whole — same-kind tokens merge into ONE run, a
// run that touches Thai script gets no side padding, and a changed space is just a space (no green blob). The REAL admin.html through the
// real review flow (renderGrammarAnalysis → Apply all → the sandbox preview), with the owner's live example (Patra, 2026-10-22).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));
assert.ok(html.includes('function diffRuns(ops) {') && html.includes('return diffRuns(diffWords(original, improved)).map(op => {') && /const pad = \/\^\[[฀\\u]\S*\]\|\[\S*\]\$\/\.test\(op\.text\) \? '0' : '0 3px';/.test(html), 'runs + the Thai padding rule');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reviewReflective === 'function' && typeof window.grammarApplyAll === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(async () => {
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
            const wait = ms => new Promise(res => setTimeout(res, ms));
            const preview = () => { const c = document.getElementById('reflective-grammar-content'); return [...c.querySelectorAll('div')].find(d => /line-height:\s*1\.6/.test(d.getAttribute('style') || '') && d.querySelector('span')) || [...c.querySelectorAll('div')].find(d => /line-height:\s*1\.6/.test(d.getAttribute('style') || '')); };
            const cases = [
                ['ออกใบกำกับภาษี,จ่ายยาคนไข้', 'ออกใบกำกับภาษี, จ่ายยาให้คนไข้'],
                ['จัดสินค้าเข้า shelf', 'จัดสินค้าเข้าชั้นวาง (shelf)'],
                ['dis mirogabarin', 'จ่ายยา mirogabalin'],
                ['ได้เรียนรู้ยี่ห้อยามากขึ้น', 'ได้เรียนรู้เกี่ยวกับยี่ห้อยามากขึ้น'],
                ['The patient take the drug', 'The patient takes the drug daily']
            ];
            const out = [];
            for (let i = 0; i < cases.length; i++) {
                const [from, to] = cases[i], id = 'r' + i;
                reflectiveLogsCache = [{ id, userId: 'U1', userName: 'Patra', mood: 'happy', timestamp: { toDate: () => new Date(2026, 9, 22, 20, 49) }, content: from }];
                await reviewReflective(id); await wait(150);
                const RAW = JSON.stringify({ grade: 'พอใช้', issues: [], suggestions: [], improved: to, changes: [{ from, to, reason: 'x' }] });
                window._reflectiveGrammarCache = Object.assign(window._reflectiveGrammarCache || {}, { [id]: { rawText: RAW, originalText: from } });
                renderGrammarAnalysis(RAW, from); grammarApplyAll(); await wait(80);
                const pv = preview(); if (!pv) { out.push({ err: 'no preview' }); continue; }
                const spans = [...pv.querySelectorAll('span')].map(s => ({ t: (s.style.textDecoration === 'line-through' ? '-' : '+') + s.textContent, pad: s.style.paddingLeft || '0px' }));
                const d = pv.cloneNode(true); [...d.querySelectorAll('span')].filter(s => s.style.textDecoration === 'line-through').forEach(s => s.remove());
                const kinds = [...pv.querySelectorAll('span')].map(s => s.style.textDecoration === 'line-through' ? 'd' : 'a');
                const sameTouch = [...pv.innerHTML.matchAll(/<\/span><span/g)].length > 0 && pv.innerHTML.split('</span><span').slice(0, -1).some((part, k) => kinds[k] === kinds[k + 1]);   // a del right before its add is a replacement — fine
                out.push({ spans, plain: d.textContent, adjacent: sameTouch });
            }
            return out;
        });
        r.forEach((o, i) => { assert.ok(!o.err, 'case ' + i + ': ' + o.err); assert.equal(o.adjacent, false, 'case ' + i + ': no two spans of one kind touch: ' + JSON.stringify(o.spans)); });
        assert.deepEqual(r[0].spans, [{ t: '+ให้', pad: '0px' }], 'Patra line 1: the inserted space is plain, the Thai word has no side padding: ' + JSON.stringify(r[0]));
        assert.equal(r[0].plain, 'ออกใบกำกับภาษี, จ่ายยาให้คนไข้');
        assert.deepEqual(r[1].spans.map(s => s.t + '|' + s.pad), ['+ชั้นวาง|0px', '+(|3px', '+)|3px'], 'shelf line: the Thai run unpadded, the inserted space plain, the brackets padded, "shelf" stays plain: ' + JSON.stringify(r[1]));
        assert.equal(r[1].plain, 'จัดสินค้าเข้าชั้นวาง (shelf)');
        assert.deepEqual(r[2].spans, [{ t: '-dis', pad: '3px' }, { t: '+จ่ายยา', pad: '0px' }, { t: '-mirogabarin', pad: '3px' }, { t: '+mirogabalin', pad: '3px' }], 'a replaced pair of words: del/add per word around the kept space, the Thai run unpadded: ' + JSON.stringify(r[2]));
        assert.deepEqual(r[3].spans, [{ t: '+เกี่ยวกับ', pad: '0px' }], 'one inserted Thai word = one run, no padding');
        assert.deepEqual(r[4].spans.map(s => s.t + '|' + s.pad), ['-take|3px', '+takes|3px', '+ daily|3px'], 'Latin runs keep the 3px side padding (an added word carries its space): ' + JSON.stringify(r[4]));
        assert.equal(r[4].plain, 'The patient takes the drug daily');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Edited preview word diff — same-kind tokens merge into one run, Thai runs have no side padding, a changed space is plain; Latin diffs unchanged');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
