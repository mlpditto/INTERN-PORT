// V102.274: ✨ AI draft for the badge-export quote box. Real admin.html in Chromium, callUniversalAI stubbed: the kind (Thanks / Farewell / Saying) and the language
// (EN TH KO JA ZH) reach the prompt, the reply is cleaned (first line, no quotes, ≤ 90) and put in the quote box with the quote switched on, a failed call leaves the
// typed quote alone, and the button is disabled while drafting.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(fs.readFileSync('public/admin.html', 'utf8')));
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(async () => {
      const out = {}, dlg = () => document.getElementById('badge-export-dialog');
      const btn = t => [...dlg().querySelectorAll('button')].find(b => b.textContent.trim() === t);
      usersData = [{ id: 'u1', displayName: 'nt', division: 'H', group: 'P', score: 3.31, badges: { on_fire: { level: 2 } } }];
      eventStampsCache = []; window.badgeLiveCounts = async () => ({});
      document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
      openUserBadgesPop({ stopPropagation() {}, currentTarget: document.getElementById('trig') }, 'u1', false);
      document.querySelector('#user-badges-pop button[aria-label="Export badge board"]').click();
      await badgeExportState.countsPromise;
      out.hasRow = !!btn('✨ Draft') && !!btn('🙏 Thanks') && !!btn('👋 Farewell') && !!btn('📜 Saying') && ['EN', 'TH', 'KO', 'JA', 'ZH'].every(l => !!btn(l));
      let calls = [], release;
      window.showToast = (m) => { out.toast = m; };
      window.callUniversalAI = (model, prompt, isJson, v, k, opts) => { calls.push({ model, prompt, isJson, opts }); return new Promise((res, rej) => { release = { res, rej }; }); };
      btn('👋 Farewell').click(); btn('TH').click();
      btn('✨ Draft').click();
      out.busy = [btn('✨ Drafting…') && btn('✨ Drafting…').disabled, calls.length];
      release.res({ text: '"ขอบคุณสำหรับทุกบทเรียนนะคะ"\nsecond line ignored' });
      await new Promise(r => setTimeout(r, 50));
      out.drafted = [badgeExportState.quote, badgeExportState.showQuote, dlg().querySelector('#bx-quote').value, !!btn('✨ Draft')];
      out.prompt = calls[0] && { thai: /Thai/.test(calls[0].prompt), farewell: /goodbye/.test(calls[0].prompt), feature: calls[0].opts && calls[0].opts.feature, json: calls[0].isJson };
      badgeExportState.quote = 'typed by hand';
      btn('✨ Draft').click(); release.rej(new Error('quota'));
      await new Promise(r => setTimeout(r, 50));
      out.failed = [badgeExportState.quote, out.toast, !!btn('✨ Draft') && !btn('✨ Draft').disabled];
      btn('✨ Draft').click(); release.res({ text: 'x'.repeat(200) });
      await new Promise(r => setTimeout(r, 50));
      out.capped = badgeExportState.quote.length;
      return out;
    });
    assert.ok(r.hasRow, 'kind chips, language chips and ✨ Draft are drawn');
    assert.deepEqual(r.busy, [true, 1], 'disabled while drafting, one call');
    assert.deepEqual(r.drafted, ['ขอบคุณสำหรับทุกบทเรียนนะคะ', true, 'ขอบคุณสำหรับทุกบทเรียนนะคะ', true], 'cleaned, first line only, quote switched on, input follows');
    assert.deepEqual(r.prompt, { thai: true, farewell: true, feature: 'badge_quote', json: false }, 'kind + language in the prompt');
    assert.deepEqual(r.failed, ['typed by hand', 'Draft failed: quota', true], 'a failed call keeps the typed quote and says why');
    assert.equal(r.capped, 90, 'capped to the input limit');
    console.log('badge-quote-draft-qa: PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
