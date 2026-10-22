// V102.378 — Reflective Review PR 1 (owner's ideas 1 + 6): the reply language follows the text (Thai / English / Korean by script; an
// existing admin draft wins over the intern's reflection), the TH / EN / KO chip REWRITES the draft (at once when AI wrote it, after a
// confirm when the admin did), the ✨ AI Suggest button names the language it will reply in, and "Add a question" becomes the state
// "Has a question ✓" once the draft already ends with one. The REAL admin.html with fixture logs; AI and confirm stubbed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.match(html, /<title>Nika Admin \(V102\.(?:37[89]|3[89]\d|[4-9]\d\d)\)<\/title>/, 'admin V102.378+');

// static pins
assert.ok(!html.includes('draft feedback in Thai') && !html.includes('refined your Thai draft'), 'the suggest prompt / toast no longer hard-code Thai');
assert.ok(html.includes("rrSetReplyLang(rrGuessReplyLang((log.adminComment || '').trim() || log.content || ''))"), 'open: the reply language is seeded from the admin draft, else the reflection');
assert.ok(html.includes("window.quillReflective.on('text-change', function(delta, oldDelta, source) {") && html.includes("if (source === 'user' && typeof rrMarkDraftHandEdited === 'function') rrMarkDraftHandEdited();"), 'a keystroke marks the draft hand-edited');
assert.ok(html.includes("if (typeof rrPaintSuggestBtn === 'function') rrPaintSuggestBtn(btn);   // V102.378"), 'the language code comes back after a Suggest run');
assert.ok(html.includes('.reflective-rewrite-chip.rr-has-q:disabled { opacity:1; color:#15803d;'), 'the Has-a-question state keeps full colour');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reviewReflective === 'function' && typeof window.rrTranslateDraft === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(async () => {
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            const wait = ms => new Promise(res => setTimeout(res, ms));
            const q = s => document.querySelector(s);
            const TH = 'วันนี้ได้เรียนรู้การจ่ายยาให้คนไข้เบาหวาน และได้ฝึกอธิบายวิธีใช้ยาฉีดอินซูลิน';
            const EN = 'Today I learned how to counsel a diabetic patient on insulin pens and felt more confident.';
            const ts = { toDate: () => new Date(2026, 9, 22, 18, 6) };
            reflectiveLogsCache = [
                { id: 'r1', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: ts, content: TH },
                { id: 'r2', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: ts, content: EN },
                { id: 'r3', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: ts, content: TH, adminComment: 'Great reflection. Keep going!' }
            ];
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
            window.showToast = () => {};
            const state = () => ({ hidden: q('#ai-lang-review').value, chip: (q('.reflective-review-lang-chip.active') || {}).dataset.value, btn: q('#btn-ai-suggest').textContent.replace(/\s+/g, ' ').trim(), title: q('#btn-ai-suggest').title, draft: (window._rrDraft || null), text: q('#reflective-review-comment').value, status: q('#reflective-review-ai-status').textContent.trim() });
            const out = {};
            out.guess = ['สวัสดี', 'Hello there', '안녕하세요', '', 'Hello สวัสดีครับ ครับ', '!!! 123'].map(rrGuessReplyLang);

            await reviewReflective('r1'); await wait(200); out.openTh = state();
            await reviewReflective('r2'); await wait(200); out.openEn = state();
            await reviewReflective('r3'); await wait(200); out.openDraft = state();

            // hand-written draft → a switch asks first; Cancel keeps the text
            const calls = []; window.callUniversalAI = async (model, prompt) => { calls.push({ model, prompt }); return { text: '"สะท้อนได้ดีมาก ทำต่อไปนะคะ"' }; };
            let confirms = 0; window.confirm = () => { confirms++; return false; };
            selectReflectiveReviewLang(q('.reflective-review-lang-chip[data-value="Thai"]')); await wait(80);
            out.declined = Object.assign(state(), { confirms, calls: calls.length });
            // OK → translated, provenance = AI in Thai
            window.confirm = () => { confirms++; return true; };
            rrSetReplyLang('English');   // back to EN silently (no translation); the draft is still the admin's English text
            calls.length = 0;
            selectReflectiveReviewLang(q('.reflective-review-lang-chip[data-value="Thai"]')); await wait(80);
            out.translated = Object.assign(state(), { calls: calls.length, prompt: calls[0] && calls[0].prompt, chipsEnabled: [...document.querySelectorAll('.reflective-review-lang-chip')].every(c => !c.disabled) });
            // AI-written draft → the next switch translates at once, no confirm
            window.confirm = () => { throw new Error('confirm must not be asked for an AI draft'); };
            window.callUniversalAI = async (model, prompt) => { calls.push({ model, prompt }); return { text: '정말 잘 돌아보셨어요. 계속 이어가 보세요.' }; };
            calls.length = 0;
            selectReflectiveReviewLang(q('.reflective-review-lang-chip[data-value="Korean"]')); await wait(80);
            out.koAuto = Object.assign(state(), { calls: calls.length });
            // a failed translation keeps the text
            window.callUniversalAI = async () => { throw new Error('boom'); };
            selectReflectiveReviewLang(q('.reflective-review-lang-chip[data-value="English"]')); await wait(80);
            out.failed = state();
            // same chip again / silent set → no call
            calls.length = 0; window.callUniversalAI = async (m, p) => { calls.push(p); return { text: 'x' }; };
            selectReflectiveReviewLang(q('.reflective-review-lang-chip[data-value="English"]')); rrSetReplyLang('Thai'); await wait(50);
            out.noCall = [calls.length, state().hidden];

            // "Add a question" ↔ "Has a question ✓"
            const qchip = () => q('#reflective-rewrite-chips .reflective-rewrite-chip[data-intent="question"]');
            const qs = () => ({ disabled: qchip().disabled, has: qchip().classList.contains('rr-has-q'), label: qchip().querySelector('span').textContent, icon: qchip().querySelector('i').className });
            rrSetReplyLang('English');
            setReflectiveQuillText('Great work. What would you do differently next time?'); out.qEn = qs();
            rrSetReplyLang('Thai'); out.qTh = qs();
            setReflectiveQuillText('Great work today, keep it up.'); out.qNone = qs();
            setReflectiveQuillText('วันนี้ได้เรียนรู้อะไรบ้างคะ'); out.qThai = qs();
            setReflectiveQuillText('ทำได้ดีมากค่ะ 😊'); out.qThaiNo = qs();
            out.ends = ['Why?', 'อยากลองวิธีไหนครั้งหน้าคะ 😊', '어떻게 느꼈나요', 'Keep going.', 'ดีมากครับ', 'หรือไม่ ”',
                'สะท้อนได้ชัดเจนมากค่ะ ครั้งหน้าอยากลองอธิบายให้คนไข้แบบไหนเพิ่มเติมคะ', 'ลองดูนะคะ', 'จะลองวิธีไหนก็ได้ครับ', 'ทำได้ดีมากค่ะ'].map(rrDraftEndsWithQuestion);
            return out;
        });
        assert.deepEqual(r.guess, ['Thai', 'English', 'Korean', 'Thai', 'Thai', 'Thai'], 'rrGuessReplyLang by script, ties and nothing → Thai: ' + JSON.stringify(r.guess));
        assert.deepEqual([r.openTh.hidden, r.openTh.chip, /AI Suggest TH$/.test(r.openTh.btn), r.openTh.title], ['Thai', 'Thai', true, 'AI Suggest — reply in Thai (Ctrl/⌘ + /)'], 'a Thai reflection opens with TH + the button says TH: ' + JSON.stringify(r.openTh));
        assert.deepEqual([r.openEn.hidden, r.openEn.chip, /AI Suggest EN$/.test(r.openEn.btn)], ['English', 'English', true], 'an English reflection opens with EN: ' + JSON.stringify(r.openEn));
        assert.deepEqual([r.openDraft.hidden, r.openDraft.chip, r.openDraft.draft, r.openDraft.text], ['English', 'English', { lang: 'English', byAI: false }, 'Great reflection. Keep going!'], 'an existing admin draft wins and counts as hand-written: ' + JSON.stringify(r.openDraft));
        assert.deepEqual([r.declined.confirms, r.declined.calls, r.declined.hidden, r.declined.chip, r.declined.text], [1, 0, 'Thai', 'Thai', 'Great reflection. Keep going!'], 'hand-written + Cancel: language switches, no AI call, text kept: ' + JSON.stringify(r.declined));
        assert.match(r.declined.status, /Reply language: Thai · text unchanged/);
        assert.deepEqual([r.translated.calls, r.translated.text, r.translated.draft, r.translated.chipsEnabled], [1, 'สะท้อนได้ดีมาก ทำต่อไปนะคะ', { lang: 'Thai', byAI: true }, true], 'hand-written + OK: one AI call, text replaced, provenance = AI/Thai: ' + JSON.stringify(r.translated));
        assert.match(r.translated.prompt, /Output language MUST be: Thai/); assert.match(r.translated.prompt, /Great reflection\. Keep going!/);
        assert.match(r.translated.status, /Translated English → Thai/);
        assert.deepEqual([r.koAuto.calls, r.koAuto.text, r.koAuto.draft, r.koAuto.hidden], [1, '정말 잘 돌아보셨어요. 계속 이어가 보세요.', { lang: 'Korean', byAI: true }, 'Korean'], 'an AI draft translates at once (no confirm): ' + JSON.stringify(r.koAuto));
        assert.match(r.koAuto.status, /Translated Thai → Korean/); assert.match(r.koAuto.btn, /AI Suggest KO$/);
        assert.deepEqual([r.failed.text, r.failed.hidden], ['정말 잘 돌아보셨어요. 계속 이어가 보세요.', 'English'], 'a failed translation keeps the text (language still switched): ' + JSON.stringify(r.failed));
        assert.match(r.failed.status, /Translate failed: boom · text unchanged/);
        assert.deepEqual(r.noCall, [0, 'Thai'], 'the same chip again and a programmatic set never call AI');
        assert.deepEqual(r.qEn, { disabled: true, has: true, label: 'Has a question ✓', icon: 'fa-solid fa-circle-check' }, 'a draft ending in ? → the state chip (EN): ' + JSON.stringify(r.qEn));
        assert.deepEqual(r.qTh, { disabled: true, has: true, label: 'มีคำถามแล้ว ✓', icon: 'fa-solid fa-circle-check' }, 'the state follows the reply language: ' + JSON.stringify(r.qTh));
        assert.deepEqual(r.qNone, { disabled: false, has: false, label: 'เพิ่มคำถาม', icon: 'fa-solid fa-circle-question' }, 'no question → the normal chip comes back: ' + JSON.stringify(r.qNone));
        assert.deepEqual([r.qThai.has, r.qThaiNo.has], [true, false], 'Thai question ending (…อะไรบ้างคะ) vs a plain Thai sentence with an emoji');
        assert.deepEqual(r.ends, [true, true, true, false, false, true, true, false, false, false], 'rrDraftEndsWithQuestion: ? / Thai word + คะ + emoji / Korean 나요 / plain EN / plain TH / trailing quote / question word mid-clause + คะ / นะคะ statement / ก็ได้ statement / ค่ะ statement: ' + JSON.stringify(r.ends));
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        console.log('PASS: Reflective reply language — seeded from the text (admin draft first), chip switch translates (confirm when hand-written, at once when AI), ✨ button names the language, "Has a question ✓" state');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
