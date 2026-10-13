// V102.218 — the tag drill-down (Learning performance → ☰), wrong questions:
//  · each wrong question is ONE folded line (Qn · question · copy · LINE · ▾) — nothing expanded on open; tap = the full question + its choices (✓ correct, ✗ chosen);
//  · ⧉ copies the question WITHOUT the answer in one click (question + numbered choices, nothing marked) and does not toggle the row;
//  · the LINE button is icon-only (no text) and does not toggle the row; suggested-quiz LINE buttons are the same icon;
//  · the LINE reminder modal sits above the drill-down (id z-index rules beat `.modal[style*="flex"] { z-index: 9999 !important }`).
// The REAL render function + helpers + CSS cut from public/admin.html, in Chromium.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(html));

function grab(marker) {
    const i = html.indexOf(marker); assert.ok(i >= 0, marker);
    let d = 0, k = html.indexOf('{', html.indexOf(')', i));
    for (; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) break; }
    return html.slice(i, k + 1);
}
const line = marker => { const i = html.indexOf(marker); assert.ok(i >= 0, marker); return html.slice(i, html.indexOf('\n', i)); };
const cssA = html.indexOf('        .dd-q { border:1px solid #fecaca'), cssB = html.indexOf('        #imageQuizModal .modal-content {');
assert.ok(cssA > 0 && cssB > cssA, 'drill-down row CSS found');
const css = html.slice(cssA, cssB);
const zTag = /#tagDrillDownModal \{ z-index: (\d+) !important; \}/.exec(html), zLine = /#lineReminderModal \{ z-index: (\d+) !important; \}/.exec(html);
assert.ok(zTag && zLine && +zLine[1] > +zTag[1] && +zTag[1] > 100200, 'LINE modal id-z-index above the drill-down, which is above Divisions / Visibility');
assert.ok(!/Send LINE|> LINE<|LINE<\/button>/.test(html.slice(html.indexOf('function renderTagDrillDownContent('), html.indexOf('function drawQuizSpiderChart('))), 'no text on any LINE button in the drill-down');

const fns = ['function registerLineReminderAction(', 'function registerAssignAction(', 'function registerCopyAction(', 'function drillQuestionPlainText(', 'window.drillCopyQuestion = function(', 'function renderAnswerLabel(', 'function fmtDrillDownDate(',
    'function buildWrongQuestionReminderTemplate(', 'function buildSuggestedQuizReminderTemplate(', 'function renderTagDrillDownContent('].map(grab).join('\n') + '\n' + line('const drillLineBtn =') + '\n' + line('const drillCopyBtn =');

const WRONG = [
    { question: { q: 'A 32-year-old patient prescribed fexofenadine 180 mg daily reports inadequate symptom relief. The patient mentions taking the pill every morning with breakfast. Which drink should be avoided?', options: ['Water', 'Fruit juices', 'Black coffee', 'Milk'], correct: 1, type: 'choice' }, userAnswer: 2, quizTitle: 'Allergen Immunotherapy', timestamp: null, qIdx: 3 },
    { question: { q: 'Short answer item', type: 'text', correct: 'ans' }, userAnswer: 'x', quizTitle: 'Q2', timestamp: null, qIdx: 9 }
];
(async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 760, height: 900 } });
        await page.setContent(`<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:16px;font:16px Inter,sans-serif}button{width:100%;min-height:48px}${css}
          .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4)} .modal[style*="flex"], .modal[style*="block"]{z-index:9999 !important;display:flex}
          #tagDrillDownModal { z-index: ${zTag[1]} !important; } #lineReminderModal { z-index: ${zLine[1]} !important; }</style>
          <div id="drilldown-title"></div><div id="drilldown-stats"></div><div id="drilldown-body" style="width:640px"></div>
          <div id="tagDrillDownModal" class="modal" style="z-index:4280;"></div><div id="lineReminderModal" class="modal" style="z-index:4290;"></div>`);
        const r = await page.evaluate(async ([fns, WRONG]) => {
            const out = { toasts: [], line: [], clip: [] };
            window.escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            window.showToast = m => out.toasts.push(m);
            window.invokeLineReminderAction = i => out.line.push(i);
            Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { out.clip.push(t); return Promise.resolve(); } }, configurable: true });
            new Function(fns + '; window.renderTagDrillDownContent = renderTagDrillDownContent;').call(window);
            window.renderTagDrillDownContent({ tags: ['Allergic rhinitis'], correct: 9, total: 14, avg: 64.3, attempts: 1 }, WRONG, [{ id: 'p1', title: 'Practice quiz', matchCount: 3, questionCount: 10 }], []);
            const rows = [...document.querySelectorAll('.dd-q')];
            const vis = el => !!el && el.checkVisibility() && el.getBoundingClientRect().height > 0;   // a closed <details> hides its body (content-visibility)
            out.n = rows.length; out.open0 = rows.map(r => r.open); out.bodyVisible0 = rows.map(r => vis(r.querySelector('.dd-qb')));
            out.rowH = rows.map(r => Math.round(r.getBoundingClientRect().height));
            out.sum = rows[0].querySelector('summary').innerText.replace(/\s+/g, ' ').trim();
            out.btns = [...rows[0].querySelectorAll('summary button')].map(b => [b.className, b.textContent.trim(), b.getAttribute('aria-label')]);
            // copy: one click, no toggle
            rows[0].querySelector('.dd-copy').click(); await new Promise(r => setTimeout(r, 30));
            out.afterCopy = [rows[0].open, out.clip.slice(), out.toasts.slice()];
            // LINE: no toggle
            rows[0].querySelector('.dd-line').click();
            out.afterLine = [rows[0].open, out.line.slice()];
            // tap the summary: opens, full question + marked choices
            rows[0].querySelector('summary').click();
            out.open1 = rows[0].open;
            out.full = rows[0].querySelector('.dd-qfull').textContent; out.opts = [...rows[0].querySelectorAll('.dd-opts li')].map(li => [li.className, li.textContent]);
            out.fullVisible = vis(rows[0].querySelector('.dd-qfull'));
            out.textRow = rows[1].querySelector('.dd-qb').textContent.replace(/\s+/g, ' ').trim();
            out.suggest = [...document.querySelectorAll('#drilldown-body .dd-line')].length;
            // modal order with the real id rules
            document.getElementById('tagDrillDownModal').style.display = 'flex'; document.getElementById('lineReminderModal').style.display = 'flex';
            out.z = [getComputedStyle(document.getElementById('tagDrillDownModal')).zIndex, getComputedStyle(document.getElementById('lineReminderModal')).zIndex];
            return out;
        }, [fns, WRONG]);
        assert.equal(r.n, 2); assert.deepEqual(r.open0, [false, false], 'every wrong question starts folded');
        assert.deepEqual(r.bodyVisible0, [false, false], 'the full question is hidden until tapped');
        assert.ok(r.rowH.every(h => h <= 46), 'a folded row is one slim line: ' + r.rowH);
        assert.match(r.sum, /^Q4 A 32-year-old/, 'Qn chip + the question');
        assert.deepEqual(r.btns.map(b => [b[0], b[1]]), [['dd-ic dd-copy', ''], ['dd-ic dd-line', '']], 'two icon-only buttons (copy, LINE) — no text');
        assert.ok(r.btns.every(b => b[2]), 'both carry an aria-label');
        assert.equal(r.afterCopy[0], false, 'copy does not toggle the row');
        assert.deepEqual(r.afterCopy[1], ['A 32-year-old patient prescribed fexofenadine 180 mg daily reports inadequate symptom relief. The patient mentions taking the pill every morning with breakfast. Which drink should be avoided?\n1. Water\n2. Fruit juices\n3. Black coffee\n4. Milk'], 'the question + numbered choices, NO answer marked');
        assert.deepEqual(r.afterCopy[2], ['Copied (no answer)'], 'a toast confirms');
        assert.deepEqual(r.afterLine, [false, [0]], 'LINE does not toggle the row and passes the registered index');
        assert.equal(r.open1, true, 'tapping the line opens it'); assert.ok(r.fullVisible);
        assert.match(r.full, /Which drink should be avoided\?$/, 'the FULL question (no 220-character cut)');
        assert.deepEqual(r.opts, [['', '1. Water'], ['ok', '2. Fruit juices ✓'], ['bad', '3. Black coffee ✗'], ['', '4. Milk']], 'choices: ✓ correct, ✗ the one chosen');
        assert.match(r.textRow, /Your answer: x Correct: ans/, 'a non-choice question keeps the your answer / correct lines');
        assert.equal(r.suggest, 3, 'the suggested quiz has the same icon-only LINE button (2 questions + 1 suggestion)');
        assert.ok(+r.z[1] > +r.z[0] && +r.z[0] > 9999, 'the LINE modal computes ABOVE the drill-down and both above the 9999 pin: ' + r.z);
        console.log('PASS: drill-down wrong questions — folded one-line rows, tap = full question + choices, one-click copy without the answer, icon-only LINE buttons, LINE modal on top');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
