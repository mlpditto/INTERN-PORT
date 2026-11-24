// V102.703 (owner 2026-11-24: "อย่าให้มี white space มากไป ควร responsive") — the 📰 Articles editor preview phone keeps its width
// (270 px, lines break as interns see them) but its height follows the article: a short article = a short phone (the sheet starts right
// under a thin peek of the app, no empty space), a long one grows to the bottom of the window and scrolls inside; the whole body shows
// (no 6-line clamp) so "Read more" hides itself. Checked at 1700×1450 and 1300×900; under 1101 px the preview stays hidden.
// The REAL admin.html + articles-admin.js, Firebase stubbed.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const LONG = Array.from({ length: 9 }, (_, i) => '💡 ย่อหน้า ' + (i + 1) + ' ยากินบางตัวทำให้เกิด **phototoxicity** ได้ เช่น Fluoroquinolone ทั้ง class, Doxycycline, TMP/SMX ถ้าไวมากๆ อาจไหม้จนเป็นตุ่มน้ำใหญ่และลอกได้เลย').join('\n\n');

(async () => {
  const browser = await chromium.launch();
  try {
    const out = {};
    for (const [w, h] of [[1700, 1450], [1300, 900], [1050, 900]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.route('**/*', (r) => { const u = r.request().url();
        if (u.startsWith('file:')) return r.continue();
        if (/generative-ai/.test(u)) return r.fulfill({ contentType: 'application/javascript', body: 'export class GoogleGenerativeAI{} export default {};' });
        return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }); });
      await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => ({}), { FieldValue: { serverTimestamp: () => 'TS' } }) : window.firebase, apply: () => window.firebase }); });
      await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
      await page.waitForFunction(() => window.Articles && document.readyState === 'complete');
      out[w] = await page.evaluate((LONG) => {
        const S = Articles._S, D = 864e5, now = Date.now();
        const art = (id, body) => ({ id, title: { en: 'Title ' + id }, body: { en: body }, cover: { emoji: '📰' }, status: 'scheduled', startAt: now + D, endAt: now + 6 * D, audience: { divisions: [], groups: [] }, links: [], tags: [], rerun: 'any', source: null });
        S.list = [art('long', LONG), art('short', 'One short line.')]; S.loaded = true; S.loading = false; Articles.open();
        const m = (id) => {
          Articles.edit(id);
          const pv = document.querySelector('#articlesModal .art-pv'), ph = document.querySelector('#articlesModal .art-phone'), sh = document.getElementById('art-sheet');
          if (!ph || getComputedStyle(pv).display === 'none') return { hidden: true };
          const pr = ph.getBoundingClientRect(), sr = sh.getBoundingClientRect(), b = sh.querySelector('.b'), more = document.getElementById('art-pv-more');
          return { w: Math.round(pr.width), h: Math.round(pr.height), gapTop: Math.round(sr.top - pr.top), bottomOk: pr.bottom <= innerHeight + 1, sheetScrolls: sh.scrollHeight > sh.clientHeight + 2,
            clamped: b.scrollHeight > b.clientHeight + 2, moreHidden: !more || more.style.visibility === 'hidden', innerGap: Math.round(pr.bottom - sr.bottom) };
        };
        return { long: m('long'), short: m('short') };
      }, LONG);
      await page.close();
    }
    for (const w of [1700, 1300]) {
      const { long, short } = out[w];
      assert.equal(long.w, 270, w + ': the phone keeps its width'); assert.equal(short.w, 270);
      assert.ok(long.gapTop <= 40 && short.gapTop <= 40, w + ': the sheet starts right under a thin peek (no empty space): ' + JSON.stringify(out[w]));
      assert.ok(long.innerGap <= 10 && short.innerGap <= 10, w + ': the sheet reaches the bottom of the phone');
      assert.ok(long.bottomOk, w + ': a long article stops at the bottom of the window');
      assert.equal(long.clamped, false, w + ': the whole body shows (no 6-line clamp)');
      assert.ok(long.moreHidden && short.moreHidden, w + ': Read more hides itself');
      assert.ok(short.h < 330, w + ': a short article = a short phone: ' + short.h);
      assert.ok(long.h > short.h + 150, w + ': a long article = a taller phone');
    }
    assert.ok(out[1300].long.sheetScrolls, '1300×900: the long article scrolls inside the phone');
    assert.ok(out[1700].long.h > out[1300].long.h, 'a taller window gives a taller phone: ' + out[1700].long.h + ' vs ' + out[1300].long.h);
    assert.deepEqual(out[1050], { long: { hidden: true }, short: { hidden: true } }, 'under 1101 px the preview stays hidden');
    console.log('articles-preview-fit-qa: OK — 270 px wide, height = the article (short ' + out[1700].short.h + ' / long ' + out[1700].long.h + ' @1450, ' + out[1300].long.h + ' @900), no gap, no clamp, hidden < 1101');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
