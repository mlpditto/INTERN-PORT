// V102.270 — a short quote on the exported badge picture (all three layouts, five languages). Real admin.html in Chromium: wrapping (Thai / Japanese / Chinese by word via
// Intl.Segmenter, Korean + Latin at spaces), at most 3 lines with "…", every line inside the picture, off by default, typing switches it on, PNG encodes.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.ok(/<title>Nika Admin \(V102\.\d+\)<\/title>/.test(fs.readFileSync('public/admin.html', 'utf8')));
const SAMPLES = {
  EN: 'Thank you for every lesson and every smile — see you again!',
  TH: 'ขอบคุณทุกบทเรียนและทุกรอยยิ้มตลอดการฝึกงาน แล้วพบกันใหม่นะคะ',
  KO: '배움의 시간을 함께해 주셔서 감사합니다. 시작이 반이다, 또 만나요!',
  JA: 'お世話になりました。継続は力なり、またお会いしましょう。',
  ZH: '感谢一路相伴，千里之行，始于足下，期待再相见。'
};
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    await page.addInitScript(() => { window.firebase = new Proxy(function () {}, { get: () => window.firebase, apply: () => window.firebase }); });
    await page.goto(require('url').pathToFileURL(process.cwd() + '/public/admin.html').href);
    const r = await page.evaluate(async (SAMPLES) => {
      const out = {};
      const badges = {}; ['on_fire', 'quiz_master', 'perfectionist', 'explorer'].forEach(id => { badges[id] = { level: 2 }; });
      usersData = [{ id: 'u1', displayName: 'nt', division: 'H', group: 'P', score: 3.31, badges }];
      eventStampsCache = []; window.badgeLiveCounts = async () => ({});
      document.body.insertAdjacentHTML('beforeend', '<button id="trig" type="button">x</button>');
      openUserBadgesPop({ stopPropagation() {}, currentTarget: document.getElementById('trig') }, 'u1', false);
      document.querySelector('#user-badges-pop button[aria-label="Export badge board"]').click();
      const st = badgeExportState; await st.countsPromise;
      out.defaults = [st.quote, st.showQuote];
      const draw = (l, extra) => { const s = badgeBoardSvg(Object.assign({}, st, { layout: l }, extra), l, 600); const h = document.createElement('div'); h.innerHTML = s; document.body.appendChild(h); const el = h.querySelector('svg'); const vb = el.viewBox.baseVal; const texts = [...el.querySelectorAll('text')].map(t => { const b = t.getBBox(); return { s: t.textContent, l: b.x, r: b.x + b.width, b: b.y + b.height }; }); h.remove(); return { vb: [vb.width, vb.height], texts }; };
      out.off = ['story', 'card', 'banner'].map(l => draw(l, { quote: SAMPLES.EN }).vb[1]);   // showQuote false → no change
      out.base = ['story', 'card', 'banner'].map(l => draw(l, {}).vb[1]);
      out.rows = {};
      for (const [lang, q] of Object.entries(SAMPLES)) for (const l of ['story', 'card', 'banner']) {
        const d = draw(l, { quote: q, showQuote: true });
        const lines = d.texts.filter(t => /^[“]|[”]$/.test(t.s) || t.s.length > 0).filter(t => q.includes(t.s.replace(/^“|”$/g, '')) && t.s.replace(/[“”]/g, '').length > 1);
        out.rows[lang + ':' + l] = { n: lines.length, h: d.vb[1], inside: lines.every(t => t.l >= 0 && t.r <= d.vb[0]), joined: lines.map(t => t.s.replace(/[“”]/g, '')).join('') };
      }
      const long = 'x '.repeat(200); out.long = ['story', 'card', 'banner'].map(l => { const d = draw(l, { quote: long, showQuote: true }); const ql = d.texts.filter(t => /^“?(x ?)+…?”?$/.test(t.s)); return { n: ql.length, ell: /…”?$/.test(ql[ql.length - 1].s), inside: ql.every(t => t.r <= d.vb[0]) }; });
      out.empty = draw('story', { quote: '   ', showQuote: true }).vb[1];
      // dialog: the box exists, typing switches the quote on and the pictures follow
      const dlg = () => document.getElementById('badge-export-dialog');
      out.box = !!dlg().querySelector('#bx-quote');
      const inp = dlg().querySelector('#bx-quote'); inp.focus(); inp.value = 'Thanks!'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      out.typed = [badgeExportState.quote, badgeExportState.showQuote, /Thanks!/.test(dlg().innerHTML), document.activeElement && document.activeElement.id];
      Object.assign(badgeExportState, { quote: SAMPLES.JA, showQuote: true, layout: 'story' }); const blob = await badgeExportPng(badgeExportState); out.png = { type: blob.type, ok: blob.size > 2000 };
      return out;
    }, SAMPLES);
    assert.deepEqual(r.defaults, ['', false], 'off by default');
    assert.deepEqual(r.off, r.base, 'a quote that is switched off changes nothing');
    for (const [k, v] of Object.entries(r.rows)) {
      assert.ok(v.n >= 1 && v.n <= 3, k + ': 1–3 lines, got ' + v.n); assert.ok(v.inside, k + ': every line is inside the picture');
      assert.ok(v.joined.replace(/\s/g, '').length > 6, k + ': the text is drawn: ' + v.joined);
    }
    for (const l of ['story', 'card', 'banner']) assert.ok(r.rows['EN:' + l].h > r.base[['story', 'card', 'banner'].indexOf(l)], l + ': the picture grows for the quote');
    assert.ok(r.rows['TH:card'].n >= 1 && /ขอบคุณ/.test(r.rows['TH:card'].joined), 'Thai is drawn (words found by Intl.Segmenter)');
    assert.ok(/継続は力なり/.test(r.rows['JA:story'].joined) && /千里之行/.test(r.rows['ZH:story'].joined) && /시작이/.test(r.rows['KO:story'].joined), 'Japanese, Chinese and Korean are drawn');
    r.long.forEach((x, i) => assert.ok(x.n === 3 && x.ell && x.inside, 'a very long quote stops at 3 lines with "…" (' + i + '): ' + JSON.stringify(x)));
    assert.equal(r.empty, r.base[0], 'an empty quote draws nothing');
    assert.ok(r.box, 'the quote box is in the dialog');
    assert.deepEqual(r.typed, ['Thanks!', true, true, 'bx-quote'], 'typing switches it on, the pictures follow and the box keeps its focus');
    assert.deepEqual(r.png, { type: 'image/png', ok: true }, 'PNG with a Japanese quote encodes');
    console.log('PASS: badge export quote — all layouts, TH EN KO JA ZH wrap (≤ 3 lines, "…"), off by default, typing switches it on, PNG encodes');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
