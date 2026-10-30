// V102.224 — ✨ in the "Read first" box: AI drafts the page read before the timer. The CORRECT ANSWER IS NEVER SENT. The REAL _qPrimerDraft + _qImproveCtx + the box markup from public/admin.html.
const fs = require('fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
const grab = marker => { const i = admin.indexOf(marker); assert.ok(i >= 0, marker); let d = 0, k = admin.indexOf('{', admin.indexOf(')', i)); for (; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}' && --d === 0) break; } return admin.slice(i, k + 1); };
const fns = [grab('window._qImproveCtx = function'), grab('window._qPrimerDraft = async function'), grab('window._qImproveShowPanel = function'), grab('window._qImproveActionBar = function'), grab('window._qImproveRemovePanel = function'), grab('window._qPrimerModelSelect = function'), grab('window._qPrimerTermsInstead = function'), grab('window._qPrimerDraftAll = async function')].join(';\n');
const boxStart = admin.indexOf('<div class="q-primer-row"'), box = admin.slice(boxStart, admin.indexOf('</div>', admin.indexOf('</textarea>', boxStart)) + 6).replace(/\$\{data && data\.primer \? String\(data\.primer\)\.replace\(\/<\/g, '&lt;'\) : ''\}/, '');
assert.ok(box.includes('${window._qPrimerModelSelect()}'), 'the model input sits in the label row, before the icon buttons (V102.509: a hidden input the vendor-first rail binds to)');
assert.ok(box.includes("_qPrimerDraft(this, 'full')") && !box.includes("'terms'") && !box.includes('_qPrimerDraftAll(this)') && box.includes('_qPrimerReviewAll()'), 'V102.522 (owner, option 1): the row keeps ✨ and 📖 All only — ☰ moved into the panel after a draft, ✨ All into the popup');
assert.equal((box.match(/class="q-primer-ai/g) || []).length, 2, 'exactly two row buttons');
assert.ok(/aria-label="Draft Read first with AI">✨</.test(box) && /The correct answer is NOT sent/.test(box), '✨ with an accessible name + the promise in the hover');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://primer.test/', r => r.fulfill({ body: '<meta charset="utf-8"><body></body>', contentType: 'text/html' })); await page.goto('https://primer.test/');   // a real origin: the select remembers its pick in localStorage
        const r = await page.evaluate(async ([fns, box]) => {
            const out = { prompts: [], models: [], toasts: [], feats: [] };
            window.showToast = m => out.toasts.push(m); window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            window.safeJsonParse = JSON.parse; window._qImproveModel = () => 'claude-sonnet-5-5';
            window.TEXT_AI_MODELS = [{ id: 'gpt-6-luna', short: 'Luna 6' }, { id: 'claude-sonnet-5-5', short: 'Sonnet 5.5' }, { id: 'gpt-6.1-sol', short: 'Sol 6' }];
            window.normalizeTextAIModel = v => window.TEXT_AI_MODELS.some(m => m.id === v) ? v : 'gpt-6-luna';
            localStorage.clear();
            const tb = document.createElement('input'); tb.id = 'toolbar-ai-translate-model'; tb.value = 'gpt-6.1-sol'; tb.type = 'hidden';
            let reply;
            window.callUniversalAI = async (model, prompt, isJson, a, key, opts) => { out.prompts.push(prompt); out.models.push(model); out.feats.push(opts && opts.feature); if (reply instanceof Error) throw reply; return { text: JSON.stringify(reply) }; };
            document.body.innerHTML = '<div class="quiz-q-item"><textarea class="q-text">Which drug is a LABA?</textarea>' +
                ['Ipratropium', 'Salmeterol', 'Salbutamol'].map((t, i) => '<input class="q-opt" value="' + t + '"><input type="checkbox" class="q-correct-check" value="' + i + '"' + (i === 1 ? ' checked' : '') + '>').join('') +
                box + '<div class="options-actions"></div></div>'; document.body.append(tb);
            new Function('let _qPrimerAllRunning = false, _qPrimerAllStop = false; ' + fns + '; window._qPrimerDraft = window._qPrimerDraft; window._qPrimerModelSelect = window._qPrimerModelSelect; window._qPrimerDraftAll = window._qPrimerDraftAll;').call(window);
            document.querySelector('.quiz-q-item').outerHTML = document.querySelector('.quiz-q-item').outerHTML.replace('${window._qPrimerModelSelect()}', window._qPrimerModelSelect());
            const mi0 = document.querySelector('.q-primer-model'); out.inputKind = mi0.tagName + '/' + mi0.type + '/' + (mi0.id.startsWith('q-primer-model-') ? 'id' : 'noid'); out.firstPick = mi0.value;
            const item = document.querySelector('.quiz-q-item'), ta = item.querySelector('.q-primer'), [full] = item.querySelectorAll('.q-primer-ai');
            window._qPrimerLastFill = new WeakMap();
            // 0) the select defaults to the toolbar model; picking another one is what the draft uses (and is remembered)
            const sel = item.querySelector('.q-primer-model'); sel.value = 'claude-sonnet-5-5'; sel.dispatchEvent(new Event('change'));
            out.remembered = localStorage.getItem('ai_primer_model');
            // 1) empty box → filled, nothing about the answer was sent
            reply = { primer: '**LABA** = long-acting beta-agonist (≥12 h).\n\n- **LAMA** — long-acting muscarinic antagonist' };
            await window._qPrimerDraft(full, 'full');
            out.filled = ta.value; out.btnBack = full.innerHTML === '✨' && !full.disabled; out.draftToast = out.toasts[out.toasts.length - 1];
            // 1b) V102.522: the fill comes with a light panel offering ☰ Terms only instead — it empties the box ✨ just filled and drafts the glossary straight in
            const chip = item.querySelector('.q-improve-panel .q-primer-terms-instead'); out.termsChip = [!!chip, (item.querySelector('.q-improve-panel strong') || {}).textContent];
            reply = { primer: '- **LABA** — long-acting beta-agonist' }; chip.click(); await new Promise(r => setTimeout(r, 30));
            out.termsFilled = [ta.value, !!item.querySelector('.q-improve-panel .q-primer-terms-instead')];
            // 2) the correct option named verbatim → flagged
            ta.value = ''; reply = { primer: 'Salmeterol is the example everyone knows.' };
            await window._qPrimerDraft(full, 'full'); out.leakToast = out.toasts[out.toasts.length - 1]; out.leakFilled = ta.value;
            // 3) a filled box → panel, field untouched until ✓
            ta.value = 'My own text'; reply = { primer: 'New draft text' };
            await window._qPrimerDraft(full, 'full');
            out.panel = !!item.querySelector('.q-improve-panel'); out.untouched = ta.value; out.panelChip = !!item.querySelector('.q-improve-panel .q-primer-terms-instead');
            item.querySelector('.q-improve-apply').click(); out.applied = ta.value; out.panelGone = !item.querySelector('.q-improve-panel');
            // 4) failure → toast, button restored
            reply = new Error('boom'); await window._qPrimerDraft(full, 'full'); out.failToast = out.toasts[out.toasts.length - 1]; out.failBtn = full.innerHTML === '✨' && !full.disabled;
            // 5) no question → nothing sent
            item.querySelector('.q-text').value = ''; const n = out.prompts.length; await window._qPrimerDraft(full, 'full'); out.sentWithoutQuestion = out.prompts.length - n;
            // 6) V102.359 ✨ All: three more questions — two empty, one already filled, plus the one above with no text → only the two empty ones are sent, the filled one is untouched, one toast
            const mk = (q, primer) => { const d = document.createElement('div'); d.innerHTML = item.outerHTML; const it = d.firstElementChild; it.querySelector('.q-text').value = q; it.querySelector('.q-primer').value = primer; it.querySelector('.q-primer-model').value = 'claude-sonnet-5-5'; it.querySelectorAll('.q-improve-panel').forEach(p => p.remove()); return it; };   // outerHTML keeps the markup's first pick, not the live one
            const modal = document.createElement('div'); modal.id = 'quizManageModal'; modal.append(item, mk('What is a LAMA?', ''), mk('What is an ICS?', 'Already written'), mk('What is SABA?', '')); document.body.append(modal);
            reply = { primer: 'Background text' }; window.confirm = () => true;
            // V102.522: ✨ All is a button in the 📖 All popup (no Read first row around it) — the model comes from the first question's row
            const allBtn = document.createElement('button'); allBtn.className = 'pra-all'; allBtn.innerHTML = '✨ All'; document.body.append(allBtn); const n6 = out.prompts.length, t6 = out.toasts.length;
            await window._qPrimerDraftAll(allBtn);
            out.allSent = out.prompts.slice(n6).map(p => (p.match(/โจทย์: "([^"]+)"/) || [])[1]); out.allToasts = out.toasts.slice(t6);
            out.allValues = [...modal.querySelectorAll('.quiz-q-item')].map(it => it.querySelector('.q-primer').value); out.allBtnBack = allBtn.innerHTML === '✨ All';
            window.confirm = () => false; const n7 = out.prompts.length; modal.querySelectorAll('.quiz-q-item')[1].querySelector('.q-primer').value = ''; await window._qPrimerDraftAll(allBtn); out.allDeclined = out.prompts.length - n7;
            return out;
        }, [fns, box]);
        const [pFull, pTerms] = r.prompts;
        assert.ok(pFull.includes('Which drug is a LABA?') && ['Ipratropium', 'Salmeterol', 'Salbutamol'].every(o => pFull.includes(o)), 'the prompt carries the stem and every option');
        assert.ok(!/คำตอบที่ถูก|correct|ข้อ 2/.test(pFull.replace('ห้ามระบุ ห้ามบอกใบ้ หรือเปรียบเทียบว่าตัวเลือกใดถูก/ผิด', '')), 'NO answer key in the prompt (no "correct answer", no index of the ticked option)');
        assert.ok(/ไม่มีการระบุคำตอบ/.test(pFull) && /ห้ามเฉลย/.test(pFull), 'the prompt forbids giving the answer away');
        assert.ok(/อภิธานศัพท์/.test(pTerms) && !/ความรู้พื้นฐานที่ต้องมี/.test(pTerms), 'terms-only mode asks for the glossary only');
        assert.equal(r.inputKind, 'INPUT/hidden/id', 'V102.509: a hidden input with an id — the vendor-first rail binds to it on the real page'); assert.equal(r.firstPick, 'gpt-6.1-sol', 'first time the input follows the toolbar model'); assert.equal(r.remembered, 'claude-sonnet-5-5', 'a pick is remembered in this browser');
        assert.deepEqual([...new Set(r.models)], ['claude-sonnet-5-5'], 'the draft uses the model picked in the select'); assert.deepEqual([...new Set(r.feats)], ['question_primer']);
        assert.match(r.filled, /LABA/); assert.equal(r.btnBack, true); assert.match(r.draftToast, /^✨ Read first drafted · \d+ s$/, 'V102.514: the single draft says how long it took: ' + r.draftToast);
        assert.match(r.leakToast, /repeats a correct option/); assert.match(r.leakFilled, /Salmeterol/, 'still filled — the admin decides');
        assert.equal(r.panel, true); assert.equal(r.untouched, 'My own text', 'a filled box is not overwritten until ✓'); assert.equal(r.applied, 'New draft text'); assert.equal(r.panelGone, true);
        assert.deepEqual(r.termsChip, [true, '✨ Read first drafted · 1 s'], 'V102.522: a filled-in draft comes with a light panel + ☰ Terms only instead: ' + JSON.stringify(r.termsChip));
        assert.deepEqual(r.termsFilled, ['- **LABA** — long-acting beta-agonist', false], 'the chip empties the box ✨ just filled and the glossary goes straight in (no chip after a terms draft): ' + JSON.stringify(r.termsFilled));
        assert.equal(r.panelChip, true, 'the replace panel offers ☰ Terms only instead too');
        assert.match(r.failToast, /failed: boom/); assert.equal(r.failBtn, true); assert.equal(r.sentWithoutQuestion, 0, 'no question → nothing sent to the AI');
        assert.deepEqual(r.allSent, ['What is a LAMA?', 'What is SABA?'], '✨ All sends only the questions with text and no Read first: ' + JSON.stringify(r.allSent));
        assert.deepEqual(r.allValues, ['New draft text', 'Background text', 'Already written', 'Background text'], 'the two empty ones are filled, the written ones untouched (the first still holds step 3), the one with no text skipped');
        assert.equal(r.allToasts.length, 1, 'one toast for the whole run: ' + JSON.stringify(r.allToasts)); assert.match(r.allToasts[0], /^✨ Read first drafted for 2\/2 · \d+ s · save the quiz to keep them$/, 'V102.514: the toast carries the total time: ' + r.allToasts[0]); assert.equal(r.allBtnBack, true, 'the ✨ All button comes back');
        assert.equal(r.allDeclined, 0, 'Cancel on the confirm sends nothing');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Read first ✨ — drafts from stem + unmarked options only (no answer key), V102.522 two-button row with ☰ Terms only instead after a draft and ✨ All from the popup, leak flag, fills an empty box / asks before replacing, failure restores the button');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
