// V102.659 (owner pick D, mockup-rewrites-head) — Review ▸ Rewrites header is two quiet rows.
// Row 1: tabs · ✨ 🩺 [model ▾] ↻ Rewrite ⤓ ✕ — the model row is folded into the chip (tap = it opens under row 1, remembered).
// Row 2: 🏷 Full ✓ · Short ✓ │ 📊 summary chip (tap = the whole analysis) · the result's model · tokens pill.
// The REAL auditToolbarHtml + the REAL result template from public/admin.html, real CSS, in Chromium. SHOT=<dir> writes PNGs.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8').replace(/\r\n/g, '\n');
const cut = (a, b, from = 0) => { const i = html.indexOf(a, from), j = html.indexOf(b, i + a.length); assert.ok(i > -1 && j > i, 'missing ' + a.slice(0, 50)); return html.slice(i + a.length, j); };
const titleTpl = cut('const titleSection = result.suggestedTitles ? `', "` : '';");
const viewTpl = cut('resultDiv.innerHTML = `', '${improvementsHtml}', html.indexOf('const titleSection = result.suggestedTitles ? `'));
assert.ok(!/pills: pillsHtml/.test(viewTpl) && /class="rw-info/.test(viewTpl), 'the result view puts the pill on the info line, not in the toolbar');
assert.ok(!/Regenerate titles/.test(titleTpl), 'no second regenerate button in the titles');
const SHOT = process.env.SHOT; let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; console.log('  ✓ ' + m); };

async function open(browser, width, titles = true) {
    const page = await (await browser.newContext({ viewport: { width, height: 600 }, deviceScaleFactor: SHOT ? 1.5 : 1 })).newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('http://toolbar.test/', r => r.fulfill({ body: '<html></html>', contentType: 'text/html' }));
    await page.route(/assets\/logos\//, r => { const f = path.join('public', new URL(r.request().url()).pathname); return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: /.svg$/.test(f) ? 'image/svg+xml' : 'image/png' }) : r.abort(); });
    await page.goto('http://toolbar.test/');
    const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');
    await page.setContent('<meta charset="utf-8">' + styles + '<style>body{margin:0;background:#e9eef5}</style><input id="ai-analyzer-model-val" type="hidden" value="gemini-3.8-flash"><input id="quiz-title"><input id="quiz-short-title"><div id="quiz-questions-container"></div>'
        + '<div id="ai-analysis-popup" class="lang-no-toggle" style="width:92%;max-width:1060px;margin:14px auto;padding:16px;background:#fff;border-radius:18px;box-sizing:border-box"></div><div id="ai-audit-popup" style="width:92%;max-width:780px;margin:14px auto;padding:16px;background:#fff"></div>');
    await page.addStyleTag({ path: 'public/text-ai-chips.css' }); await page.addStyleTag({ path: 'public/audit-toolbar.css' });
    await page.addScriptTag({ path: 'public/ai-model-ui.js' });
    for (const [start, end] of [['        window.syncModelDefault =', '\n        };'], ['        window.aiModelLogoHtml =', '\n        };'], ['        window.auditFixModel =', '        window.renderAuditStart ='], ['        window.REVIEW_TABS =', '        // The rail is rendered'], ['        window.reviewTabsHtml =', '\n        };'], ['        window.aiModelShortName =', '\n']]) {
        const a = html.indexOf(start), b = html.indexOf(end, a); assert.ok(a >= 0 && b > a, start);
        await page.addScriptTag({ content: html.slice(a, b + (end === '\n        };' ? end.length : 0)) });
    }
    await page.evaluate(([titleTpl, viewTpl, titles]) => {
        window.reviewRunStop = () => false; window.__t = []; window.showToast = m => __t.push(m); window.__runs = []; window.analyzeQuizAI = (b, o) => __runs.push(o && o.model); window.jevQuizCheck = { run() {} }; window._qPrimerReviewAll = () => {};
        window.escapeHtml = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const result = { items: [1, 2, 3, 4, 5], suggestedTitles: titles ? { full: "Menopausal hormone therapy and transdermal estradiol gel for women's vasomotor symptoms — a long full title", short: "MHT d'or" } : null };
        const analysisClean = 'Overall challenge: Low. All five questions are recall. Several distractors can be dropped without knowledge.\nSecond paragraph of the analysis.';
        const titleSection = result.suggestedTitles ? new Function('result', 'escapeHtml', 'return `' + titleTpl + '`')(result, escapeHtml) : '';
        const pillsHtml = '<span class="audit-pill" title="Model · tokens: 8,400">Opus 5.5 · 8.4k</span>';
        document.getElementById('ai-analysis-popup').innerHTML = new Function('window', 'result', 'titleSection', 'analysisClean', 'pillsHtml', 'return `' + viewTpl + '`')(window, result, titleSection, analysisClean, pillsHtml) + '<div id="first" style="height:40px;background:#f1f5f9;border-radius:10px"></div>';
        document.getElementById('ai-audit-popup').innerHTML = auditToolbarHtml(true, 'audit', false, { pills: '<span class="audit-pill">x</span>' });
        if (typeof window.oneStyleModelPickers === 'function') window.oneStyleModelPickers(document.body);
    }, [titleTpl, viewTpl, titles]);
    await page.waitForTimeout(200);
    return { page, errors };
}
const view = page => page.evaluate(() => {
    const pop = document.getElementById('ai-analysis-popup'), tb = pop.querySelector('.audit-toolbar'), info = pop.querySelector('.rw-info'), vis = e => !!e && e.getClientRects().length > 0, chip = tb.querySelector('.audit-model-chip');
    const bg = sel => { const e = tb.querySelector(sel); return e ? getComputedStyle(e).backgroundColor : null; };
    const mid = e => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; }, kids = [...info.children].filter(vis);
    return { cls: tb.className, rail: vis(tb.querySelector('.audit-model-row')), chips: [...tb.querySelectorAll('.text-ai-chips > button')].filter(vis).map(b => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')),
        chip: chip.querySelector('.amc-name').textContent, logo: (chip.querySelector('.text-ai-logo') || { dataset: {} }).dataset.owner, exp: chip.getAttribute('aria-expanded'), chipLabel: chip.getAttribute('aria-label'),
        actions: [...tb.querySelectorAll('.audit-actions > *')].map(e => e.className.split(' ')[0]), topPill: !!tb.querySelector('.audit-pill'), infoPill: (info.querySelector('.audit-pill') || {}).textContent,
        quiet: [bg('.audit-magic'), bg('.clinical-angle'), bg('.audit-export')], run: bg('.audit-run'),
        infoH: Math.round(info.getBoundingClientRect().height), oneLine: kids.every(k => Math.abs(mid(k) - mid(kids[0])) < 6), infoBg: getComputedStyle(info).backgroundColor, titlesBg: info.querySelector('.rw-titles') ? getComputedStyle(info.querySelector('.rw-titles')).backgroundColor : null,
        head: Math.round(document.getElementById('first').getBoundingClientRect().top - tb.getBoundingClientRect().top), sum: vis(document.getElementById('rw-sum')), sumExp: info.querySelector('.rw-sum-chip').getAttribute('aria-expanded'),
        ell: (() => { const t = info.querySelector('.rw-t'); return t ? t.scrollWidth > t.clientWidth : null; })(), overflow: document.documentElement.scrollWidth > innerWidth + 1, model: document.getElementById('rewrite-ai-model').value, stored: localStorage.getItem('rewriteRailFolded') };
});
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.locator('#ai-analysis-popup').screenshot({ path: path.join(SHOT, name + '.png') }); } };

(async () => {
    const browser = await chromium.launch();
    try {
        console.log('row 1');
        let { page, errors } = await open(browser, 1120);
        let v = await view(page);
        ok(/\brw-lean\b/.test(v.cls) && /\bfolded\b/.test(v.cls) && !v.rail && v.chips.length === 0, 'the model row starts folded');
        ok(v.chip === 'Flash 3.8' && v.logo === 'gemini' && v.exp === 'false' && /Gemini 3\.8 Flash/.test(v.chipLabel), 'one chip names the model for the next run: ' + v.chip);
        ok(v.actions.join(' ') === 'audit-magic clinical-angle audit-model-chip audit-run audit-export audit-close', 'order: ✨ 🩺 [model] ↻ Rewrite ⤓ ✕');
        ok(v.quiet.every(c => c === 'rgba(0, 0, 0, 0)') && v.run !== 'rgba(0, 0, 0, 0)', '✨ 🩺 ⤓ have no box; ↻ Rewrite does');
        ok(!v.topPill && v.infoPill === 'Opus 5.5 · 8.4k', 'the result pill left row 1 and sits on row 2');

        console.log('row 2');
        ok(v.oneLine && v.infoH <= 40 && v.ell === true, 'titles · 📊 · pill on ONE line (' + v.infoH + ' px), the long title ellipsizes');
        ok(v.infoBg === 'rgba(0, 0, 0, 0)' && v.titlesBg === 'rgba(0, 0, 0, 0)', 'no coloured band');
        ok(v.head <= 110, 'tabs → first rewrite = ' + v.head + ' px (was 203)');
        ok(!v.sum && v.sumExp === 'false', 'the analysis is folded into the 📊 chip');
        await shot(page, 'head-built');
        await page.click('.rw-ok[aria-label="Apply full title"]'); await page.click('.rw-ok[aria-label="Apply short title"]');
        ok(await page.evaluate(() => document.getElementById('quiz-title').value.startsWith("Menopausal hormone therapy") && document.getElementById('quiz-title').value.includes("women's") && document.getElementById('quiz-short-title').value === "MHT d'or" && __t.join() === 'Title Updated,Short Title Updated'), '✓ ✓ still write the two title fields (apostrophes survive)');
        await page.click('.rw-sum-chip'); v = await view(page);
        ok(v.sum && v.sumExp === 'true' && await page.evaluate(() => document.getElementById('rw-sum').textContent.includes('Second paragraph')), '📊 opens the whole analysis under the line');
        await page.click('.rw-sum-chip'); v = await view(page);
        ok(!v.sum, 'and folds it again');

        console.log('the model chip');
        await page.click('.audit-model-chip'); v = await view(page);
        ok(v.rail && v.exp === 'true' && v.stored === '0' && v.chips.join(' ') === 'Lite 3.5 Flash 3.8* Carbon 4 Argon 4 Gemma 4 26B', 'tap → the row of chips opens (remembered): ' + v.chips.join(' '));
        await shot(page, 'head-built-open');
        await page.click('.audit-provider[data-provider="Claude"]'); await page.locator('.text-ai-chips > button:visible', { hasText: 'Sonnet 5.5' }).click(); v = await view(page);
        ok(v.chip === 'Sonnet 5.5' && v.logo === 'claude' && v.model === 'claude-sonnet-5-5' && v.rail, 'a pick renames the chip (logo too) and sets the run model; the row stays open');
        await page.click('.audit-run');
        ok(await page.evaluate(() => __runs.join()) === 'claude-sonnet-5-5', '↻ Rewrite runs the picked model');
        await page.click('.audit-model-chip'); v = await view(page);
        ok(!v.rail && v.exp === 'false' && v.stored === '1', 'tap again → folded, remembered');
        await page.click('.clinical-angle');
        ok(await page.evaluate(() => getComputedStyle(document.querySelector('.clinical-angle')).backgroundColor) === 'rgb(253, 230, 138)', '🩺 on still shows (amber)');
        ok(await page.evaluate(() => { const a = document.querySelector('#ai-audit-popup .audit-toolbar'); return !a.classList.contains('rw-lean') && !a.querySelector('.audit-model-chip') && a.querySelector('.audit-model-row').getClientRects().length > 0 && !!a.querySelector('.audit-pill'); }), 'the Scorecard toolbar is unchanged: open model row, its pill, no chip');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        await page.context().close();

        console.log('remembered open · no titles · phone');
        ({ page, errors } = await open(browser, 1120, false));
        v = await view(page);
        ok(v.oneLine && v.titlesBg === null && v.infoPill === 'Opus 5.5 · 8.4k' && await page.evaluate(() => !document.querySelector('.rw-bar')), 'no suggested titles → the line is 📊 + pill only');
        await page.context().close();
        ({ page, errors } = await open(browser, 390));
        v = await view(page);
        ok(!v.overflow && v.infoH > 40, 'at 390 px the line wraps (' + v.infoH + ' px), no sideways scroll');
        ok(errors.length === 0, 'no page errors: ' + errors.join(' | '));
        await page.context().close();
        console.log('\nrewrites-head-lean-qa: ' + pass + ' checks passed');
    } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
