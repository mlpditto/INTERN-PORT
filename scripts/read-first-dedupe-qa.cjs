// V102.698 (owner pick C, mockup-read-first-dedupe): 📖 Read first · ✨ rewrite the LATER notes so they do not repeat an earlier question.
// The REAL admin.html (file://, network blocked, Firebase = Proxy, callUniversalAI stubbed). Checks: the header chip counts the later
// questions (the first keeps a repeated term), one AI call per later question in order with its own model, the prompt carries the note,
// what earlier questions already explain, "never point to another question" and NO answer key; each card shows an inline diff (struck =
// cut, green = new) with ✕ / ✓ ใช้; ✓ writes the editor's note and the count drops; ✕ leaves it; a correct option in the new note is
// flagged; a second press stops; Jev's pairs add ✨ Qn for the later question; another quiz starts clean; no page errors.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const AM = '- **Antimotility agent** — ยาที่ลดการบีบตัวของลำไส้';
const INV = '- **Invasive infection** — การติดเชื้อที่เชื้อบุกเข้าเยื่อบุลำไส้';
const Q = [
  ['ห้ามใช้ loperamide ในผู้ป่วยรายใด', 'Loperamide ลดการบีบตัวของลำไส้\n\n' + AM + '\n' + INV],
  ['เด็กอายุ 2 ปีถ่ายเหลวมา 1 วัน', '**แก่นสำคัญ:** เด็กเล็กเสี่ยงขาดน้ำเร็ว\n\n' + AM],
  ['เด็กที่ได้รับ zinc ตามแนวทาง', '**แก่นที่ต้องรู้:** zinc ลดระยะเวลาท้องเสีย\n\n' + INV],
  ['ผู้ป่วยมาซื้อ activated charcoal', 'Activated charcoal จับยาในทางเดินอาหาร\n\n- **Adsorption** — การดูดซับ'],
  ['ผู้ป่วยถ่ายเหลวมาก มีไข้ และปวดท้อง', '**แก่นสำคัญ:** ท้องเสียหลังยาปฏิชีวนะ ร่วมกับไข้\n\n- **C. difficile** — เชื้อหลังยาปฏิชีวนะ'],
  ['ระหว่าง ward round แพทย์สั่ง Racecadotril', '- **Enkephalinase inhibitor** — ยับยั้งเอนไซม์'],
];
const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && typeof _qPrimerReviewAll === 'function' && !!window.praDedupe && document.readyState === 'complete'; } catch (_) { return false; } });
    await page.waitForTimeout(300);
    await page.addStyleTag({ content: '#adminGuideOverlay{display:none !important}' });
    const open = (qs) => page.evaluate((Q) => {
      window.showToast = () => {};
      document.getElementById('quizManageModal').style.display = 'block';
      const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
      Q.forEach(([q, p], i) => addQuestionUI({ q, type: 'choice', options: ['ตัวเลือกถูก ' + (i + 1), 'ตัวเลือกผิด'], correct: [0], primer: p }));
      document.querySelectorAll('.quiz-q-item')[0].style.display = 'block'; _qPrimerStrip();
      _qPrimerReviewAll();
    }, qs);
    await page.evaluate(() => {
      window.__calls = []; window.__delay = 0;
      // the rewrite: the shared term line goes, a term of its own comes in; Q5 (index 4) gets one that contains its correct option
      window.callUniversalAI = async (model, prompt) => {
        window.__calls.push({ model, prompt });
        if (window.__delay) await new Promise(r => setTimeout(r, window.__delay));
        const qn = (prompt.match(/โจทย์: "([^"]+)"/) || [])[1] || '';
        return { text: JSON.stringify({ primer: '**แก่นสำคัญ:** ใหม่ของ ' + qn + '\n\n- **Own term** — ของข้อนี้' + (/ไข้/.test(qn) ? '\nตัวเลือกถูก 5' : '') }) };
      };
    });
    await open(Q);
    const ov = page.locator('#praOverlay');

    // Q1 keeps both terms; Q2 (Antimotility), Q3 (Invasive) are later → 2. Q4–Q6 repeat nothing.
    assert.equal(await ov.locator('#pra-filters .pra-fix').textContent(), '✨ 2', 'the chip counts the later questions only');
    assert.match(await ov.locator('#pra-filters .pra-fix').getAttribute('title'), /^แก้ข้อหลัง 2 ข้อ — AI rewrites/, 'the words are in its title');
    // Jev adds Q4 ≈ Q5 → Q5 is later; its row gets ✨ Q5 and the header counts 3
    await page.evaluate(() => { window.adminApp = { functions: () => ({ httpsCallable: () => async () => ({ data: { enabled: true, compared: 15, repeats: [{ q: 4, term: 'แก่นสำคัญ:', otherQ: 3, otherTerm: 'Adsorption', score: 0.66 }] } }) }) }; });
    await ov.locator('#pra-jev-btn').click();
    await page.waitForSelector('#pra-jev .jpr-fix');
    assert.equal(await ov.locator('#pra-jev .jpr-fix').textContent(), '✨ Q5', 'Jev row: ✨ for the later question of the pair');
    assert.equal(await ov.locator('#pra-filters .pra-fix').textContent(), '✨ 3', 'Jev pairs join the count');

    // run all: one call per later question, in order, with that question's model
    await page.evaluate(() => { document.querySelectorAll('.quiz-q-item')[2].querySelector('.q-primer-model').value = 'claude-haiku-5-5'; });
    await ov.locator('#pra-filters .pra-fix').click();
    await page.waitForFunction(() => !document.querySelector('#praOverlay .pra-fix.run') && window.__calls.length === 3);
    const calls = await page.evaluate(() => window.__calls);
    assert.deepEqual(calls.map(c => (c.prompt.match(/โจทย์: "([^"]+)"/) || [])[1]), [Q[1][0], Q[2][0], Q[4][0]], 'Q2, Q3, Q5 in order');
    assert.equal(calls[1].model, 'claude-haiku-5-5', 'a question with its own model uses it');
    for (const c of calls) {
      assert.match(c.prompt, /ห้ามอ้างถึงข้ออื่น/, 'never point to another question (the quiz shuffles)');
      assert.match(c.prompt, /ไม่มีการระบุคำตอบ/); assert.doesNotMatch(c.prompt, /คำตอบที่ถูก:/, 'no answer key goes out');
    }
    assert.match(calls[0].prompt, /Antimotility agent/); assert.match(calls[0].prompt, /Loperamide ลดการบีบตัวของลำไส้/, 'what Q1 already explains goes along');
    assert.match(calls[2].prompt, /Activated charcoal/, 'Jev pair: the earlier note (Q4) goes along');

    // inline diff on each later card; Q1 and Q4 have none
    const diff = await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.querySelector('.pfx') ? { del: [...c.querySelectorAll('.pfx-del')].map(x => x.textContent), add: [...c.querySelectorAll('.pfx-add')].length, leak: !!c.querySelector('.pfx-leak') } : null));
    assert.equal(diff[0], null); assert.equal(diff[3], null); assert.equal(diff[5], null);
    assert.ok(diff[1].del.some(t => /Antimotility agent/.test(t)) && diff[1].add > 0, 'Q2: the repeated line is struck, new lines green: ' + JSON.stringify(diff[1]));
    assert.equal(diff[1].leak, false); assert.equal(diff[4].leak, true, 'Q5: a correct option in the new note is flagged');
    assert.equal(await ov.locator('.pra-card[data-q="1"] .pfx-del').first().evaluate(e => getComputedStyle(e).textDecorationLine), 'line-through');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[1].querySelector('.q-primer').value.includes('Antimotility')), true, 'nothing changes before ✓');

    // ✓ ใช้ on Q2 → the editor's note is the new one, the card box too; the count drops
    await ov.locator('.pra-card[data-q="1"] .pfx-use').click();
    const q2 = await page.evaluate(() => [document.querySelectorAll('.quiz-q-item')[1].querySelector('.q-primer').value, document.querySelector('#praOverlay .pra-card[data-q="1"] .pra-ta').value]);
    assert.ok(q2[0].startsWith('**แก่นสำคัญ:** ใหม่ของ') && q2[0] === q2[1], 'Q2 note replaced, in the editor and the card');
    assert.equal(await ov.locator('.pra-card[data-q="1"] .pfx').count(), 0);
    assert.equal(await ov.locator('#pra-filters .pra-fix').textContent(), '✨ 2', 'Q2 no longer repeats: 3 → 2');
    // ✕ on Q3 → unchanged
    await ov.locator('.pra-card[data-q="2"] .pfx-no').click();
    assert.equal(await ov.locator('.pra-card[data-q="2"] .pfx').count(), 0);
    assert.ok(await page.evaluate(() => document.querySelectorAll('.quiz-q-item')[2].querySelector('.q-primer').value.includes('Invasive infection')), '✕ keeps the old note');
    // a waiting suggestion survives a full re-render of the window
    await page.evaluate(() => _qPrimerReviewAll());
    assert.equal(await ov.locator('.pra-card[data-q="4"] .pfx').count(), 1, 'Q5 still waits for ✓ after a re-render');

    // a second press stops after the current question
    await page.evaluate(() => { window.__calls = []; window.__delay = 400; window.praDedupe._S.prop = {}; });
    await ov.locator('#pra-filters .pra-fix').click();
    await page.waitForSelector('#praOverlay .pra-fix.run');
    assert.match(await ov.locator('#pra-filters .pra-fix').textContent(), /^■ 0:0\d$/, 'running: ■ m:ss');
    await ov.locator('#pra-filters .pra-fix').click();
    await page.waitForFunction(() => !document.querySelector('#praOverlay .pra-fix.run'));
    assert.equal(await page.evaluate(() => window.__calls.length), 1, 'stopped after one');

    // another quiz starts clean (no old suggestions, no old Jev pairs)
    await page.evaluate(() => { document.getElementById('edit-quiz-id').value = 'other-quiz'; window.__delay = 0; });
    await open(Q.slice(0, 4));
    assert.equal(await ov.locator('.pfx').count(), 0); assert.equal(await ov.locator('#pra-filters .pra-fix').textContent(), '✨ 2');
    // nothing repeated → no chip
    await open([Q[3], Q[4]]);
    assert.equal(await ov.locator('#pra-filters .pra-fix').count(), 0, 'no repeats → no ✨ chip');
    assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
    console.log('read-first-dedupe-qa: PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
