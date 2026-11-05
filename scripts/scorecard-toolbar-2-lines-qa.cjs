// V102.590 (owner, A): the Scorecard (Quality Audit) toolbar is 2 lines at most in its 780 px popup —
// line 1 = review tabs · ★ score / meta · Review ✕, line 2 = the model rail. The REAL admin.html styles + auditToolbarHtml + ai-model-ui.js +
// text-ai-chips.css / audit-toolbar.css, the real meta markup with sample values; also while a run shows "Luna 6 · 00:11" and before any result.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const html = fs.readFileSync('public/admin.html', 'utf8');
const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]).join('\n');
const META = '<div class="audit-meta"><span class="audit-meta-score" title="Overall quality 3.6 / 5">★ 3.6</span><span title="Saved review">· 🕒 1 Nov, 16:42</span><span title="GPT 6 Luna · 20 Q">· 5.5k</span><span class="audit-meta-stale" title="Edited">⚠ Edited</span><span class="audit-meta-info" tabindex="0" title="AI may err">ⓘ</span></div>';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('http://toolbar.test/**', r => { const u = new URL(r.request().url()); if (u.pathname === '/') return r.fulfill({ body: '<html></html>', contentType: 'text/html' }); const f = 'public' + decodeURIComponent(u.pathname); return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); });
    await page.goto('http://toolbar.test/');
    await page.setContent(styles + '<style>body{margin:0;background:#fff}</style><input id="ai-analyzer-model-val" type="hidden" value="gpt-6-luna"><div id="ai-audit-popup" style="width:780px;padding:24px;box-sizing:border-box"></div>');
    await page.addStyleTag({ path: 'public/text-ai-chips.css' });
    await page.addStyleTag({ path: 'public/audit-toolbar.css' });
    await page.addScriptTag({ path: 'public/ai-model-ui.js' });
    for (const [start, end] of [['        window.syncModelDefault =', '\n        };'], ['        window.auditFixModel =', '        window.renderAuditStart ='], ['        window.REVIEW_TABS =', '        // The rail is rendered'], ['        window.reviewTabsHtml =', '\n        };'], ['        window.showReviewTab =', '\n        };']]) {
      const a = html.indexOf(start), b = html.indexOf(end, a);
      assert.ok(a >= 0 && b > a, start);
      await page.addScriptTag({ content: html.slice(a, b + (end === '\n        };' ? end.length : 0)) });
    }
    await page.evaluate(() => { window.reviewRunStop = () => false; });
    // lines = distinct vertical centres of the visible controls (tabs, meta spans, actions, rail buttons)
    const measure = () => page.evaluate(() => {
      const tb = document.querySelector('#ai-audit-popup .audit-toolbar');
      const els = [...tb.querySelectorAll('button, .audit-meta > span')].filter(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0);
      const mid = e => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
      const lines = []; els.forEach(e => { const y = mid(e); if (!lines.some(l => Math.abs(l - y) < 12)) lines.push(y); });
      lines.sort((a, b) => a - b);
      const lineOf = sel => { const e = tb.querySelector(sel); return e ? lines.findIndex(l => Math.abs(l - mid(e)) < 12) + 1 : 0; };
      return { lines: lines.length, tabs: lineOf('.review-tabs button'), meta: lineOf('.audit-meta-score'), run: lineOf('.audit-run'), close: lineOf('.audit-close'), rail: lineOf('.audit-model-row .audit-provider, .audit-model-row .text-ai-chips > button:not([hidden])') };
    });
    const draw = pills => page.evaluate(p => { document.getElementById('ai-audit-popup').innerHTML = auditToolbarHtml(true, 'audit', false, p ? { pills: p } : null); }, pills);

    await draw(META); await page.waitForTimeout(150);
    let m = await measure();
    assert.deepEqual(m, { lines: 2, tabs: 1, meta: 1, run: 1, close: 1, rail: 2 }, 'with a result: tabs · meta · Review ✕ / model rail: ' + JSON.stringify(m));
    // while running the Review button shows the model + a timer — still 2 lines
    await page.evaluate(() => { document.querySelector('.audit-run').textContent = '◌ Luna 6 · 00:11'; });
    m = await measure();
    assert.equal(m.lines, 2, 'while running ("Luna 6 · 00:11"): still 2 lines: ' + JSON.stringify(m));
    // no result yet: tabs · Review ✕ / model rail
    await draw(null); await page.waitForTimeout(150);
    m = await measure();
    assert.deepEqual([m.lines, m.tabs, m.run, m.rail], [2, 1, 1, 2], 'no result yet: tabs · Review ✕ / model rail: ' + JSON.stringify(m));
    assert.ok(await page.evaluate(() => { const t = document.querySelector('.audit-toolbar'), r = document.querySelector('.audit-close').getBoundingClientRect(); return r.right <= t.getBoundingClientRect().right + 1; }), '✕ stays inside the toolbar');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS: Scorecard toolbar 2 lines (V102.590) — tabs · ★ meta · Review ✕ on line 1, the model rail on line 2; still 2 lines while a run shows "Luna 6 · 00:11" and with no result yet (780 px popup)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
