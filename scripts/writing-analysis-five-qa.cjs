// V102.645 (owner: Writing Analysis mockup, "all five" — #1 #3 #4 #5 #7). Reflective Review · Writing Analysis card, the REAL admin.html
// with a fixture log + fixture analyses and the real render / try / reset / retry handlers:
//  #1 the grade pill is never an empty oval: a real Thai grade stays readable in EN mode (the language toggle used to hide it), and a grade
//     of invisible Unicode (U+3164) or no grade draws NO pill
//  #3 severity pills carry an icon: 🔴 High · 🟠 Med · ⚪ Low, sorted high → low
//  #4 💬＋ Tip (into the reply to the intern) vs ✏ Try / ✏ Try all (admin preview only) — names in aria-label, the "not changed" promise in title
//  #5 the first ✏ Try brings the preview into view with a green ring for ~1.5 s; not on the second Try; again after Reset
//  #7 a new run over a result on screen: the earlier result fades under "⏳ <model> reading…", cleared when the run ends (success and failure)
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');

(async () => {
    const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 1600 } });
        const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker/.test(e.message)) errs.push(e.message); });
        await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' }); return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
        await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
        await page.goto('file:///' + PUB + '/admin.html');
        await page.waitForFunction(() => typeof window.reviewReflective === 'function' && typeof window.renderGrammarAnalysis === 'function' && typeof window.rrGaLoading === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
        await page.waitForTimeout(300);
        const r = await page.evaluate(async () => {
            const wait = ms => new Promise(res => setTimeout(res, ms));
            const g = document.getElementById('adminGuideOverlay'); if (g) g.remove();
            const ORIG = 'Learned: การจ่ายยาปฏิชีวนะอย่างสมเหตุสมผล วันนี่ได้เจอเคส frenfried hunter';
            reflectiveLogsCache = [{ id: 'r1', userId: 'U1', userName: 'NATT', mood: 'happy', timestamp: { toDate: () => new Date(2026, 10, 7, 18, 6) }, content: ORIG }];
            window.db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: false }), update: async () => {} }), where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }), get: async () => ({ docs: [] }) }) };
            await reviewReflective('r1');
            await wait(300);
            const raw = grade => JSON.stringify({ grade, issues: [{ issue: 'คำว่า “วันนี่” สะกดผิด', severity: 'low' }, { issue: 'ความหมายเปลี่ยนเพราะเรียงคำผิด', severity: 'high' }, { issue: 'คำว่า “frenfried hunter” ไม่ชัดเจน', severity: 'medium' }],
                suggestions: [{ text: 'แบ่งเนื้อหาเป็นสิ่งที่ได้เรียนรู้กับเหตุการณ์ระหว่างฝึกงาน', en: 'Split what you learned from what happened', kind: 'structure' }], improved: 'สิ่งที่ได้เรียนรู้: การจ่ายยาปฏิชีวนะอย่างสมเหตุสมผล วันนี้ได้เจอเคส',
                changes: [{ from: 'Learned:', to: 'สิ่งที่ได้เรียนรู้:', reason: 'ใช้หัวข้อภาษาไทยให้สอดคล้องกับเนื้อหา' }, { from: 'วันนี่', to: 'วันนี้', reason: 'แก้คำสะกดผิด' }] });
            const card = document.getElementById('reflective-grammar-card'), content = document.getElementById('reflective-grammar-content'), badge = document.getElementById('reflective-grammar-score');
            const show = grade => { const RAW = raw(grade); window._reflectiveGrammarCache = { r1: { rawText: RAW, originalText: ORIG } }; renderGrammarAnalysis(RAW, ORIG); };
            const out = {};

            // #1
            show('ㅤ'); out.invisible = { text: badge.textContent, display: getComputedStyle(badge).display, style: badge.getAttribute('style') || '' };
            show('​ ️'); out.invisible2 = { text: badge.textContent, display: getComputedStyle(badge).display };
            show('ดี'); out.good = { text: badge.textContent, display: getComputedStyle(badge).display, bg: getComputedStyle(badge).backgroundColor };
            await wait(700);   // the language toggle sweeps new Thai text after a beat — it wrapped the grade in a hidden .lang-th span (an empty pill in EN mode)
            out.goodLater = { html: badge.innerHTML, width: Math.round(badge.getBoundingClientRect().width), noToggle: badge.classList.contains('lang-no-toggle') };
            const noGrade = JSON.stringify({ issues: [], suggestions: [], changes: [] }); window._reflectiveGrammarCache = { r1: { rawText: noGrade, originalText: ORIG } }; renderGrammarAnalysis(noGrade, ORIG);
            out.missing = { text: badge.textContent, display: getComputedStyle(badge).display, body: content.textContent.trim().slice(0, 20) };

            // #3 + #4
            show('พอใช้');
            out.sev = [...content.querySelectorAll('span')].map(sp => sp.textContent.trim()).filter(t => /^(🔴|🟠|⚪) (High|Med|Low)$/.test(t));
            const btn = b => ({ text: b.textContent.trim(), aria: b.getAttribute('aria-label') || '', title: b.title });
            out.buttons = [...content.querySelectorAll('button')].map(btn);
            out.cardShown = getComputedStyle(card).display !== 'none';

            // #5
            let scrolls = 0; const realScroll = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = function () { if (this.id === 'rr-ga-preview') scrolls++; };
            const pv = () => { const p = document.getElementById('rr-ga-preview'); return p ? { flash: p.classList.contains('rr-ga-flash'), text: (p.textContent.match(/\d \/ \d tried/) || [])[0] || '' } : null; };
            out.pvBefore = pv();
            grammarApplyChange(0); await wait(400);
            out.pv1 = pv(); out.pv1shadow = getComputedStyle(document.getElementById('rr-ga-preview')).boxShadow; out.scroll1 = scrolls;
            out.buttons1 = [...content.querySelectorAll('button')].map(b => b.textContent.trim());
            await wait(1500); out.pv1later = pv();
            grammarApplyChange(1); await wait(100);
            out.pv2 = pv(); out.scroll2 = scrolls; out.buttons2 = [...content.querySelectorAll('button')].map(b => b.textContent.trim());
            grammarResetSandbox(); await wait(60); out.pvReset = pv();
            window.__toasts = []; const realToast = window.showToast; window.showToast = m => { window.__toasts.push(String(m)); };
            grammarApplyAll(); await wait(100);
            out.pvAll = pv(); out.scroll3 = scrolls; out.toast = window.__toasts.slice();
            window.showToast = realToast; Element.prototype.scrollIntoView = realScroll;

            // #7 — helper on a drawn card, then the real retry path with a slow model, then a failing one
            const stale = () => ({ line: (document.getElementById('rr-ga-wait') || {}).textContent || '', opacity: getComputedStyle(content).opacity, events: getComputedStyle(content).pointerEvents, lineAboveContent: !!(document.getElementById('rr-ga-wait') && document.getElementById('rr-ga-wait').nextElementSibling === content) });
            rrGaLoading(true, 'gemini-3.8-flash'); out.load = stale();
            rrGaLoading(true, 'claude-sonnet-5-5'); out.loadTwice = { lines: document.querySelectorAll('#rr-ga-wait').length, line: document.getElementById('rr-ga-wait').textContent };
            rrGaLoading(false); out.loadOff = stale();
            const keep = content.innerHTML; content.innerHTML = ''; rrGaLoading(true, 'gemini-3.8-flash'); out.loadEmpty = stale(); content.innerHTML = keep;
            card.style.display = 'none'; rrGaLoading(true, 'gemini-3.8-flash'); out.loadHidden = stale(); card.style.display = '';

            try { localStorage.setItem('ai_grammar_off', '0'); } catch (_) { /* storage blocked */ }
            document.getElementById('reflective-review-uid').value = '';   // no uid → the opt-out lookup answers at once (the helpers are module-scoped, so they cannot be stubbed)
            document.getElementById('ai-model-grammar').value = 'gemini-3.8-flash';
            let release, fail; const realAI = window.callUniversalAI;
            window.callUniversalAI = () => new Promise((res, rej) => { release = res; fail = rej; });
            const run = runGrammarOnly(null, true);   // true = skip the Jev guardrail call (network)
            for (let i = 0; i < 40 && !release; i++) await wait(25);
            out.runStarted = !!release; out.during = stale(); out.duringOld = /คำว่า “วันนี่” สะกดผิด/.test(content.textContent);
            release({ text: JSON.stringify({ grade: 'ดี', issues: [{ issue: 'ผลใหม่', severity: 'low' }], suggestions: [], changes: [] }) }); await run; await wait(50);
            out.afterRun = stale(); out.afterText = /ผลใหม่/.test(content.textContent); out.afterBadge = badge.textContent;
            release = null; const run2 = runGrammarOnly(null, true);
            for (let i = 0; i < 40 && !release; i++) await wait(25);
            out.during2 = stale(); fail(new Error('boom')); await run2; await wait(50);
            out.afterFail = stale(); out.failText = /Grammar check unavailable: boom/.test(content.textContent);
            window.callUniversalAI = realAI;
            return out;
        });

        // #1
        assert.deepEqual([r.invisible.text, r.invisible.display], ['', 'none'], '#1 a U+3164 grade draws no pill: ' + JSON.stringify(r.invisible));
        assert.equal(/background/.test(r.invisible.style), false, '#1 no pill colours left on the empty badge');
        assert.deepEqual([r.invisible2.text, r.invisible2.display], ['', 'none'], '#1 zero-width + variation selector too');
        assert.equal(r.good.text, 'ดี'); assert.notEqual(r.good.display, 'none', '#1 a real grade still shows'); assert.equal(r.good.bg, 'rgb(240, 253, 244)', '#1 with its colour');
        assert.deepEqual([r.goodLater.html, r.goodLater.noToggle], ['ดี', true], '#1 the Thai grade stays readable in EN mode (not wrapped in a hidden .lang-th span): ' + JSON.stringify(r.goodLater)); assert.ok(r.goodLater.width > 24, '#1 the pill has its text, not an empty oval: ' + r.goodLater.width);
        assert.deepEqual([r.missing.text, r.missing.display], ['', 'none'], '#1 no grade at all → no pill'); assert.match(r.missing.body, /^✅ Writing looks good/);
        // #3
        assert.deepEqual(r.sev, ['🔴 High', '🟠 Med', '⚪ Low'], '#3 severity pills carry icons, high → low: ' + JSON.stringify(r.sev));
        // #4
        assert.deepEqual(r.buttons.map(b => b.text), ['💬＋ Tip', '✏ Try all', '✏ Try', '✏ Try'], '#4 Tip vs Try: ' + JSON.stringify(r.buttons.map(b => b.text)));
        assert.deepEqual(r.buttons.map(b => b.aria), ['Add tip to reply', 'Try all changes', 'Try this change', 'Try this change'], '#4 every short button carries its name');
        assert.match(r.buttons[0].title, /^Tip → the reply to the intern/, '#4 the tip goes to the intern');
        for (const b of r.buttons.slice(1)) assert.match(b.title, /admin preview below — the intern's text is not changed/, '#4 Try says it touches the preview only: ' + b.title);
        assert.equal(r.cardShown, true);
        // #5
        assert.equal(r.pvBefore, null, '#5 no preview before the first Try');
        assert.deepEqual(r.pv1, { flash: true, text: '1 / 2 tried' }, '#5 first Try: the preview appears, ringed: ' + JSON.stringify(r.pv1));
        assert.match(r.pv1shadow, /rgb\(34, 197, 94\)/, '#5 the ring is green: ' + r.pv1shadow); assert.equal(r.scroll1, 1, '#5 and scrolled into view once');
        assert.deepEqual(r.buttons1, ['💬＋ Tip', '✓ Tried', '✏ Try', '✏ Try all', 'Reset', '📋 Copy'], '#4/#5 after one Try: ' + JSON.stringify(r.buttons1));
        assert.equal(r.pv1later.flash, false, '#5 the ring goes after ~1.5 s');
        assert.deepEqual([r.pv2.flash, r.pv2.text, r.scroll2], [false, '2 / 2 tried', 1], '#5 the second Try does not flash or scroll again');
        assert.deepEqual(r.buttons2, ['💬＋ Tip', '✓ Tried', '✓ Tried', 'All tried', 'Reset', '📋 Copy']);
        assert.equal(r.pvReset, null, '#5 Reset removes the preview');
        assert.deepEqual([r.pvAll.flash, r.pvAll.text, r.scroll3], [true, '2 / 2 tried', 2], '#5 after Reset the next Try (Try all) shows it again');
        assert.deepEqual(r.toast, ['✓ Tried 2 changes in the preview'], '#4 the toast says where: ' + JSON.stringify(r.toast));
        // #7
        assert.match(r.load.line, /^⏳ Flash 3\.8 reading… กำลังอ่าน · earlier result below$/, '#7 the line names the model: ' + r.load.line);
        assert.deepEqual([r.load.opacity, r.load.events, r.load.lineAboveContent], ['0.38', 'none', true], '#7 the earlier result is faded, inert, under the line');
        assert.deepEqual([r.loadTwice.lines, /Sonnet 5\.5/.test(r.loadTwice.line)], [1, true], '#7 one line only, the latest model');
        assert.deepEqual([r.loadOff.line, r.loadOff.opacity, r.loadOff.events], ['', '1', 'auto'], '#7 off: back to normal');
        assert.deepEqual([r.loadEmpty.line, r.loadHidden.line], ['', ''], '#7 nothing on screen (empty or hidden card) → nothing to fade');
        assert.equal(r.runStarted, true, 'the retry reached the model call');
        assert.match(r.during.line, /^⏳ Flash 3\.8 reading…/, '#7 real retry: line while the model reads'); assert.equal(r.during.opacity, '0.38'); assert.equal(r.duringOld, true, '#7 the earlier result is still readable');
        assert.deepEqual([r.afterRun.line, r.afterRun.opacity, r.afterText, r.afterBadge], ['', '1', true, 'ดี'], '#7 the new result replaces it and the line goes');
        assert.match(r.during2.line, /^⏳ Flash 3\.8 reading…/); assert.deepEqual([r.afterFail.line, r.afterFail.opacity, r.failText], ['', '1', true], '#7 a failed run clears the line and shows the error');
        assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
        if (process.env.OUTDIR) { await page.locator('#reflective-grammar-card').screenshot({ path: path.join(process.env.OUTDIR, 'writing-analysis-five.png') }); }
        console.log('PASS: Writing Analysis five (V102.645) — #1 invisible / missing grade draws no pill · #3 🔴 High 🟠 Med ⚪ Low · #4 💬＋ Tip vs ✏ Try / Try all (names + "not changed" in title, ✓ Tried, n / N tried) · #5 first Try rings + scrolls the preview once, again after Reset · #7 earlier result fades under "⏳ model reading…", cleared on success and failure');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
