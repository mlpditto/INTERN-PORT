// V102.594 Case Card Studio · ❓ Ask next (owner picks 2026-11-06: 5+6 on the card in English, the AI drafts and the admin edits,
// a Thai Ask next page, exports 9:16 / PDF / 2 PNG). The REAL admin.html (every script, network blocked); callUniversalAI stubbed.
const assert = require('node:assert/strict');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const ADMIN = require('url').pathToFileURL(path.join(process.cwd(), 'public/admin.html')).href;
const DRAFT = {
    flags: [{ en: 'Severe pain not easing?', th: 'ปวด 9/10 ไม่ลด ท้องแข็ง?', then_en: 'Refer now', then_th: 'ส่งพบแพทย์ทันที' },
            { en: 'Could she be pregnant?', th: 'มีโอกาสตั้งครรภ์ไหม?', then_en: 'Send for a test', then_th: 'ส่งตรวจ' }],
    ask: [{ en: 'When did pain start?', th: 'เริ่มปวดเมื่อไหร่หลังกินยา' }, { en: 'Any drug allergy?', th: 'แพ้ยาอะไรไหม' }, { en: 'Talk to the patient?', th: 'ขอคุยกับผู้ป่วยโดยตรง' }],
    pins: [{ area: 'stomach', en: 'Where exactly? Cramping?', th: 'ปวดตรงไหน บิดหรือแสบ' }, { area: 'nowhere', en: 'Diarrhoea with blood?', th: 'ถ่ายเหลว มีมูกเลือด' }],
    advice: { en: 'Soft food, sip water, follow up in 24 h', th: 'อาหารอ่อน ดื่มน้ำบ่อย ๆ ติดตามใน 24 ชม.' }
};

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            const any = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
            window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : any, apply: () => any });
        });
        await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
        await page.goto(ADMIN, { waitUntil: 'load' });
        await page.waitForTimeout(1200);
        const setup = await page.evaluate(draft => {
            const m = document.getElementById('alabastaCaseCardModal'); m.style.setProperty('display', 'flex', 'important'); m.style.setProperty('z-index', '2147483647', 'important');
            window.__calls = []; window.__writes = [];
            window.callUniversalAI = async (model, prompt, isJson, a, b, opts) => { window.__calls.push({ model, prompt, isJson, opts }); return { text: JSON.stringify(draft) }; };
            window.db = { collection: () => ({ doc: () => ({ update: async v => { window.__writes.push(v); } }) }) };
            window.getAlabastaCaseById = () => ({ id: 'd1', caseId: '27442', disease: 'Nausea / abdominal pain', customer: 'นางสาว ลับมาก' });
            window.caseAskNext.setCase('d1');
            document.getElementById('alabasta-case-card-safe-summary').value = 'A relative asked for a 21-year-old woman with severe abdominal pain (9/10) and nausea after clindamycin and azithromycin.';
            document.getElementById('alabasta-case-card-prompt').value = 'BASE PROMPT';
            const f = document.getElementById('cs-ask');
            return { fold: !!f, after: f && f.previousElementSibling && f.previousElementSibling.id, model: !!document.getElementById('cs-ask-model'), exp: !!document.querySelector('.cs-ask-exp') };
        }, DRAFT);
        assert.deepEqual(setup, { fold: true, after: 'alabasta-case-card-step-2', model: true, exp: true }, 'the ❓ Ask next fold sits under ✎ Prompt with a model rail; export buttons beside PNG: ' + JSON.stringify(setup));
        await page.evaluate(() => { document.getElementById('cs-ask').open = true; });
        assert.equal(await page.locator('.cs-ask-oncard').isHidden(), true, '"On the card" only once there is a list');
        assert.equal(await page.$eval('.cs-ask-exp', e => e.hidden), true, 'no export before a list + an image');
        // the AI draft
        await page.click('.cs-ask-draft');
        await page.waitForFunction(() => document.querySelectorAll('.cs-ask-row').length > 0);
        const call = await page.evaluate(() => window.__calls[0]);
        assert.equal(call.isJson, true); assert.equal(call.opts.feature, 'case_card_ask');
        assert.ok(call.prompt.includes('21-year-old') && !call.prompt.includes('ลับมาก') && !call.prompt.includes('27442'), 'only the anonymized summary goes to the model');
        const rows = await page.$$eval('.cs-ask-row', rs => rs.map(r => r.dataset.k));
        assert.deepEqual(rows, ['flag', 'flag', 'ask', 'ask', 'ask', 'pin', 'pin', 'advice'], 'one row per item, flags first: ' + rows);
        assert.equal(await page.$eval('.cs-ask-row[data-k=pin][data-i="1"] select', s => s.value), 'stomach', 'an unknown body area falls back to a known one');
        assert.equal(await page.evaluate(() => document.getElementById('alabasta-case-card-prompt').value), 'BASE PROMPT', 'the prompt is untouched until "On the card" is ticked (nothing pre-picked)');
        // 5+6 on the card (English)
        await page.check('.cs-ask-oncard input');
        let p = await page.evaluate(() => document.getElementById('alabasta-case-card-prompt').value);
        assert.ok(p.startsWith('BASE PROMPT') && p.includes('### ASK NEXT ON THE CARD') && p.includes('at the stomach: "Where exactly? Cramping?"') && p.includes('titled "Refer if"') && p.includes('"Severe pain not easing? → Refer now"') && p.includes('titled "Ask next"') && p.includes('"Advice: Soft food'), 'pins + the Refer if / Ask next band, in English');
        assert.ok(!/[฀-๿]/.test(p.slice(p.indexOf('### ASK NEXT'))), 'no Thai in the image prompt (the AI garbles it)');
        // V102.597: a blank ＋🚩 row never reaches the card (it printed "→ Refer now" as a bullet)
        await page.click('.cs-ask-add [data-add=flag]');
        p = await page.evaluate(() => document.getElementById('alabasta-case-card-prompt').value);
        assert.ok(!p.includes('"" ') && !p.includes('"→') && p.split('→ Refer now').length === 2, 'the blank red flag is left out of the prompt');
        await page.click('.cs-ask-row[data-k=flag][data-i="2"] [data-x]');
        assert.ok((await page.$eval('.cs-ask-oncard', l => l.textContent)).includes('Show on the card: ❓ pins + Refer if · Ask next (English)'), 'the tick says what it does (no "5+6")');
        // edit a row → prompt follows; untick → section gone (only one copy ever)
        await page.fill('.cs-ask-row[data-k=ask][data-i="0"] input[data-f=en]', 'Pain started when?');
        p = await page.evaluate(() => document.getElementById('alabasta-case-card-prompt').value);
        assert.ok(p.includes('"Pain started when?"') && p.split('### ASK NEXT ON THE CARD').length === 2, 'an edit updates the one section');
        await page.uncheck('.cs-ask-oncard input');
        assert.equal(await page.evaluate(() => document.getElementById('alabasta-case-card-prompt').value), 'BASE PROMPT', 'untick = the section is removed');
        await page.waitForTimeout(900);
        const saved = await page.evaluate(() => window.__writes.slice(-1)[0]);
        assert.ok(saved && saved.caseAskNext && saved.caseAskNext.ask[0].en === 'Pain started when?' && saved.caseAskNext.onCard === false, 'the list is saved on the case');
        // remove a row
        await page.click('.cs-ask-row[data-k=flag][data-i="1"] [data-x]');
        assert.equal(await page.$$eval('.cs-ask-row[data-k=flag]', r => r.length), 1);
        // the page + exports once there is an image
        await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d'); g.fillStyle = '#fde68a'; g.fillRect(0, 0, 1024, 1024);
            document.getElementById('alabasta-case-card-image-download').setAttribute('href', c.toDataURL('image/png'));
        });
        await page.waitForTimeout(100);
        assert.equal(await page.$eval('.cs-ask-exp', e => e.hidden), false, 'export buttons show once there is a list and an image');
        const sizes = await page.evaluate(async () => {
            const sq = window.caseAskNext.drawPage(1080, 1080, '#27442'), tall = await window.caseAskNext.stack916();
            const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data).slice(0, 3).join(',');
            return { sq: [sq.width, sq.height], tall: [tall.width, tall.height], top: px(tall, 500, 500), bottom: px(tall, 5, 1900) };
        });
        assert.deepEqual(sizes.sq, [1080, 1080], 'the Ask next page is square (2-page PDF / album)');
        assert.deepEqual(sizes.tall, [1080, 1920], '9:16 = 1080 × 1920');
        assert.equal(sizes.top, '253,230,138', 'the card is on top'); assert.equal(sizes.bottom, '255,250,242', 'the Ask next page below');
        assert.deepEqual(errors.filter(e => /ask|case-card-ask/i.test(e)), [], 'no errors from case-card-ask-next.js');
        console.log('PASS: Ask next — fold under Prompt with a model rail, AI draft → editable rows (anonymized summary only), 5+6 English prompt section only when ticked (one copy, follows edits), saved on the case, Thai page 1080², 9:16 = card on top + page below');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
