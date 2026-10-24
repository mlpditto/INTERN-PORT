// Admin ▸ Cases ▸ Review: the score modal runs a LOCAL-model (Ollama `ol/local`) check as it opens (public/case-review-ai.js).
// The real script + the real modal markup/CSS from admin.html in a page, callUniversalAI stubbed:
// findings render as icon rows (escaped), the suggested score pre-fills only an untouched field, a failure never blocks, a closed modal drops late answers,
// and the prompt carries the Note but never the intern's name or the HN.
//   node scripts/case-review-ai-qa.cjs
const fs = require('node:fs');
const assert = require('node:assert/strict');
const admin = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/case-review-ai.js', 'utf8');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

// static pins
assert.ok(/<script src="case-review-ai\.js\?v=V102\.\d+"><\/script>/.test(admin), 'admin.html loads case-review-ai.js');
assert.ok(/window\.caseReviewAi\.start\(caseItem\);[^\n]*\r?\n\s*forceShowModal\('caseReviewScoreModal'\);/.test(admin), 'the check starts as the modal opens');
assert.ok(/window\.caseReviewAi\.hide\(\);\r?\n\s*forceHideModal\('caseReviewScoreModal'\);/.test(admin), 'closing the modal cancels / clears the check');
assert.ok(admin.includes('<div id="case-review-ai" class="lang-no-toggle" hidden></div>'), 'findings container in the modal — lang-no-toggle, or lang-toggle.js hides every Thai finding / message (found live 2026-10-25)');
assert.ok(js.includes("const MODEL = 'ol/local'"), 'local model first');
const modal = admin.match(/<div id="caseReviewScoreModal"[\s\S]*?\n    <\/div>\r?\n/)[0];
const css = [...admin.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].slice(0, 2).map(m => m[1]).join('\n');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 700, height: 800 } });
    await page.goto(require('node:url').pathToFileURL(require('node:path').resolve('public/lang-toggle.js')).href);   // a real (file) origin so localStorage works for lang-toggle.js
    await page.evaluate(() => { localStorage.setItem('uiLangTH', '0'); localStorage.setItem('uiLangKR', '0'); });   // admin's default: EN only
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><style>.modal{display:flex!important;position:static!important}</style>${modal}`);
    await page.evaluate(() => {
        window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        window.syncCaseReviewScoreChips = () => {};
        window.setCaseReviewScoreValue = v => { document.getElementById('case-review-score-input').value = Number(v).toFixed(1); };
        window.calls = []; window.answer = null; window.hold = null;
        window.callUniversalAI = (model, prompt, isJson, v, k, opts) => { window.calls.push({ model, prompt, isJson, opts }); return window.hold ? window.hold.then(() => window.answer()) : Promise.resolve(window.answer()); };
    });
    await page.addScriptTag({ path: 'public/lang-toggle.js' });   // the real language toggle: it wraps + hides Thai runs outside .lang-no-toggle
    await page.addScriptTag({ content: js });
    const OK = { ask: ['ปวดสัมพันธ์มื้ออาหาร', '<img src=x onerror=window.pwned=1>'], ddx: ['GERD', 'Dyspepsia'], followUp: '2 สัปดาห์', meds: ['PPI', 'Antacid'], privacy: 'ทำงานเกี่ยวกับฮอนด้า', score: 0.2, scoreWhy: 'ครบ' };
    const CASE = { id: 'c1', displayName: 'Bew', caseId: '26955', note: '2. Case ช อายุ 40ปลายๆ ทำงานเกี่ยวกับฮอนด้า มีลมในท้องเยอะ เป็นมา 2-3 วัน', disease: 'GI', diseaseSystemLabel: 'GI / ระบบทางเดินอาหาร' };
    const run = async (opts = {}) => {
        await page.evaluate(({ ok, hold }) => {
            window.calls = []; window.pwned = 0;
            window.answer = ok === 'fail' ? () => { throw new Error('Ollama is not reachable'); } : () => ({ text: JSON.stringify(ok) });
            let release; window.release = null;
            window.hold = hold ? new Promise(r => { window.release = r; }) : null;
            const i = document.getElementById('case-review-score-input'); i.value = '0.0'; delete i.dataset.crTouched;
        }, { ok: opts.ok === undefined ? OK : opts.ok, hold: !!opts.hold });
    };

    // 1. success: rows, ✨ chip, pre-filled field, prompt hygiene, escaping
    await run();
    await page.evaluate(c => window.caseReviewAi.start(c), CASE);
    await page.waitForSelector('#case-review-ai .crai-f');
    assert.deepEqual(await page.$$eval('#case-review-ai .crai-f i', els => els.map(e => e.textContent)), ['❓', '🩺', '📅', '💊', '🔒']);
    assert.equal(await page.$eval('#case-review-ai .crai-f.bad', e => e.textContent.includes('ฮอนด้า')), true);
    assert.equal(await page.$eval('.case-score-chip[data-score="0.2"]', e => e.classList.contains('ai')), true, '✨ on the suggested chip');
    assert.equal(await page.$eval('#case-review-score-input', e => e.value), '0.2', 'untouched field pre-filled');
    assert.equal(await page.evaluate(() => window.pwned), 0, 'AI text is escaped');
    assert.equal(await page.$$eval('#case-review-ai img', e => e.length), 0);
    const call = await page.evaluate(() => window.calls[0]);
    assert.equal(call.model, 'ol/local'); assert.equal(call.isJson, true);
    assert.ok(call.prompt.includes('ทำงานเกี่ยวกับฮอนด้า') && call.prompt.includes('GI'), 'prompt carries Note + disease');
    assert.ok(!call.prompt.includes('Bew') && !call.prompt.includes('26955'), 'prompt never carries the name or the HN');

    // 1b. Thai findings must survive admin's lang-toggle.js (the container is .lang-no-toggle): shown as typed, not wrapped / hidden
    await page.waitForTimeout(250);
    assert.equal(await page.$$eval('#case-review-ai .lang-th', e => e.length), 0, 'no Thai run was wrapped (and hidden) by lang-toggle.js');
    assert.ok((await page.$eval('#case-review-ai', e => e.innerText)).includes('ปวดสัมพันธ์มื้ออาหาร'), 'the Thai finding is visible text');
    await page.evaluate(() => { document.getElementById('case-review-ai').classList.remove('lang-no-toggle'); const c = document.getElementById('case-review-ai'); const h = c.innerHTML; c.innerHTML = ''; c.innerHTML = h; });
    await page.waitForTimeout(250);
    assert.ok(await page.$$eval('#case-review-ai .lang-th', e => e.length) > 0, 'proof the guard matters: without .lang-no-toggle the Thai is wrapped (and hidden under an EN-only body)');
    await page.evaluate(() => document.getElementById('case-review-ai').classList.add('lang-no-toggle'));
    // 2. hide clears everything
    await page.evaluate(() => window.caseReviewAi.hide());
    assert.equal(await page.$eval('#case-review-ai', e => e.hidden && e.innerHTML === ''), true);
    assert.equal(await page.$$eval('.case-score-chip.ai', e => e.length), 0);

    // 3. a field the admin already typed is never overwritten
    await run();
    await page.evaluate(() => { const i = document.getElementById('case-review-score-input'); i.value = '0.5'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.evaluate(c => window.caseReviewAi.start(c), CASE);
    await page.waitForSelector('#case-review-ai .crai-f');
    assert.equal(await page.$eval('#case-review-score-input', e => e.value), '0.5', 'typed score kept');

    // 4. failure: short message + retry button, Save Score still there
    await page.evaluate(() => window.caseReviewAi.hide());
    await run({ ok: 'fail' });
    await page.evaluate(c => window.caseReviewAi.start(c), CASE);
    await page.waitForSelector('#case-review-ai .crai-msg:not(:has-text("กำลังตรวจ"))');
    assert.ok((await page.$eval('#case-review-ai .crai-msg', e => e.textContent)).includes('ใช้ไม่ได้'));
    assert.equal(await page.$$eval('#case-review-ai .lang-th', e => e.length), 0, 'the Thai failure message is not hidden');
    assert.equal(await page.$eval('#case-review-ai .crai-msg', e => e.title), 'Ollama is not reachable', 'full error in the tooltip');
    assert.equal(await page.$eval('#case-review-ai-btn', e => e.disabled), false, 'retry available');
    assert.equal(await page.$$eval('#caseReviewScoreModal button', b => b.some(x => /Save Score/.test(x.textContent))), true);
    await run();
    await page.click('#case-review-ai-btn');
    await page.waitForSelector('#case-review-ai .crai-f');

    // 5. closing while the model is still thinking: the late answer is dropped
    await page.evaluate(() => window.caseReviewAi.hide());
    await run({ hold: true });
    await page.evaluate(c => { window.caseReviewAi.start(c); }, CASE);   // not awaited: the held answer would never come back
    assert.ok((await page.$eval('#case-review-ai', e => e.textContent)).includes('กำลังตรวจ'));
    await page.evaluate(() => window.caseReviewAi.hide());
    await page.evaluate(() => window.release());
    await page.waitForTimeout(200);
    assert.equal(await page.$eval('#case-review-ai', e => e.hidden && e.innerHTML === ''), true, 'late answer ignored');
    assert.equal(await page.$eval('#case-review-score-input', e => e.value), '0.0');

    // 6. a too-short Note does not call the model
    await run();
    await page.evaluate(() => window.caseReviewAi.start({ id: 'c2', note: 'hi' }));
    assert.equal(await page.evaluate(() => window.calls.length), 0);

    await browser.close();
    console.log('PASS: Case Review — local-model check on open: icon rows (escaped), ✨ suggested chip pre-fills only an untouched field, no name/HN in the prompt, failure → retry without blocking Save, late answers dropped after close');
})().catch(e => { console.error(e); process.exit(1); });
