// V101.270 History, less whitespace (owner pick B, mockups/history-whitespace-*.png) — the REAL index.html + history-lean.js + articles.js
// with sample articles, on a 390 px phone and a 1440 px desktop:
//  ① a closed row is one line (title + date), ≤ 52 px  ② day labels 8 px above  ④ no empty 📎 / pt columns on rows without points
//  ③ an open article: full width; phone = 6 lines + Read more (none when it all fits); desktop = full card width, the body in 2 columns.
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const D = 864e5;
const LONG = Array.from({ length: 8 }, (_, i) => 'ย่อหน้าที่ ' + (i + 1) + ' อาการร้อนวูบวาบพบได้บ่อยในหญิงวัยหมดประจำเดือน การรักษาโดยไม่ใช้ฮอร์โมนมีหลายทางเลือก เช่น paroxetine และ fezolinetant').join('\n\n');

async function run(browser, vp) {
  const ctx = await browser.newContext(vp.w < 500 ? { viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Bangkok' } : { viewport: { width: vp.w, height: vp.h }, timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const facade = { collection: n => window.__fake.collection(n), runTransaction: f => window.__fake.runTransaction(f) };
    const FieldValue = { serverTimestamp: () => 'TS', increment: n => ({ inc: n }), delete: () => 'DEL', arrayUnion: (...a) => a };
    const chain = new Proxy(function () {}, { get: (t, k) => k === 'then' ? undefined : chain, apply: () => chain });
    window.firebase = new Proxy(function () {}, { get: (t, k) => k === 'firestore' ? Object.assign(() => facade, { FieldValue, Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) } }) : k === 'functions' ? () => ({ httpsCallable: () => () => Promise.resolve({ data: {} }) }) : chain, apply: () => chain });
    window.__fake = { collection: () => ({ where: () => ({ get: async () => ({ docs: [] }), onSnapshot: () => () => {} }), doc: id => ({ id, set: async () => {} }) }), runTransaction: async () => {} };
  });
  await page.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.goto(pathToFileURL(path.resolve('public/index.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.internArticles && typeof renderUnifiedHistory === 'function');
  const o = await page.evaluate(async ({ D, LONG }) => {
    document.getElementById('main-app').style.setProperty('display', 'block', 'important');
    const ov = document.getElementById('loading-overlay'); if (ov) ov.style.setProperty('display', 'none', 'important');
    document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });
    const g = document.getElementById('internGuideOverlay'); if (g) g.classList.remove('open');
    const wait = ms => new Promise(r => setTimeout(r, ms)), now = Date.now();
    userId = 'U1'; window.myRegistered = true;
    const art = (id, title, body, d) => ({ id, status: 'scheduled', title: { en: title }, body: { en: body }, startAt: now - d * D - 3600e3, endAt: now + 9 * D, audience: { divisions: [], groups: [] }, rerun: 'any', readMin: 1 });
    internArticles._S.list = [art('long', 'Drugs for the treatment of hot flashes in menopause', LONG, 0), art('short', 'Platysma', 'A short note.', 1), art('c', 'Psittacosis', 'x', 3), art('d', 'Mitochondrial DNA', 'y', 4)];
    window.myUserDoc = { id: 'U1', group: 'EXTERN', division: 'RSU', startDate: '2026-09-01', articleSeen: {} };
    const w = document.getElementById('work-section-content'); if (w && w.style.display === 'none' && typeof toggleWorkSection === 'function') toggleWorkSection();
    switchWorkTab('history'); filterUnifiedHistory('article'); await wait(200);
    const rows = () => [...document.querySelectorAll('#unified-timeline .hl-row')];
    const R = e => e.getBoundingClientRect();
    const out = {};
    const r2 = rows()[1], tt = r2.querySelector('.hl-tt'), mt = r2.querySelector('.hl-mt');
    out.rowH = Math.round(R(r2.querySelector('.hl-main')).height);
    out.oneLine = Math.abs(R(tt).top - R(mt).top) < 8;
    out.dateGap = Math.round(R(mt).left - R(tt).right);
    out.emptyCols = [getComputedStyle(r2.querySelector('.hl-val')).display, getComputedStyle(r2.querySelector('.hl-mat-x')).display];
    out.lblTop = getComputedStyle(document.querySelector('#unified-timeline .hl-lbl')).marginTop;
    out.shellW = Math.round(R(document.querySelector('#work-pane-history .work-pane-shell')).width);
    // a row WITH a value keeps its column (V101.113 alignment): same CSS, a non-empty value
    const probe = r2.querySelector('.hl-main').cloneNode(true); probe.querySelector('.hl-val').textContent = '+1.00'; r2.after(probe);
    out.valueKept = [getComputedStyle(probe.querySelector('.hl-val')).display, getComputedStyle(probe.querySelector('.hl-mat-x')).display]; probe.remove();
    // open the long one
    const r1 = rows()[0]; r1.click(); await wait(100);
    const det = r1.querySelector('.card-detail'), mdEl = r1.querySelector('.art-md'), more = r1.querySelector('.art-more-h');
    out.detailLeft = Math.round(R(det).left - R(r1).left);
    out.cols = getComputedStyle(mdEl).columnCount;
    out.more = [!more.hidden && getComputedStyle(more).display !== 'none', more.textContent];
    out.clampH = Math.round(R(mdEl).height);
    if (out.more[0]) { more.click(); await wait(50); out.afterMore = [Math.round(R(mdEl).height) > out.clampH + 40, more.textContent]; more.click(); await wait(50); out.backH = Math.round(R(mdEl).height); }
    // the short one: nothing hidden → no Read more
    r1.click(); await wait(50); const rs = rows()[1]; rs.click(); await wait(100);
    const m2 = rs.querySelector('.art-more-h'); out.shortMore = !m2.hidden && getComputedStyle(m2).display !== 'none';
    return out;
  }, { D, LONG });
  o.errors = errors;
  await ctx.close();
  return o;
}

(async () => {
  const browser = await chromium.launch();
  try {
    const p = await run(browser, { w: 390, h: 844 }), d = await run(browser, { w: 1440, h: 900 });
    // phone
    assert.ok(p.rowH <= 52, 'phone: a closed row is ≤ 52 px (was 64): ' + p.rowH);
    assert.ok(p.oneLine, 'phone: the date sits on the title line');
    assert.deepEqual(p.emptyCols, ['none', 'none'], 'phone: no empty 📎 / pt columns on a row without points');
    assert.deepEqual(p.valueKept, ['flex', 'block'], 'a row with a value keeps both columns: ' + p.valueKept);
    assert.equal(p.lblTop, '8px', 'day labels: 8 px above');
    assert.ok(p.detailLeft <= 4, 'phone: the open article uses the full width (no 56 px indent): ' + p.detailLeft);
    assert.equal(p.cols, 'auto', 'phone: one column');
    assert.deepEqual(p.more, [true, 'Read more ▾'], 'phone: a long article shows 6 lines + Read more');
    assert.ok(p.clampH < 6 * 13.5 * 1.55 + 6, '6 lines: ' + p.clampH);
    assert.deepEqual(p.afterMore, [true, 'Show less ▴'], 'Read more opens it all, the button says Show less');
    assert.equal(p.backH, p.clampH, 'Show less folds it back');
    assert.equal(p.shortMore, false, 'a short article: no Read more');
    // desktop
    assert.ok(d.shellW > 1100, 'desktop: History uses the card’s full width (was 720): ' + d.shellW);
    assert.ok(d.oneLine && d.dateGap >= 0 && d.dateGap < 30, 'desktop: the date right after the title, not 900 px away: ' + d.dateGap);
    assert.equal(d.cols, '2', 'desktop: an open article in 2 columns');
    assert.equal(d.more[0], false, 'desktop: all of it, no Read more');
    assert.deepEqual([...p.errors, ...d.errors], [], 'no page errors');
    console.log('PASS: History less whitespace (V101.270) — one-line ≤ 52 px rows, date on the title line (desktop: next to it), labels 8 px, no empty 📎/pt columns (kept when there is a value), open article full width: phone 6 lines + Read more / Show less (none when short), desktop full card width + 2 columns');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
