// V102.537: Quiz Editor "Audience & Categorization" lean — the REAL admin.html in Chromium (network stubbed). Checks: every saved field keeps its id; the
// block is far shorter; Target Group chips follow the kept <select> both ways, including a group added later; the Modes stay real checkboxes, off = grey and
// on = coloured with no visible box; the AI model rail folds behind the model name; tags still add on Enter; Style chips are short with the full name in
// the tooltip and readable; nothing overflows at desktop or phone width.
const path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PUB = path.resolve('public').replace(/\\/g, '/');
const IDS = ['quiz-system-select', 'quiz-campaign-chips', 'quiz-campaign', 'quiz-exam-style-chips', 'quiz-exam-style', 'quiz-tag-chips-container', 'quiz-tag-input', 'quiz-tags', 'quiz-tag-suggestions', 'ai-tagging-model-val', 'quiz-unlock-score', 'quiz-target-group', 'quiz-feedback-limit', 'quiz-is-poll', 'quiz-one-time', 'quiz-is-homework', 'quiz-shuffle-choices', 'quiz-partial-credit', 'quiz-instant-answer', 'quiz-notify-group', 'quiz-notify-deadline'];

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 1000 } });
    const errs = []; page.on('pageerror', e => { if (!/mermaid|ServiceWorker|reading 'auth'|db\.collection is not a function/.test(e.message)) errs.push(e.message); });
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith('file:')) return r.continue();
      if (/generative-ai/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{constructor(){}getGenerativeModel(){return {}}} export default {};' });
      return r.fulfill({ status: 200, contentType: /\.css/.test(u) ? 'text/css' : 'application/javascript', body: '' });
    });
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto('file:///' + PUB + '/admin.html');
    await page.waitForFunction(() => document.readyState === 'complete' && typeof window.paintQuizTargetChips === 'function', null, { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const d = document.getElementById('audience-summary-preview').closest('details');
      let el = d; while (el && el !== document.body) { if (getComputedStyle(el).display === 'none') el.style.setProperty('display', 'block', 'important'); el.style.visibility = 'visible'; if (el.tagName === 'DETAILS') el.open = true; el = el.parentElement; }
      document.body.appendChild(d);
      [...document.body.children].forEach(c => { if (c !== d && !/^(STYLE|SCRIPT)$/.test(c.tagName)) c.style.setProperty('display', 'none', 'important'); });
      d.style.cssText += ';display:block;width:calc(100vw - 32px);margin:8px;background:#111c33;';
      d.open = true;
      window.quizzesData = window.quizzesData || []; window.showToast = () => {};
      populateQuizCampaignChips(''); populateQuizExamStyleChips(''); updateAudienceSummaryPreview();
    });
    const missing = await page.evaluate(ids => ids.filter(i => document.querySelectorAll('#' + i).length !== 1), IDS);
    assert.deepEqual(missing, [], 'every field keeps exactly one element with its id');

    const h = await page.locator('#qe-aud').evaluate(n => n.getBoundingClientRect().height);
    assert.ok(h <= 200, 'the rows stay compact at 960 px: ' + h);
    const seps = await page.$$eval('#qe-aud .aud-r', r => r.filter(x => parseFloat(getComputedStyle(x).borderBottomWidth) > 0).length);
    assert.equal(seps, 0, 'no divider lines');

    // Target Group: chips ⇄ the kept select
    const sel = () => page.$eval('#quiz-target-group', s => s.value);
    const chips = page.locator('#quiz-target-chips .glass-toggle-item');
    assert.deepEqual((await chips.allInnerTexts()).slice(0, 4), ['Public', 'Current', 'Alumni', 'All']);
    assert.equal(await page.locator('#quiz-target-group').isVisible(), false, 'the select is hidden');
    await chips.nth(1).click();
    assert.equal(await sel(), 'intern_current', 'a chip writes the select');
    assert.match(await page.locator('#audience-summary-preview').innerText(), /Current Interns/, 'the summary follows');
    assert.equal(await page.locator('#quiz-target-chips .active').innerText(), 'Current');
    await page.evaluate(() => setQuizTargetGroupValue('Junior'));
    assert.equal(await sel(), 'Junior', 'a group nobody has still round-trips');
    assert.equal(await page.locator('#quiz-target-chips .active').innerText(), 'Junior', 'and gets its own chip');
    await page.evaluate(() => setQuizTargetGroupValue('Public'));

    // Modes: real checkboxes, grey off, coloured on, no visible box
    const shuffle = page.locator('label.logic-chip:has(#quiz-shuffle-choices)'), poll = page.locator('label.logic-chip:has(#quiz-is-poll)');
    assert.equal(await page.locator('#qe-aud .logic-chip').count(), 8);
    assert.equal(await poll.innerText(), 'Poll');
    assert.ok((await poll.getAttribute('title')).includes('·'), 'the full name + TH in the tooltip');
    assert.equal(await page.$eval('#quiz-shuffle-choices', i => getComputedStyle(i).opacity), '0', 'no visible box');
    assert.notEqual(await shuffle.evaluate(n => getComputedStyle(n).color), await poll.evaluate(n => getComputedStyle(n).color), 'on looks different from off');
    assert.equal(await page.$eval('#quiz-is-poll', i => i.checked), false);
    await poll.click();
    assert.equal(await page.$eval('#quiz-is-poll', i => i.checked), true, 'a click toggles the real checkbox');
    await poll.click();
    await page.$eval('#quiz-is-homework', i => i.focus()); await page.keyboard.press('Space');
    assert.equal(await page.$eval('#quiz-is-homework', i => i.checked), true, 'the keyboard still works');
    await page.keyboard.press('Space');

    // AI model rail folds behind the model name; AI Suggest stays one click
    assert.equal(await page.locator('#qa-ai-row').isVisible(), false, 'folded at first');
    assert.ok((await page.locator('#qa-ai-name').innerText()).trim().length > 0, 'the model name shows');
    await page.locator('#qa-ai-pick').click();
    assert.equal(await page.locator('#qa-ai-row').isVisible(), true);
    assert.equal(await page.locator('#qa-ai-pick').getAttribute('aria-expanded'), 'true');
    await page.locator('#qa-ai-pick').click();
    assert.equal(await page.locator('button.aud-ai', { hasText: 'AI Suggest' }).getAttribute('onclick'), 'window.autoTagQuizAI(this)');

    // Tags: chips and the input share one box; Enter adds
    await page.fill('#quiz-tag-input', 'contraception'); await page.press('#quiz-tag-input', 'Enter');
    assert.match(await page.$eval('#quiz-tags', i => i.value), /contraception/i, 'Enter adds a tag');
    assert.equal(await page.$eval('#quiz-tag-input', i => i.value), '', 'the input clears');
    const box = await page.$eval('#qe-aud .aud-tags', n => [n.contains(document.getElementById('quiz-tag-chips-container')), n.contains(document.getElementById('quiz-tag-input'))]);
    assert.deepEqual(box, [true, true]);

    // Style / Campaign: short, readable, full name in the tooltip
    const pebc2 = page.locator('#quiz-exam-style-chips .glass-toggle-item[data-value="pebc2"]');
    assert.match(await pebc2.innerText(), /PEBC II$/);
    assert.match(await pebc2.getAttribute('title'), /PEBC II · OSCE/);
    const [r, g, b] = (await pebc2.evaluate(n => getComputedStyle(n).color)).match(/\d+/g).map(Number);
    assert.ok(r > 150 && g > 150 && b > 150, 'an unselected chip is readable on dark: ' + [r, g, b]);
    await pebc2.click();
    assert.equal(await page.$eval('#quiz-exam-style', i => i.value), 'pebc2');

    // nothing overflows
    for (const w of [1300, 960, 390]) {
      await page.setViewportSize({ width: w, height: 900 }); await page.waitForTimeout(150);
      const d = await page.locator('#qe-aud').evaluate(n => ({ sw: n.scrollWidth, cw: n.clientWidth, past: [...n.querySelectorAll('button,select,.logic-chip,.glass-toggle-item,.aud-n')].filter(e => e.offsetParent && e.getBoundingClientRect().right > n.getBoundingClientRect().right + 1).map(e => (e.id || e.className) + ':' + Math.round(e.getBoundingClientRect().right) + '/' + Math.round(n.getBoundingClientRect().right)).join(' ') }));
      assert.ok(d.sw <= d.cw + 1 && !d.past, 'fits at ' + w + ' px: ' + JSON.stringify(d));
    }
    assert.deepEqual(errs, [], 'no page errors: ' + errs.join(' | '));
    console.log('PASS: Quiz Editor Audience lean — ids kept, compact rows, Target Group chips ⇄ select, Modes real checkboxes, AI rail folds, tags on Enter, short readable Style chips, fits 1300 / 960 / 390 px');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
