// V102.682 (owner pick A, mockup-read-first-inline/) — 📖 Read first window, lean + inline. The REAL admin.html (file://, network blocked,
// Firebase = Proxy). Checks: the 🔁 repeated terms are header chips (no band) — top 3 + "+n" (= every question that repeats a term), a chip shows
// only its questions; the card frame says the state (green done · amber repeats · grey empty) with no ✅ pill and no ▾; ✎ shows on hover with a
// mouse and always on touch; Jev is its logo on a dark pill; the header stays ONE row at 1200 px; no page errors.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const T = (n, d) => '- **' + n + '** — ' + d;
// five terms repeat (A–E), so the header shows three chips + "+2"; Q6 is unique, Q7 is empty
const P = [
  '**Key terms**\n' + T('Alpha', 'x') + '\n' + T('Beta', 'x') + '\n' + T('Gamma', 'x'),
  '**Key terms**\n' + T('Alpha', 'y') + '\n' + T('Beta', 'y') + '\n' + T('Delta', 'y'),
  '**Key terms**\n' + T('Alpha', 'z') + '\n' + T('Gamma', 'z') + '\n' + T('Epsilon', 'z'),
  '**Key terms**\n' + T('Delta', 'w') + '\n' + T('Epsilon', 'w'),
  '**Key terms**\n' + T('Beta', 'v'),
  '**Key terms**\n' + T('Unique one', 'only here'),
  '',
];

(async () => {
  const browser = await chromium.launch();
  try {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, hasTouch: touch, isMobile: false });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: /generative-ai/.test(r.request().url()) ? 'export class GoogleGenerativeAI { getGenerativeModel() { return {}; } }' : '' }));
      await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
      if (touch) await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
      await page.waitForFunction(() => { try { return typeof addQuestionUI === 'function' && typeof _qPrimerReviewAll === 'function' && document.readyState === 'complete'; } catch (_) { return false; } });
      await page.waitForTimeout(300);
      await page.addStyleTag({ content: '#adminGuideOverlay{display:none !important}' });
      await page.evaluate((P) => {
        window.showToast = () => {};
        document.getElementById('quizManageModal').style.display = 'block';
        const c = document.getElementById('quiz-questions-container'); c.innerHTML = '';
        P.forEach((p, i) => addQuestionUI({ q: 'Question ' + (i + 1) + '?', type: 'choice', options: ['a', 'b'], correct: [0], primer: p }));
        document.getElementById('quiz-title').value = 'One row';
        document.querySelectorAll('.quiz-q-item')[0].style.display = 'block'; _qPrimerStrip();
        _qPrimerReviewAll();
      }, P);
      const ov = page.locator('#praOverlay');

      if (!touch) {
        // header: 🔁 + three chips + "+2", no band, one row
        const hd = await ov.evaluate(o => { const f = o.querySelector('.pra-hd #pra-filters'); return { band: o.querySelectorAll('.pra-terms').length, chips: [...f.querySelectorAll('.pra-tchip')].map(c => c.querySelector('b').textContent), more: [...f.querySelectorAll('.pra-f')].map(b => [b.textContent.trim(), b.dataset.f, b.getAttribute('aria-label')]), rt: !!f.querySelector('.pra-rt'), noToggle: f.classList.contains('lang-no-toggle'), h: o.querySelector('.pra-hd').getBoundingClientRect().height }; });
        assert.equal(hd.band, 0, 'no 🔁 band under the header');
        assert.equal(hd.chips.length, 3, 'three term chips in the header: ' + JSON.stringify(hd.chips));
        assert.deepEqual(hd.more, [['+2', 'dup', '5 terms repeated']], 'the rest is one "+n" chip = the repeats filter');
        assert.ok(hd.rt && hd.noToggle, '🔁 mark, user terms never hidden by the EN/TH toggle');
        assert.ok(hd.h <= 56, 'the header is one row at 1200 px: ' + hd.h);
        // a term chip shows only its questions; tap again = all; "+n" = every question that repeats something
        const alpha = ov.locator('#pra-filters .pra-tchip').filter({ hasText: 'Alpha' });
        await alpha.evaluate(b => b.click());
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, true, true, true, true], 'Alpha → Q1–Q3 only');
        await alpha.evaluate(b => b.click());
        assert.equal(await ov.locator('.pra-card[hidden]').count(), 0, 'tap again = every card');
        await ov.locator('.pra-f[data-f="dup"]').evaluate(b => b.click());
        assert.deepEqual(await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => c.hidden)), [false, false, false, false, false, true, true], '+2 → every question that repeats a term');
        await alpha.evaluate(b => b.click());
        assert.deepEqual([await ov.locator('.pra-f[data-f="dup"]').getAttribute('aria-pressed'), await alpha.getAttribute('aria-pressed')], ['false', 'true'], 'one filter at a time');
        await alpha.evaluate(b => b.click());
        // the filter survives a live re-check
        await alpha.evaluate(b => b.click());
        await page.evaluate(() => window._praRecheck());
        assert.deepEqual([await ov.locator('#pra-filters .pra-tchip[aria-pressed="true"] b').textContent(), await ov.locator('.pra-card[hidden]').count()], ['Alpha', 4], 'the 🔁 filter stays on through a re-check');
        await ov.locator('#pra-filters .pra-tchip[aria-pressed="true"]').evaluate(b => b.click());
      }

      // cards: the frame says the state; no ✅, no ▾
      const cards = await ov.locator('.pra-card').evaluateAll(cs => cs.map(c => { const s = getComputedStyle(c); return [s.borderLeftWidth, s.borderLeftColor, c.querySelector('.pra-pill') && getComputedStyle(c.querySelector('.pra-pill')).display, getComputedStyle(c.querySelector('.pra-tg')).display]; }));
      const GREEN = 'rgb(34, 197, 94)', AMBER = 'rgb(245, 158, 11)', GREY = 'rgb(226, 232, 240)';
      assert.deepEqual(cards.map(c => c[1]), [AMBER, AMBER, AMBER, AMBER, AMBER, GREEN, GREY], 'frame: repeats amber · done green · empty grey');
      assert.ok(cards.every(c => c[0] === '4px'), 'a 4 px left frame');
      assert.equal(cards[5][2], 'none', 'no ✅ pill on a done card');
      assert.equal(cards[6][2] !== 'none', true, 'the empty card keeps ⚪');
      assert.ok(cards.every(c => c[3] === 'none'), 'no ▾ (the card header still opens it)');
      await ov.locator('.pra-card[data-q="5"] header').evaluate(h => h.click());
      assert.equal(await ov.locator('.pra-card[data-q="5"]').evaluate(c => c.classList.contains('open')), true, 'header tap opens the card');

      // ✎: hidden until hover with a mouse, always there on touch
      const goOpacity = () => ov.locator('.pra-card[data-q="0"] .pra-go').evaluate(b => getComputedStyle(b).opacity);
      if (touch) {
        assert.equal(await page.evaluate(() => matchMedia('(hover:hover)').matches), false, 'touch device: no hover');
        assert.equal(await goOpacity(), '1', '✎ always visible on touch');
      } else {
        await page.mouse.move(5, 5);
        assert.equal(await goOpacity(), '0', '✎ hidden until hover');
        const box = await ov.locator('.pra-card[data-q="0"] header').boundingBox();
        await page.mouse.move(box.x + 30, box.y + box.height / 2);
        await page.waitForTimeout(250);
        assert.equal(await goOpacity(), '1', '✎ shows on hover');
      }

      // Jev = its logo on a dark pill
      const jev = await ov.locator('#pra-jev-btn').evaluate(b => [b.textContent.trim(), !!b.querySelector('img.jev-mark'), getComputedStyle(b).backgroundColor, b.getAttribute('aria-label')]);
      assert.deepEqual(jev, ['', true, 'rgb(15, 23, 42)', 'Jev repeats'], 'Jev logo button: ' + JSON.stringify(jev));

      const noise = e => /ServiceWorker|mermaid is not defined|reading 'auth'|db\.collection|firebase/.test(e);
      assert.deepEqual(errors.filter(e => !noise(e)), [], 'no page errors: ' + errors);
      await page.close();
    }
    console.log('PASS: 📖 Read first one row (pick A) — 🔁 term chips in the header (top 3 + "+n"), a chip filters its questions and survives a re-check, no band; frame = state (green / amber / grey), no ✅, no ▾; ✎ on hover, always on touch; Jev logo pill; header one row');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
