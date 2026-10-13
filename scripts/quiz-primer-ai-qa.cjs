// V102.224 — ✨ in the "Read first" box: AI drafts the page read before the timer. The CORRECT ANSWER IS NEVER SENT. The REAL _qPrimerDraft + _qImproveCtx + the box markup from public/admin.html.
const fs = require('fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const admin = fs.readFileSync('public/admin.html', 'utf8').replace(/\r/g, '');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(admin));
const grab = marker => { const i = admin.indexOf(marker); assert.ok(i >= 0, marker); let d = 0, k = admin.indexOf('{', admin.indexOf(')', i)); for (; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}' && --d === 0) break; } return admin.slice(i, k + 1); };
const fns = [grab('window._qImproveCtx = function'), grab('window._qPrimerDraft = async function'), grab('window._qImproveShowPanel = function'), grab('window._qImproveActionBar = function'), grab('window._qImproveRemovePanel = function')].join(';\n');
const boxStart = admin.indexOf('<div class="q-primer-row"'), box = admin.slice(boxStart, admin.indexOf('</div>', admin.indexOf('</textarea>', boxStart)) + 6).replace(/\$\{data && data\.primer \? String\(data\.primer\)\.replace\(\/<\/g, '&lt;'\) : ''\}/, '');
assert.ok(box.includes("_qPrimerDraft(this, 'full')") && box.includes("_qPrimerDraft(this, 'terms')"), 'two icon buttons in the Read first label row');
assert.ok(/aria-label="Draft Read first with AI">✨</.test(box) && /The correct answer is NOT sent/.test(box), '✨ with an accessible name + the promise in the hover');

(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.setContent('<meta charset="utf-8"><body></body>');
        const r = await page.evaluate(async ([fns, box]) => {
            const out = { prompts: [], models: [], toasts: [], feats: [] };
            window.showToast = m => out.toasts.push(m); window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
            window.safeJsonParse = JSON.parse; window._qImproveModel = () => 'claude-sonnet-5-5';
            let reply;
            window.callUniversalAI = async (model, prompt, isJson, a, key, opts) => { out.prompts.push(prompt); out.models.push(model); out.feats.push(opts && opts.feature); if (reply instanceof Error) throw reply; return { text: JSON.stringify(reply) }; };
            document.body.innerHTML = '<div class="quiz-q-item"><textarea class="q-text">Which drug is a LABA?</textarea>' +
                ['Ipratropium', 'Salmeterol', 'Salbutamol'].map((t, i) => '<input class="q-opt" value="' + t + '"><input type="checkbox" class="q-correct-check" value="' + i + '"' + (i === 1 ? ' checked' : '') + '>').join('') +
                box + '<div class="options-actions"></div></div>';
            new Function(fns + '; window._qPrimerDraft = window._qPrimerDraft;').call(window);
            const item = document.querySelector('.quiz-q-item'), ta = item.querySelector('.q-primer'), [full, terms] = item.querySelectorAll('.q-primer-ai');
            // 1) empty box → filled, nothing about the answer was sent
            reply = { primer: '**LABA** = long-acting beta-agonist (≥12 h).\n\n- **LAMA** — long-acting muscarinic antagonist' };
            await window._qPrimerDraft(full, 'full');
            out.filled = ta.value; out.btnBack = full.innerHTML === '✨' && !full.disabled;
            // 2) the correct option named verbatim → flagged
            ta.value = ''; reply = { primer: 'Salmeterol is the example everyone knows.' };
            await window._qPrimerDraft(full, 'full'); out.leakToast = out.toasts[out.toasts.length - 1]; out.leakFilled = ta.value;
            // 3) a filled box → panel, field untouched until ✓
            ta.value = 'My own text'; reply = { primer: 'New draft text' };
            await window._qPrimerDraft(terms, 'terms');
            out.panel = !!item.querySelector('.q-improve-panel'); out.untouched = ta.value;
            item.querySelector('.q-improve-apply').click(); out.applied = ta.value; out.panelGone = !item.querySelector('.q-improve-panel');
            // 4) failure → toast, button restored
            reply = new Error('boom'); await window._qPrimerDraft(full, 'full'); out.failToast = out.toasts[out.toasts.length - 1]; out.failBtn = full.innerHTML === '✨' && !full.disabled;
            // 5) no question → nothing sent
            item.querySelector('.q-text').value = ''; const n = out.prompts.length; await window._qPrimerDraft(full, 'full'); out.sentWithoutQuestion = out.prompts.length - n;
            return out;
        }, [fns, box]);
        const [pFull, , pTerms] = r.prompts;
        assert.ok(pFull.includes('Which drug is a LABA?') && ['Ipratropium', 'Salmeterol', 'Salbutamol'].every(o => pFull.includes(o)), 'the prompt carries the stem and every option');
        assert.ok(!/คำตอบที่ถูก|correct|ข้อ 2/.test(pFull.replace('ห้ามระบุ ห้ามบอกใบ้ หรือเปรียบเทียบว่าตัวเลือกใดถูก/ผิด', '')), 'NO answer key in the prompt (no "correct answer", no index of the ticked option)');
        assert.ok(/ไม่มีการระบุคำตอบ/.test(pFull) && /ห้ามเฉลย/.test(pFull), 'the prompt forbids giving the answer away');
        assert.ok(/อภิธานศัพท์/.test(pTerms) && !/ความรู้พื้นฐานที่ต้องมี/.test(pTerms), 'terms-only mode asks for the glossary only');
        assert.deepEqual([...new Set(r.models)], ['claude-sonnet-5-5'], 'uses the toolbar model'); assert.deepEqual([...new Set(r.feats)], ['question_primer']);
        assert.match(r.filled, /LABA/); assert.equal(r.btnBack, true);
        assert.match(r.leakToast, /repeats a correct option/); assert.match(r.leakFilled, /Salmeterol/, 'still filled — the admin decides');
        assert.equal(r.panel, true); assert.equal(r.untouched, 'My own text', 'a filled box is not overwritten until ✓'); assert.equal(r.applied, 'New draft text'); assert.equal(r.panelGone, true);
        assert.match(r.failToast, /failed: boom/); assert.equal(r.failBtn, true); assert.equal(r.sentWithoutQuestion, 0, 'no question → nothing sent to the AI');
        assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));
        console.log('PASS: Read first ✨ — drafts from stem + unmarked options only (no answer key), terms-only mode, leak flag, fills an empty box / asks before replacing, failure restores the button');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
