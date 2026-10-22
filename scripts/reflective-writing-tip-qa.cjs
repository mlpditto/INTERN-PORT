// V102.368: Reflective Review · "➕ Add tip to reply" (owner's option A) — the first writing suggestion goes into the reply draft in the
// reply language, with the example edit and a checked reference picked by the suggestion's kind. The REAL admin.html with a fixture log,
// fixture analyses (object suggestions, string suggestions, unknown kind) and the real chip handler.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

// static pins: the prompt asks for kind + en; the references are a fixed table with the checked links
assert.ok(html.includes('"kind": "structure" or "cycle" or "specific" or "clarity" or "wording"') && html.includes('"en": "the same suggestion in English"'), 'prompt: suggestion objects with en + kind');
for (const u of ['https://books.google.com/books?vid=ISBN9780333777954', 'https://books.google.com/books?vid=ISBN1853380717', 'https://books.google.com/books?vid=ISBN0132952610', 'https://digital.gov/guides/plain-language']) assert.ok(html.includes(u), 'reference link present: ' + u);
assert.ok(html.includes('const sugOf = x => (x && typeof x === \'object\')'), 'string or object suggestions');
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
            const q = s => document.querySelector(s);
            const draft = () => getReflectiveQuillContent().plain;
            const chip = () => q('#rr-tip-chip');
            const headRow = () => chip() && chip().parentElement && /Writing suggestions/.test(chip().parentElement.textContent);
            const analysis = (sug, changes) => JSON.stringify({ grade: 'พอใช้', issues: [{ issue: 'x', severity: 'low' }], suggestions: sug, improved: 'ok', changes });
            const CH = [{ from: 'ทำงานได้ครบกระบวนการทั้งหมดโดยยังไม่ต้องถาม', to: 'ปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง', reason: 'ชัดขึ้น' }];
            const out = {};
            // 1. object suggestions, English reply: tip (en) + example + reference by kind
            document.getElementById('ai-lang-review').value = 'English';
            setReflectiveQuillText('Thank you for being honest.');
            renderGrammarAnalysis(analysis([{ text: 'ระบุให้ชัดว่าต้องการทำงานส่วนใดให้ครบด้วยตนเอง', en: 'Say which steps you can already handle on your own.', kind: 'structure' }, { text: 'อีกข้อ', en: 'Another', kind: 'clarity' }], CH), ORIG);
            out.chip0 = [!!chip(), chip() && chip().textContent.trim(), headRow(), chip() && chip().disabled];
            out.card = [...document.querySelectorAll('#reflective-grammar-content div')].map(d => d.textContent.trim()).filter(t => t === 'ระบุให้ชัดว่าต้องการทำงานส่วนใดให้ครบด้วยตนเอง').length;
            chip().click();
            out.draft1 = draft();
            out.chip1 = [chip().textContent.trim(), chip().disabled];
            out.status1 = q('#reflective-review-ai-status').textContent.trim();
            chip().click();   // disabled → nothing
            out.draft1b = draft();
            renderGrammarAnalysis(analysis([{ text: 'ระบุให้ชัดว่าต้องการทำงานส่วนใดให้ครบด้วยตนเอง', en: 'Say which steps you can already handle on your own.', kind: 'structure' }], CH), ORIG);
            out.chipAfterRerender = chip().textContent.trim();
            // 2. another log, Thai reply, string suggestions (older answers), no changes → Thai tip only, no example, no reference
            reflectiveLogsCache.push({ id: 'r2', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: { toDate: () => new Date(2026, 9, 21, 18, 6) }, content: 'เรียนรู้การอ่านฉลากยา' });
            await reviewReflective('r2'); await new Promise(res => setTimeout(res, 300));
            document.getElementById('ai-lang-review').value = 'Thai';
            setReflectiveQuillText('');
            renderGrammarAnalysis(analysis(['เพิ่มรายละเอียดของเคสที่พบ'], []), 'เรียนรู้การอ่านฉลากยา');
            out.chip2 = [chip().textContent.trim(), chip().disabled, [...document.querySelectorAll('#reflective-grammar-content div')].some(d => d.textContent.trim() === 'เพิ่มรายละเอียดของเคสที่พบ')];
            chip().click();
            out.draft2 = draft(); out.status2 = q('#reflective-review-ai-status').textContent.trim();
            // 3. unknown kind → tip + example, no reference line
            reflectiveLogsCache.push({ id: 'r3', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: { toDate: () => new Date(2026, 9, 20, 18, 6) }, content: 'x' });
            await reviewReflective('r3'); await new Promise(res => setTimeout(res, 300));
            document.getElementById('ai-lang-review').value = 'English';
            setReflectiveQuillText('Hi.');
            renderGrammarAnalysis(analysis([{ text: 'ท', en: 'Be specific.', kind: 'poetry' }], CH), 'x');
            chip().click();
            out.draft3 = draft();
            return out;
        });
        assert.deepEqual(r.chip0, [true, '➕ Add tip to reply', true, false], 'the chip sits on the Writing suggestions heading: ' + JSON.stringify(r.chip0));
        assert.equal(r.card, 1, 'object suggestions render their text');
        assert.equal(r.draft1, 'Thank you for being honest.\n\n✍️ Writing tip: Say which steps you can already handle on your own.\nFor example: “ทำงานได้ครบกระบวนการทั้งหมดโดยยังไม่ต้องถาม” → “ปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง”\nNext time try What? · So what? · Now what? (Rolfe, Freshwater & Jasper, 2001) · https://books.google.com/books?vid=ISBN9780333777954', 'English reply: en tip + example + structure reference: ' + JSON.stringify(r.draft1));
        assert.deepEqual(r.chip1, ['✓ Added to reply', true], 'chip turns ✓ and disables');
        assert.equal(r.status1, '✍️ Writing tip added · ref: Rolfe, Freshwater & Jasper, 2001');
        assert.equal(r.draft1b, r.draft1, 'a second click adds nothing');
        assert.equal(r.chipAfterRerender, '✓ Added to reply', 'a re-render (Apply etc.) keeps the ✓');
        assert.deepEqual(r.chip2, ['➕ Add tip to reply', false, true], 'another log: fresh chip; string suggestions still render');
        assert.equal(r.draft2, '✍️ คำแนะนำการเขียน: เพิ่มรายละเอียดของเคสที่พบ', 'Thai reply, string suggestion, no changes: the Thai tip alone');
        assert.equal(r.status2, '✍️ Writing tip added');
        assert.equal(r.draft3, 'Hi.\n\n✍️ Writing tip: Be specific.\nFor example: “ทำงานได้ครบกระบวนการทั้งหมดโดยยังไม่ต้องถาม” → “ปฏิบัติงานได้ครบทุกขั้นตอนด้วยตนเอง”', 'unknown kind: tip + example, no reference');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Reflective Review ➕ Add tip to reply — first suggestion in the reply language + example edit + reference by kind (checked links), once per log, string suggestions still work, unknown kind = no reference');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
